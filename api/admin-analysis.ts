import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { readActiveSession } from './session.js';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.js';
import { enforceRateLimit } from './_rateLimit.js';
import { recordAuditEvent } from './_audit.js';
import { redactDirectIdentifiers } from './_privacy.js';
import { withTimeout } from './_async.js';
import { ADMIN_AI_MODELS, USER_AI_MODELS, isQuotaError, isModelCoolingDown, markModelQuotaError } from './_aiRuntime.js';
import { isRedisConfigured, redisCommand, redisPrefix } from './_redis.js';
import { protectJson } from './_secureStore.js';
import { buildCourtProfileInstruction } from '../src/lib/courtProfiles.js';
import { buildCaseStrategyInstruction } from '../src/lib/caseStrategyProfiles.js';
import { buildAgentContractInstruction } from '../src/lib/agentContracts.js';
import { analyzeLawOfficeRoute } from '../src/lib/lawOfficeExpert.js';

type IncomingAttachment = {
  name?: string;
  type?: string;
  data?: string;
};

type AdminAnalysisRequest = {
  text?: string;
  documentTitle?: string;
  court?: string;
  attachments?: IncomingAttachment[];
  runId?: string;
};

type LiveAgentStatus = 'queued' | 'running' | 'success' | 'warning' | 'error';

type LiveAgentRun = {
  id: string;
  label: string;
  status: LiveAgentStatus;
  durationMs: number;
  model?: string;
  summary: string;
  blockers?: string[];
};

type LiveRunSnapshot = {
  runId: string;
  documentTitle: string;
  analyzedAt: string;
  agentRuns: LiveAgentRun[];
  sourcePackets: unknown[];
  meta: {
    live: true;
    state: 'running' | 'completed' | 'failed';
    currentAgentIds: string[];
    completedAgents: number;
    warningAgents: number;
    failedAgents: number;
    architecture: string;
    buildCommit: string;
    updatedAt: string;
  };
};

type AgentRun = {
  id: string;
  label: string;
  status: 'success' | 'warning' | 'error';
  durationMs: number;
  model?: string;
  summary: string;
  blockers?: string[];
};

type AgentResult<T = any> = {
  data: T | null;
  run: AgentRun;
};

const MODELS = ADMIN_AI_MODELS;

const LIVE_LABELS: Record<string, string> = {
  'admin-entry': 'غرفة التحليل للأدمن',
  'document-reader': 'قارئ المستندات',
  'case-router': 'موجّه القضية',
  'qada-core': 'QADA AI Orchestrator',
  'facts': 'محلل الوقائع',
  'judgment-audit': 'إيجنت تحليل الأحكام',
  'memo-audit': 'إيجنت تحليل المذكرات',
  'legislative-flaws': 'كشف العيوب التشريعية',
  'judicial-flaws': 'كشف العيوب القضائية',
  'procedural-flaws': 'كشف العيوب الإجرائية',
  'evidence-flaws': 'فحص الإثبات',
  'reasoning-flaws': 'فحص التكييف والتسبيب',
  'rebuttal-review': 'مراجعة الدفوع والردود',
  'jurisdiction': 'محلل الاختصاص',
  'characterization': 'محلل التكييف',
  'evidence': 'محلل الإثبات',
  'reasoning': 'محلل التسبيب',
  'procedure': 'محلل الإجراءات',
  'admin-final': 'التقرير التحليلي للأدمن',
  'conflicts': 'كاشف التعارض',
  'final-review': 'بوابة المراجعة النهائية',
};

function liveRunKey(userId: string) {
  return `${redisPrefix()}:admin:live:${userId}`;
}

function liveBuildCommit() {
  return process.env.RAILWAY_GIT_COMMIT_SHA
    || process.env.QADA_RELEASE
    || process.env.VERCEL_GIT_COMMIT_SHA
    || '';
}

function liveEntry(id: string, status: LiveAgentStatus = 'queued', summary = 'بانتظار الدور'): LiveAgentRun {
  return {
    id,
    label: LIVE_LABELS[id] || id,
    status,
    durationMs: 0,
    summary,
  };
}

function upsertLiveAgent(snapshot: LiveRunSnapshot, run: Partial<LiveAgentRun> & { id: string }) {
  const index = snapshot.agentRuns.findIndex((item) => item.id === run.id);
  const current = index >= 0 ? snapshot.agentRuns[index] : liveEntry(run.id);
  const next: LiveAgentRun = {
    ...current,
    ...run,
    label: run.label || current.label || LIVE_LABELS[run.id] || run.id,
    durationMs: Number(run.durationMs ?? current.durationMs ?? 0),
    summary: String(run.summary ?? current.summary ?? ''),
  };
  if (index >= 0) snapshot.agentRuns[index] = next;
  else snapshot.agentRuns.push(next);
}

function recalcLive(snapshot: LiveRunSnapshot) {
  snapshot.meta.currentAgentIds = snapshot.agentRuns.filter((run) => run.status === 'running').map((run) => run.id);
  snapshot.meta.completedAgents = snapshot.agentRuns.filter((run) => run.status === 'success').length;
  snapshot.meta.warningAgents = snapshot.agentRuns.filter((run) => run.status === 'warning').length;
  snapshot.meta.failedAgents = snapshot.agentRuns.filter((run) => run.status === 'error').length;
  snapshot.meta.updatedAt = new Date().toISOString();
}

async function saveLiveRun(userId: string, snapshot: LiveRunSnapshot) {
  recalcLive(snapshot);
  if (!isRedisConfigured()) return;
  try {
    await redisCommand([
      'SET',
      liveRunKey(userId),
      protectJson(snapshot, 'admin-live-run'),
      'EX',
      900,
    ]);
  } catch (error) {
    console.warn('Admin live telemetry unavailable:', error instanceof Error ? error.message : error);
  }
}


function getGeminiClients(): GoogleGenAI[] {
  const keys = [1, 2, 3, 4]
    .map((index) => process.env[`GEMINI_API_KEY${index === 1 ? '' : `_${index}`}`]?.trim())
    .filter((key): key is string => Boolean(key));
  return keys.map((apiKey) => new GoogleGenAI({ apiKey }));
}

function getGatewayToken(): string {
  return process.env.AI_GATEWAY_API_KEY?.trim()
    || process.env.VERCEL_OIDC_TOKEN?.trim()
    || '';
}

async function tryGatewayJson(systemInstruction: string, parts: any[]): Promise<{ data: any; model: string } | null> {
  const token = getGatewayToken();
  if (!token) return null;

  const textParts = parts
    .map((part) => typeof part?.text === 'string' ? part.text.trim() : '')
    .filter(Boolean);
  const hasNonText = parts.some((part) => part?.inlineData);
  if (hasNonText || textParts.length === 0) return null;

  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(18_000),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.5-flash',
      models: ['google/gemini-3.5-flash-lite', 'google/gemini-3.1-flash-lite', 'google/gemini-3.6-flash'],
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: textParts.join('\n\n') },
      ],
      temperature: 0.05,
      response_format: { type: 'json_object' },
      max_tokens: 7000,
    }),
  });

  if (!response.ok) return null;
  const payload: any = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  const raw = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('')
      : '';
  const data = parseJson(raw);
  if (!data) return null;
  return {
    data,
    model: String(payload?.model || 'ai-gateway'),
  };
}

function sanitizeMimeType(type?: string, name?: string): string | null {
  const mime = (type || '').trim().toLowerCase();
  const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
  if (allowed.has(mime)) return mime;
  const filename = (name || '').toLowerCase();
  if (filename.endsWith('.pdf')) return 'application/pdf';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  if (filename.endsWith('.webp')) return 'image/webp';
  return null;
}

function parseJson(raw: string): any | null {
  const text = (raw || '').trim();
  if (!text) return null;
  const candidates = [
    text,
    text.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '').trim(),
  ];
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

function cleanAttachments(rawAttachments: IncomingAttachment[]) {
  let totalChars = 0;
  const cleaned: Array<{ name: string; mimeType: string; data: string }> = [];

  for (const item of rawAttachments.slice(0, 5)) {
    const mimeType = sanitizeMimeType(item.type, item.name);
    const raw = typeof item.data === 'string' ? item.data.trim() : '';
    if (!mimeType || !raw) continue;

    const data = raw.startsWith('data:') && raw.includes(',')
      ? raw.slice(raw.indexOf(',') + 1)
      : raw;

    if (data.length > 3_500_000) continue;
    totalChars += data.length;
    if (totalChars > 3_500_000) break;

    cleaned.push({
      name: String(item.name || 'مرفق').slice(0, 180),
      mimeType,
      data,
    });
  }

  return cleaned;
}

async function generateJsonAgent<T>(args: {
  clients: GoogleGenAI[];
  agentId: string;
  label: string;
  systemInstruction: string;
  parts: any[];
  temperature?: number;
  clientOffset?: number;
}): Promise<AgentResult<T>> {
  const started = Date.now();
  let lastError: unknown;
  const { clients, agentId, label, systemInstruction, parts, temperature = 0.05, clientOffset = 0 } = args;

  try {
    const gateway = await tryGatewayJson(systemInstruction, parts);
    if (gateway) {
      return {
        data: gateway.data as T,
        run: {
          id: agentId,
          label,
          status: 'success',
          durationMs: Date.now() - started,
          model: gateway.model,
          summary: 'اكتمل التحليل عبر بوابة الذكاء.',
        },
      };
    }
  } catch (error) {
    lastError = error;
  }

  if (clients.length === 0) {
    return {
      data: null,
      run: {
        id: agentId,
        label,
        status: 'error',
        durationMs: Date.now() - started,
        summary: 'لا يوجد مزود ذكاء مهيأ.',
      },
    };
  }

  const baseModels = agentId === 'admin-final' ? USER_AI_MODELS : MODELS;
  const modelOffset = agentId === 'admin-final' ? 0 : clientOffset % baseModels.length;
  const modelOrder = [...baseModels.slice(modelOffset), ...baseModels.slice(0, modelOffset)];

  let attempts = 0;
  for (const model of modelOrder) {
    if (isModelCoolingDown(model)) continue;
    for (let i = 0; i < clients.length && attempts < 8; i++) {
      attempts += 1;
      const client = clients[(i + clientOffset) % clients.length];
      try {
        const response = await withTimeout(client.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction,
            temperature,
            responseMimeType: 'application/json',
          },
        }), 22_000, 'AI_AGENT_TIMEOUT');

        const raw = response.text
          || response.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('')
          || '';
        const parsed = parseJson(raw) as T | null;
        if (!parsed) throw new Error('AI_INVALID_JSON');

        return {
          data: parsed,
          run: {
            id: agentId,
            label,
            status: 'success',
            durationMs: Date.now() - started,
            model,
            summary: 'اكتمل التحليل.',
          },
        };
      } catch (error) {
        lastError = error;
        if (isQuotaError(error)) {
          markModelQuotaError(model, error);
          console.warn(`[${agentId}] model quota exhausted, switching model:`, model);
          break;
        }
      }
    }
  }

  console.error(`[${agentId}] failed:`, lastError);
  return {
    data: null,
    run: {
      id: agentId,
      label,
      status: 'error',
      durationMs: Date.now() - started,
      summary: 'تعذر إكمال هذا المسار التحليلي.',
    },
  };
}

function stringList(value: any, limit = 30, maxLength = 800): string[] {
  return Array.isArray(value)
    ? value.slice(0, limit).map((item) => String(item || '').trim().slice(0, maxLength)).filter(Boolean)
    : [];
}

const allowedCategories = new Set([
  'تشريعي',
  'قضائي',
  'إجرائي',
  'إثبات',
  'تكييف',
  'تسبيب',
  'اختصاص',
  'طلبات',
  'صياغة',
  'تعارض',
  'مرجعي',
  'أخرى',
]);

const allowedSeverity = new Set(['حرج', 'عالٍ', 'متوسط', 'منخفض', 'ملاحظة']);

function normalizeIssue(issue: any, index: number) {
  return {
    id: String(issue?.id || `issue-${index + 1}`).slice(0, 80),
    category: allowedCategories.has(String(issue?.category)) ? String(issue.category) : 'أخرى',
    severity: allowedSeverity.has(String(issue?.severity)) ? String(issue.severity) : 'ملاحظة',
    title: String(issue?.title || 'ملاحظة تحليلية').slice(0, 240),
    documentSegment: String(issue?.documentSegment || '').slice(0, 1800),
    analysis: String(issue?.analysis || '').slice(0, 4000),
    legalBasis: String(issue?.legalBasis || '').slice(0, 2500),
    sourceUrls: stringList(issue?.sourceUrls, 8, 1000),
    sourceStatus: String(issue?.sourceStatus || 'غير متحقق').slice(0, 160),
    impact: String(issue?.impact || '').slice(0, 1800),
    verificationNeeded: Boolean(issue?.verificationNeeded),
  };
}

function normalizeReport(input: any) {
  const issues = Array.isArray(input?.issues)
    ? input.issues.slice(0, 80).map(normalizeIssue)
    : [];

  return {
    documentType: String(input?.documentType || 'مستند قانوني').slice(0, 160),
    jurisdiction: String(input?.jurisdiction || 'غير محدد').slice(0, 160),
    executiveSummary: String(input?.executiveSummary || '').slice(0, 6000),
    issues,
    missingFacts: stringList(input?.missingFacts),
    missingEvidence: stringList(input?.missingEvidence),
    conflictingPoints: stringList(input?.conflictingPoints, 30, 1200),
    strongestVerifiedPoints: stringList(input?.strongestVerifiedPoints, 30, 1200),
    verificationQueue: stringList(input?.verificationQueue, 40, 1200),
    finalNotes: String(input?.finalNotes || '').slice(0, 5000),
  };
}

function enforceVerificationGate(report: ReturnType<typeof normalizeReport>, verification: {
  officialSources: number;
  verifiedArticles: number;
  blockers: string[];
  literalQuotationReady: boolean;
  precedentCorpusReady: boolean;
}, allowedSourceUrls: string[]) {
  const queue = new Set(report.verificationQueue);
  for (const blocker of verification.blockers) queue.add(blocker);

  const allowedUrls = new Set(allowedSourceUrls.filter(Boolean));
  const issues = report.issues.map((issue) => {
    let sourceStatus = issue.sourceStatus;
    let verificationNeeded = issue.verificationNeeded;
    let legalBasis = issue.legalBasis;
    const originalSourceUrls = Array.isArray(issue.sourceUrls) ? issue.sourceUrls : [];
    const sourceUrls = originalSourceUrls.filter((url) => allowedUrls.has(url));

    if (sourceUrls.length !== originalSourceUrls.length) {
      verificationNeeded = true;
      queue.add('أزال مدقق المصدر رابطاً غير موجود في حزمة المصادر الرسمية المسترجعة؛ لا يعتمد أي رابط يولده النموذج من تلقاء نفسه.');
    }

    if (sourceStatus === 'متحقق من السياق الرسمي' && sourceUrls.length === 0) {
      sourceStatus = 'التحقق الحرفي مطلوب';
      verificationNeeded = true;
      queue.add('وُسمت نقطة بأنها متحققة دون إرفاق رابط مصدر من الحزمة الرسمية؛ خُفضت حالة التحقق آلياً.');
    }

    if (sourceStatus === 'متحقق من السياق الرسمي' && verification.officialSources === 0) {
      sourceStatus = 'مصدر غير مكتمل';
      verificationNeeded = true;
    }

    const precedentClaim = /مبدأ|سابقة|حكم\s+(?:رقم|المحكمة|الدائرة)/i.test(legalBasis);
    if (precedentClaim && !verification.precedentCorpusReady) {
      sourceStatus = sourceStatus === 'متحقق من السياق الرسمي' ? 'التحقق الحرفي مطلوب' : sourceStatus;
      verificationNeeded = true;
      queue.add('ورد استناد إلى حكم/مبدأ قضائي بينما قاعدة السوابق الرسمية الكاملة غير جاهزة؛ يلزم التحقق من المصدر القضائي الرسمي.');
    }

    const literalClaim = /[«»]/.test(legalBasis) || /نص\s+الماد(?:ة|ه)/i.test(legalBasis);
    if (literalClaim && !verification.literalQuotationReady) {
      sourceStatus = sourceStatus === 'متحقق من السياق الرسمي' ? 'التحقق الحرفي مطلوب' : sourceStatus;
      verificationNeeded = true;
      legalBasis = legalBasis.replace(/\s+/g, ' ').trim();
      queue.add('يوجد ادعاء باقتباس حرفي بينما مخزن النصوص الحرفية الكاملة غير معتمد بعد؛ يجب مطابقة النص مع المصدر الرسمي قبل الاعتماد.');
    }

    if (!['متحقق من السياق الرسمي', 'وارد في المستند فقط', 'التحقق الحرفي مطلوب', 'مصدر غير مكتمل'].includes(sourceStatus)) {
      sourceStatus = 'التحقق الحرفي مطلوب';
      verificationNeeded = true;
    }

    return {
      ...issue,
      legalBasis,
      sourceUrls,
      sourceStatus,
      verificationNeeded,
    };
  });

  return {
    ...report,
    issues,
    verificationQueue: Array.from(queue).slice(0, 80),
    finalNotes: [
      report.finalNotes,
      `بوابة التحقق الآلي: ${verification.officialSources} مصدر رسمي فريد، ${verification.verifiedArticles} مادة مفهرسة، ${verification.blockers.length} قيد تحقق.`,
      verification.literalQuotationReady
        ? 'الاقتباس الحرفي متاح لهذه العملية.'
        : 'الاقتباس الحرفي من النصوص النظامية غير معتمد من المستودع حتى تتم المطابقة مع المصدر الرسمي.',
      verification.precedentCorpusReady
        ? 'قاعدة السوابق القضائية الرسمية جاهزة.'
        : 'قاعدة السوابق القضائية الرسمية الكاملة غير جاهزة؛ أي استناد قضائي يحتاج تحققاً مستقلاً.',
    ].filter(Boolean).join('\n'),
  };
}

function combineWithoutFinalAgent(args: {
  intake: any;
  legislative: any;
  judicial: any;
  procedural: any;
  evidence: any;
  reasoning: any;
  rebuttal: any;
}) {
  const rawIssues = [
    ...(Array.isArray(args.legislative?.issues) ? args.legislative.issues : []),
    ...(Array.isArray(args.judicial?.issues) ? args.judicial.issues : []),
    ...(Array.isArray(args.procedural?.issues) ? args.procedural.issues : []),
    ...(Array.isArray(args.evidence?.issues) ? args.evidence.issues : []),
    ...(Array.isArray(args.reasoning?.issues) ? args.reasoning.issues : []),
    ...(Array.isArray(args.rebuttal?.issues) ? args.rebuttal.issues : []),
  ];

  return normalizeReport({
    documentType: args.intake?.documentType || 'مستند قانوني',
    jurisdiction: args.intake?.jurisdiction || 'غير محدد',
    executiveSummary: 'اكتملت المسارات التخصصية، لكن تعذر تشغيل المراجع النهائي. تعرض النتيجة أدناه الملاحظات الخام المجمعة ويجب مراجعتها قبل الاعتماد.',
    issues: rawIssues,
    missingFacts: [
      ...stringList(args.intake?.missingFacts),
      ...stringList(args.procedural?.missingFacts),
    ],
    missingEvidence: stringList(args.evidence?.missingEvidence),
    conflictingPoints: [
      ...stringList(args.judicial?.conflictingPoints),
      ...stringList(args.evidence?.conflictingPoints),
      ...stringList(args.reasoning?.conflictingPoints),
      ...stringList(args.rebuttal?.conflictingPoints),
    ],
    strongestVerifiedPoints: [
      ...stringList(args.legislative?.verifiedPoints),
      ...stringList(args.evidence?.strongestVerifiedPoints),
      ...stringList(args.reasoning?.strongestVerifiedPoints),
      ...stringList(args.rebuttal?.strongestVerifiedPoints),
    ],
    verificationQueue: [
      ...stringList(args.legislative?.verificationQueue),
      ...stringList(args.judicial?.verificationQueue),
      ...stringList(args.procedural?.verificationQueue),
      ...stringList(args.evidence?.verificationQueue),
      ...stringList(args.reasoning?.verificationQueue),
      ...stringList(args.rebuttal?.verificationQueue),
    ],
    finalNotes: 'المراجع النهائي غير متاح في هذه المحاولة؛ لا تعتبر هذه النسخة تقريراً نهائياً.',
  });
}

const ISSUE_SCHEMA = `كل issue يجب أن يكون بهذا الشكل:
{
  "id": "معرف قصير",
  "category": "تشريعي|قضائي|إجرائي|إثبات|تكييف|تسبيب|اختصاص|طلبات|صياغة|تعارض|مرجعي|أخرى",
  "severity": "حرج|عالٍ|متوسط|منخفض|ملاحظة",
  "title": "...",
  "documentSegment": "الموضع من المستند إن وجد",
  "analysis": "...",
  "legalBasis": "السند المتحقق أو وصف ما يحتاج تحققاً",
  "sourceUrls": ["روابط المصادر الرسمية فقط من حزمة المصدر، دون اختراع روابط"],
  "sourceStatus": "متحقق من السياق الرسمي|وارد في المستند فقط|التحقق الحرفي مطلوب|مصدر غير مكتمل",
  "impact": "الأثر المحتمل دون جزم غير مسند",
  "verificationNeeded": true
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await readActiveSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (session.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ONLY' });

  try {
    const limit = await enforceRateLimit('admin-analysis', session.id, 12, 10 * 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }
  } catch (error) {
    console.error('Admin-analysis rate limit unavailable:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'RATE_LIMIT_STORE_UNAVAILABLE' });
  }

  const body = (req.body ?? {}) as AdminAnalysisRequest;
  const runId = String(body.runId || `admin-${Date.now()}`).replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 180) || `admin-${Date.now()}`;
  const documentTitle = String(body.documentTitle || 'تحليل قضائي').slice(0, 300);
  const live: LiveRunSnapshot = {
    runId,
    documentTitle,
    analyzedAt: new Date().toISOString(),
    agentRuns: [
      liveEntry('admin-entry', 'success', 'استقبلت غرفة الأدمن طلب التحليل.'),
      liveEntry('document-reader', 'running', 'يقرأ المستند ويستخرج الوقائع الأساسية الآن.'),
      liveEntry('case-router'),
      liveEntry('qada-core'),
      liveEntry('facts'),
      liveEntry('judgment-audit'),
      liveEntry('memo-audit'),
      liveEntry('legislative-flaws'),
      liveEntry('judicial-flaws'),
      liveEntry('procedural-flaws'),
      liveEntry('evidence-flaws'),
      liveEntry('reasoning-flaws'),
      liveEntry('rebuttal-review'),
      liveEntry('jurisdiction'),
      liveEntry('characterization'),
      liveEntry('evidence'),
      liveEntry('reasoning'),
      liveEntry('procedure'),
      liveEntry('admin-final'),
      liveEntry('conflicts'),
      liveEntry('final-review'),
    ],
    sourcePackets: [],
    meta: {
      live: true,
      state: 'running',
      currentAgentIds: ['document-reader'],
      completedAgents: 1,
      warningAgents: 0,
      failedAgents: 0,
      architecture: 'multi-agent-v5-live-telemetry',
      buildCommit: liveBuildCommit(),
      updatedAt: new Date().toISOString(),
    },
  };
  await saveLiveRun(session.id, live);

  const rawInputText = typeof body.text === 'string' ? body.text.trim().slice(0, 45000) : '';
  const inputText = redactDirectIdentifiers(rawInputText).text;
  const attachments = cleanAttachments(Array.isArray(body.attachments) ? body.attachments : []);

  if (!inputText && attachments.length === 0) {
    upsertLiveAgent(live, { id: 'document-reader', status: 'error', summary: 'لم يصل مستند أو نص للتحليل.' });
    live.meta.state = 'failed';
    await saveLiveRun(session.id, live);
    return res.status(400).json({ error: 'DOCUMENT_REQUIRED' });
  }

  const clients = getGeminiClients();
  if (clients.length === 0) {
    upsertLiveAgent(live, { id: 'document-reader', status: 'error', summary: 'لا يوجد مزود ذكاء مهيأ.' });
    upsertLiveAgent(live, { id: 'qada-core', status: 'error', summary: 'توقف المحرك لعدم وجود مزود ذكاء.' });
    live.meta.state = 'failed';
    await saveLiveRun(session.id, live);
    return res.status(503).json({ error: 'AI_PROVIDER_UNAVAILABLE' });
  }

  const baseParts: any[] = attachments.map((attachment) => ({
    inlineData: {
      mimeType: attachment.mimeType,
      data: attachment.data,
    },
  }));

  const intakePrompt = [
    `عنوان المستند: ${String(body.documentTitle || 'غير محدد').slice(0, 300)}`,
    `الاختصاص المبدئي الذي اختاره الأدمن: ${String(body.court || 'غير محدد').slice(0, 200)}`,
    inputText ? `النص المقدم:\n${inputText}` : 'اقرأ المرفقات المرسلة أولاً.',
  ].join('\n\n');

  const intake = await generateJsonAgent<any>({
    clients,
    agentId: 'document-reader',
    label: 'قارئ المستندات ومصنف القضية',
    clientOffset: 0,
    systemInstruction: `${buildAgentContractInstruction('document-reader')}

أنت وكيل إدخال قضائي سعودي. اقرأ المستند بدقة ولا تحكم على صحته.
استخرج نوع المستند والاختصاص الظاهر والوقائع والطلبات والتواريخ والأطراف والمراجع المذكورة والمستندات المشار إليها.
إذا كان المصدر PDF أو صورة فاستخرج النص المهم كما هو قدر الإمكان، ولا تخترع أجزاء غير مقروءة.
أعد JSON فقط:
{
  "documentType": "...",
  "jurisdiction": "...",
  "documentExtract": "استخراج مركز للنص لا يتجاوز 18000 حرف",
  "keyFacts": [],
  "requests": [],
  "proceduralDates": [],
  "mentionedAuthorities": [],
  "mentionedEvidence": [],
  "missingFacts": [],
  "warnings": []
}`,
    parts: [...baseParts, { text: intakePrompt }],
  });

  upsertLiveAgent(live, { ...intake.run, id: 'document-reader' });
  upsertLiveAgent(live, {
    id: 'facts',
    status: intake.data ? 'success' : 'warning',
    durationMs: intake.run.durationMs,
    model: intake.run.model,
    summary: intake.data ? 'اكتمل استخراج الوقائع الأساسية.' : 'اكتمل القارئ دون طبقة وقائع كاملة.',
  });
  upsertLiveAgent(live, { id: 'case-router', status: 'running', summary: 'يحدد المسار القانوني والوكلاء المطلوبين الآن.' });
  upsertLiveAgent(live, { id: 'qada-core', status: 'running', summary: 'يبني حزمة المصادر ويوجّه التحليل الآن.' });
  await saveLiveRun(session.id, live);

  const workingText = [
    inputText,
    intake.data?.documentExtract ? `استخراج الوكيل من المرفقات:\n${String(intake.data.documentExtract).slice(0, 18000)}` : '',
  ].filter(Boolean).join('\n\n').slice(0, 52000);

  const retrievalQuery = [
    body.court || '',
    body.documentTitle || '',
    workingText.slice(0, 26000),
    ...stringList(intake.data?.mentionedAuthorities, 20, 300),
  ].filter(Boolean).join('\n');

  const routeAudit = analyzeLawOfficeRoute(
    [body.court || '', body.documentTitle || '', workingText].join('\n'),
    attachments.length > 0,
  );
  const sourceBundle = runLegalSourceAgents(retrievalQuery);
  for (const sourceRun of sourceBundle.runs) {
    upsertLiveAgent(live, {
      id: sourceRun.id,
      label: sourceRun.label,
      status: sourceRun.status,
      durationMs: sourceRun.durationMs,
      summary: sourceRun.summary,
      blockers: sourceRun.blockers,
    });
  }
  upsertLiveAgent(live, {
    id: 'case-router',
    status: routeAudit.blocking ? 'warning' : 'success',
    durationMs: 1,
    summary: `المهمة: ${routeAudit.task} • المرحلة: ${routeAudit.stage} • المحكمة: ${routeAudit.courtProfile} • نظرية القضية: ${routeAudit.caseStrategyProfile}`,
    blockers: routeAudit.blocking ? [routeAudit.reason] : [],
  });
  const coreHasWarnings = routeAudit.blocking || sourceBundle.runs.some((run) => run.status === 'warning');
  upsertLiveAgent(live, {
    id: 'qada-core',
    status: coreHasWarnings ? 'warning' : 'success',
    durationMs: 1,
    summary: routeAudit.blocking
      ? 'أوقف موجّه القضية الصياغة النهائية حتى تصحيح المسار.'
      : sourceBundle.runs.some((run) => run.status === 'warning')
        ? 'اكتمل التوجيه مع قيود تحقق مرجعية.'
        : 'اكتمل التوجيه وبناء حزمة المصادر.',
    blockers: [
      ...(routeAudit.blocking ? [routeAudit.reason] : []),
      ...sourceBundle.verification.blockers,
    ],
  });
  live.sourcePackets = sourceBundle.packets;
  await saveLiveRun(session.id, live);
  const documentTypeLabel = String(intake.data?.documentType || body.documentTitle || '').trim();
  const auditIsJudgment = /حكم|قرار قضائي|قضاء|دائرة/i.test(documentTypeLabel);
  const analysisMode = auditIsJudgment ? 'تحليل حكم/قرار قضائي' : 'تحليل مذكرة/لائحة/دفاع';
  const auditId = auditIsJudgment ? 'judgment-audit' : 'memo-audit';
  const inactiveAuditId = auditIsJudgment ? 'memo-audit' : 'judgment-audit';
  upsertLiveAgent(live, { id: auditId, status: 'success', durationMs: 1, summary: `تم اختيار مسار ${analysisMode}.` });
  live.agentRuns = live.agentRuns.filter((run) => run.id !== inactiveAuditId);
  await saveLiveRun(session.id, live);
  const sourceNotice = [
    'نتيجة وكلاء المراجع القانونية لهذه العملية:',
    sourceBundle.context,
    `إجمالي المصادر الرسمية الفريدة: ${sourceBundle.verification.officialSources}`,
    `المواد المفهرسة المتحقق من وجودها: ${sourceBundle.verification.verifiedArticles}`,
    'الاقتباس الحرفي الجاهز من داخل المستودع: لا؛ يجب الرجوع للمصدر الرسمي للنص الحرفي.',
    'قاعدة السوابق القضائية الكاملة: غير مكتملة؛ لا يجوز اختراع رقم حكم أو مبدأ.',
  ].join('\n\n');

  const sharedRules = `قواعد ملزمة:
- لا تخترع مادة أو مرسوماً أو أمراً أو حكماً أو مبدأ قضائياً.
- افصل بين ما ورد في المستند وبين ما تم التحقق منه من السياق الرسمي.
- لا تنقل نصاً نظامياً حرفياً إلا إذا ظهر في السياق الرسمي أو المستند.
- إذا لم يكتمل التحقق، اجعل verificationNeeded=true واكتب ذلك بوضوح.
- لا تجزم بالبطلان أو النقض أو القبول؛ صف الأثر المحتمل فقط.
- لا تعرض بيانات هوية شخصية غير لازمة.
- sourceUrls يجب أن تحتوي فقط على روابط موجودة حرفياً في حزمة وكلاء المراجع؛ لا تنشئ رابطاً جديداً ولا تكمل رابطاً ناقصاً.
${ISSUE_SCHEMA}`;

  const profileInput = [
    body.court || '',
    body.documentTitle || '',
    workingText,
  ].join('\n');
  const courtProfileInstruction = buildCourtProfileInstruction(profileInput);
  const caseStrategyInstruction = buildCaseStrategyInstruction(profileInput);

  const specialistInput = `${courtProfileInstruction}

${caseStrategyInstruction}

بيانات الإدخال:
العنوان: ${String(body.documentTitle || 'غير محدد').slice(0, 300)}
الاختصاص: ${String(body.court || intake.data?.jurisdiction || 'غير محدد').slice(0, 200)}
نوع المستند: ${String(intake.data?.documentType || 'غير محدد').slice(0, 160)}
مسار غرفة الأدمن: ${analysisMode}
مهمة موجّه القضية: ${routeAudit.task}
مرحلة الحكم: ${routeAudit.stage}
بروفايل المحكمة: ${routeAudit.courtProfile}
نظرية القضية: ${routeAudit.caseStrategyProfile}
بوابة الصياغة: ${routeAudit.blocking ? 'BLOCK' : 'ALLOW'}
${routeAudit.blocking ? `سبب الإيقاف: ${routeAudit.reason}` : ''}

المستند:
${workingText || 'لم يتوفر نص كافٍ بعد الاستخراج.'}

${sourceNotice}`;

  const specialistTasks = [
    () => generateJsonAgent<any>({
      clients,
      agentId: 'legislative-flaws',
      label: 'وكيل التشريعات والسريان والمراجع',
      clientOffset: 1,
      systemInstruction: `${buildAgentContractInstruction('legislative-flaws')}

أنت وكيل تدقيق تشريعي سعودي.
افحص النصوص النظامية المذكورة أو الواجب بحثها، حالة السريان والتعديل والإلغاء، المصدر الرسمي، والفرق بين النص النظامي والمبدأ القضائي.
ركز على ديوان المظالم ونظام المرافعات أمامه ونظام التنفيذ أمامه ونظام خدمة الأفراد والأوامر والمراسيم واللوائح عندما تكون ذات صلة.
${sharedRules}
أعد JSON فقط:
{
  "issues": [],
  "verifiedPoints": [],
  "verificationQueue": []
}`,
      parts: [{ text: specialistInput }],
    }),
    () => generateJsonAgent<any>({
      clients,
      agentId: 'judicial-flaws',
      label: 'وكيل العيوب القضائية والمبادئ',
      clientOffset: 2,
      systemInstruction: `${buildAgentContractInstruction('judicial-flaws')}

أنت وكيل مراجعة قضائية سعودي.
افحص منطق الحكم القضائي، مدى معالجة الدفوع الجوهرية، التناقض بين الأسباب والمنطوق، وحدود الاستناد إلى المبادئ والأحكام السابقة.
لا تنسب رقماً أو مبدأً إلى حكم أو دائرة إلا إذا ورد ذلك صراحة في حزمة المصدر الرسمية. إذا كانت قاعدة السوابق غير مكتملة فاجعل أي استناد من هذا النوع verificationNeeded=true.
${sharedRules}
أعد JSON فقط:
{
  "issues": [],
  "conflictingPoints": [],
  "verificationQueue": []
}`,
      parts: [{ text: specialistInput }],
    }),
    () => generateJsonAgent<any>({
      clients,
      agentId: 'procedural-flaws',
      label: 'وكيل الاختصاص والإجراءات',
      clientOffset: 3,
      systemInstruction: `${buildAgentContractInstruction('procedural-flaws')}

أنت وكيل اختصاص وإجراءات قضائية سعودية.
افحص الاختصاص الولائي والنوعي، الصفة والمصلحة، المواعيد، التظلم السابق عند لزومه، تسلسل الإجراءات، الطلبات الشكلية، وما إذا كانت الوقائع المتاحة تكفي للجزم بأي نقطة إجرائية.
${sharedRules}
أعد JSON فقط:
{
  "issues": [],
  "missingFacts": [],
  "verificationQueue": []
}`,
      parts: [{ text: specialistInput }],
    }),
    () => generateJsonAgent<any>({
      clients,
      agentId: 'evidence-flaws',
      label: 'وكيل الإثبات والمرفقات',
      clientOffset: 0,
      systemInstruction: `${buildAgentContractInstruction('evidence-flaws')}

أنت وكيل إثبات قضائي سعودي.
اربط كل واقعة أو ادعاء بما يسنده في المستند والمرفقات، وحدد الفجوات والتناقضات وعبء الإثبات والمستندات الناقصة.
لا تفترض وجود دليل لم يرفق ولا تعتبر مجرد ذكر مستند إثباتاً لمضمونه.
${sharedRules}
أعد JSON فقط:
{
  "issues": [],
  "missingEvidence": [],
  "conflictingPoints": [],
  "strongestVerifiedPoints": [],
  "verificationQueue": []
}`,
      parts: [{ text: specialistInput }],
    }),
    () => generateJsonAgent<any>({
      clients,
      agentId: 'reasoning-flaws',
      label: 'وكيل التكييف والتسبيب',
      clientOffset: 1,
      systemInstruction: `${buildAgentContractInstruction('reasoning-flaws')}

أنت وكيل تكييف وتسبيب قضائي سعودي.
افحص التكييف النظامي للوقائع، البدائل الممكنة، علاقة الأسباب بالطلبات والمنطوق، وأي قفزة منطقية أو تعارض داخلي.
لا تعتبر مجرد وجود تكييف مختلف خطأً؛ بين لماذا قد يكون التكييف محل مراجعة وما السند الذي يحتاج تحققاً.
${sharedRules}
أعد JSON فقط:
{
  "issues": [],
  "conflictingPoints": [],
  "strongestVerifiedPoints": [],
  "verificationQueue": []
}`,
      parts: [{ text: specialistInput }],
    }),
    () => generateJsonAgent<any>({
      clients,
      agentId: 'rebuttal-review',
      label: 'وكيل مراجعة الدفوع والردود',
      clientOffset: 2,
      systemInstruction: `${buildAgentContractInstruction('rebuttal-review')}

أنت وكيل مراجعة دفوع وردود.
استخرج كل دفع جوهري أو جواب عليه، وحدد ما إذا كان الرد يعالج جوهر الدفع أم يتجاوزه، وما الذي يحتاج سنداً أو إثباتاً إضافياً.
لا تصف دفعاً بأنه حاسم أو منتج إلا مع بيان الأساس والتحقق المطلوب.
${sharedRules}
أعد JSON فقط:
{
  "issues": [],
  "conflictingPoints": [],
  "strongestVerifiedPoints": [],
  "verificationQueue": []
}`,
      parts: [{ text: specialistInput }],
    }),

  ];
  const specialistIds = [
    'legislative-flaws',
    'judicial-flaws',
    'procedural-flaws',
    'evidence-flaws',
    'reasoning-flaws',
    'rebuttal-review',
  ];
  const specialistResults: AgentResult<any>[] = [];
  for (let offset = 0; offset < specialistTasks.length; offset += 2) {
    const activeIds = specialistIds.slice(offset, offset + 2);
    for (const id of activeIds) {
      upsertLiveAgent(live, { id, status: 'running', summary: 'يعمل الآن على المستند.' });
    }
    await saveLiveRun(session.id, live);

    const batch = await Promise.all(
      specialistTasks.slice(offset, offset + 2).map((runAgent) => runAgent())
    );
    specialistResults.push(...batch);
    for (const result of batch) {
      upsertLiveAgent(live, result.run);
      if (result.run.id === 'procedural-flaws') {
        upsertLiveAgent(live, { id: 'jurisdiction', status: result.data ? 'success' : 'warning', durationMs: result.run.durationMs, model: result.run.model, summary: result.data ? 'اكتمل فحص الاختصاص.' : 'فحص الاختصاص يحتاج مراجعة.' });
        upsertLiveAgent(live, { id: 'procedure', status: result.data ? 'success' : 'warning', durationMs: result.run.durationMs, model: result.run.model, summary: result.data ? 'اكتمل فحص الإجراءات.' : 'فحص الإجراءات يحتاج مراجعة.' });
      }
      if (result.run.id === 'evidence-flaws') {
        upsertLiveAgent(live, { id: 'evidence', status: result.data ? 'success' : 'warning', durationMs: result.run.durationMs, model: result.run.model, summary: result.data ? 'اكتمل فحص الإثبات.' : 'فحص الإثبات يحتاج مراجعة.' });
      }
      if (result.run.id === 'reasoning-flaws') {
        upsertLiveAgent(live, { id: 'characterization', status: result.data ? 'success' : 'warning', durationMs: result.run.durationMs, model: result.run.model, summary: result.data ? 'اكتمل فحص التكييف.' : 'فحص التكييف يحتاج مراجعة.' });
        upsertLiveAgent(live, { id: 'reasoning', status: result.data ? 'success' : 'warning', durationMs: result.run.durationMs, model: result.run.model, summary: result.data ? 'اكتمل فحص التسبيب.' : 'فحص التسبيب يحتاج مراجعة.' });
      }
    }
    await saveLiveRun(session.id, live);

    if (offset + 2 < specialistTasks.length) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  const [legislative, judicial, procedural, evidence, reasoning, rebuttal] = specialistResults;

  const synthesisPayload = {
    intake: intake.data,
    legislative: legislative.data,
    judicial: judicial.data,
    procedural: procedural.data,
    evidence: evidence.data,
    reasoning: reasoning.data,
    rebuttal: rebuttal.data,
    sourceVerification: sourceBundle.verification,
  };

  upsertLiveAgent(live, { id: 'admin-final', status: 'running', summary: 'يجمع نتائج الوكلاء ويبني التقرير التحليلي الآن.' });
  upsertLiveAgent(live, { id: 'final-review', status: 'queued', summary: 'بانتظار التقرير النهائي.' });
  await saveLiveRun(session.id, live);

  const final = await generateJsonAgent<any>({
    clients,
    agentId: 'admin-final',
    label: 'المراجع النهائي للأدمن',
    clientOffset: 0,
    systemInstruction: `${buildAgentContractInstruction('admin-final')}

أنت المراجع النهائي في غرفة تحليل QADA الخاصة بالأدمن.
ستستلم نتائج وكلاء مستقلين ونتيجة وكلاء المراجع القانونية. مهمتك الدمج وإزالة التكرار وكشف التعارض بينهم، لا اختراع نقاط جديدة بلا سند.
رتب الملاحظات حسب أثرها المحتمل، واحتفظ بحالة المصدر لكل نقطة.
إذا تعارض وكيلان فضع التعارض في conflictingPoints ولا تخفِه.
إذا كانت حزمة المراجع تشير إلى blocker أو warning، فلا تحول النقطة إلى "متحقق من السياق الرسمي" لمجرد أن الوكيل التحليلي ذكرها.
إذا لم تكن قاعدة السوابق جاهزة، فلا تنسب رقماً أو مبدأً قضائياً إلى حكم غير موجود في المصدر الرسمي.
إذا لم يكن النص الحرفي محفوظاً ومتحققاً، لا تضع اقتباساً حرفياً للمادة؛ اذكر رقمها ومصدرها وحالة التحقق فقط.
أعد JSON فقط بهذا الشكل:
{
  "documentType": "...",
  "jurisdiction": "...",
  "executiveSummary": "...",
  "issues": [],
  "missingFacts": [],
  "missingEvidence": [],
  "conflictingPoints": [],
  "strongestVerifiedPoints": [],
  "verificationQueue": [],
  "finalNotes": "..."
}
${ISSUE_SCHEMA}`,
    parts: [{ text: JSON.stringify(synthesisPayload) }],
    temperature: 0.02,
  });

  upsertLiveAgent(live, final.run);
  await saveLiveRun(session.id, live);

  const rawReport = final.data
    ? normalizeReport(final.data)
    : combineWithoutFinalAgent({
        intake: intake.data,
        legislative: legislative.data,
        judicial: judicial.data,
        procedural: procedural.data,
        evidence: evidence.data,
        reasoning: reasoning.data,
        rebuttal: rebuttal.data,
      });

  const allowedSourceUrls = Array.from(new Set(
    sourceBundle.packets.flatMap((packet) => [
      ...packet.references.map((reference) => reference.sourceUrl),
      ...packet.verifiedArticles.map((article) => article.sourceUrl),
    ]).filter(Boolean)
  ));

  const report = enforceVerificationGate(rawReport, sourceBundle.verification, allowedSourceUrls);

  const sourceRuns: AgentRun[] = sourceBundle.runs.map((run) => ({
    id: run.id,
    label: run.label,
    status: run.status,
    durationMs: run.durationMs,
    summary: run.summary,
    blockers: run.blockers,
  }));

  const adminEntryRun: AgentRun = {
    id: 'admin-entry',
    label: 'غرفة التحليل للأدمن',
    status: 'success',
    durationMs: 1,
    summary: 'استقبلت غرفة الأدمن المستند وبدأت مسار التحليل المقيد.',
  };

  const auditRun: AgentRun = {
    id: auditIsJudgment ? 'judgment-audit' : 'memo-audit',
    label: auditIsJudgment ? 'إيجنت تحليل الأحكام' : 'إيجنت تحليل المذكرات',
    status: 'success',
    durationMs: 1,
    summary: auditIsJudgment
      ? 'تم توجيه المستند لمسار تحليل الأحكام.'
      : 'تم توجيه المستند لمسار تحليل المذكرات والدفوع.',
  };

  const routingRun: AgentRun = {
    id: 'case-router',
    label: 'موجّه القضية',
    status: routeAudit.blocking ? 'warning' : 'success',
    durationMs: 1,
    summary: `${routeAudit.task}/${routeAudit.stage} • ${routeAudit.courtProfile} • ${routeAudit.caseStrategyProfile} • فعّل ${sourceRuns.length} وكلاء مصادر و6 مسارات تحليل تخصصية.`,
    blockers: routeAudit.blocking ? [routeAudit.reason] : [],
  };

  const coreRun: AgentRun = {
    id: 'qada-core',
    label: 'QADA AI Orchestrator',
    status: sourceRuns.some((run) => run.status === 'warning') ? 'warning' : 'success',
    durationMs: 1,
    summary: sourceRuns.some((run) => run.status === 'warning')
      ? 'اكتمل التوجيه مع قيود تحقق مرجعية ظاهرة في الخريطة.'
      : 'اكتمل التوجيه دون قيود مرجعية ظاهرة.',
    blockers: sourceBundle.verification.blockers,
  };

  const logicalRuns: AgentRun[] = [
    {
      id: 'facts',
      label: 'محلل الوقائع',
      status: intake.data ? 'success' : 'warning',
      durationMs: intake.run.durationMs,
      model: intake.run.model,
      summary: intake.data
        ? `استخرج ${stringList(intake.data?.keyFacts).length} واقعة رئيسية و${stringList(intake.data?.proceduralDates).length} تاريخاً إجرائياً.`
        : 'تعذر بناء طبقة الوقائع بصورة مستقلة؛ راجع قراءة المستند.',
      blockers: intake.data ? stringList(intake.data?.warnings, 8, 600) : ['لم تتوفر مخرجات قارئ المستند.'],
    },
    {
      id: 'jurisdiction',
      label: 'محلل الاختصاص',
      status: procedural.data ? 'success' : 'warning',
      durationMs: procedural.run.durationMs,
      model: procedural.run.model,
      summary: procedural.data
        ? `فحص الاختصاص والمسار الإجرائي للمستند ضمن: ${String(intake.data?.jurisdiction || body.court || 'غير محدد').slice(0, 160)}.`
        : 'تعذر إكمال مسار الاختصاص بصورة مستقلة.',
      blockers: procedural.data ? stringList(procedural.data?.verificationQueue, 8, 600) : ['مسار الإجراءات لم يكتمل.'],
    },
    {
      id: 'characterization',
      label: 'محلل التكييف',
      status: reasoning.data ? 'success' : 'warning',
      durationMs: reasoning.run.durationMs,
      model: reasoning.run.model,
      summary: reasoning.data
        ? 'اكتمل فحص التكييف النظامي وعلاقته بالوقائع والطلبات.'
        : 'تعذر إكمال فحص التكييف.',
      blockers: reasoning.data ? stringList(reasoning.data?.verificationQueue, 8, 600) : ['مسار التكييف والتسبيب لم يكتمل.'],
    },
    {
      id: 'evidence',
      label: 'محلل الإثبات',
      status: evidence.data ? (stringList(evidence.data?.missingEvidence).length ? 'warning' : 'success') : 'warning',
      durationMs: evidence.run.durationMs,
      model: evidence.run.model,
      summary: evidence.data
        ? `فحص الأدلة والمرفقات؛ رُصد ${stringList(evidence.data?.missingEvidence).length} عنصر إثبات ناقص أو مطلوب.`
        : 'تعذر إكمال فحص الإثبات.',
      blockers: evidence.data ? stringList(evidence.data?.missingEvidence, 8, 600) : ['مسار الإثبات لم يكتمل.'],
    },
    {
      id: 'reasoning',
      label: 'محلل التسبيب',
      status: reasoning.data ? (stringList(reasoning.data?.conflictingPoints).length ? 'warning' : 'success') : 'warning',
      durationMs: reasoning.run.durationMs,
      model: reasoning.run.model,
      summary: reasoning.data
        ? `فحص ترابط الأسباب والطلبات والمنطوق؛ رُصد ${stringList(reasoning.data?.conflictingPoints).length} تعارضاً محتملاً.`
        : 'تعذر إكمال فحص التسبيب.',
      blockers: reasoning.data ? stringList(reasoning.data?.conflictingPoints, 8, 600) : ['مسار التكييف والتسبيب لم يكتمل.'],
    },
    {
      id: 'procedure',
      label: 'محلل الإجراءات',
      status: procedural.data ? (stringList(procedural.data?.missingFacts).length ? 'warning' : 'success') : 'warning',
      durationMs: procedural.run.durationMs,
      model: procedural.run.model,
      summary: procedural.data
        ? `فحص المواعيد والإجراءات والقبول الشكلي؛ توجد ${stringList(procedural.data?.missingFacts).length} معلومة إجرائية ناقصة.`
        : 'تعذر إكمال فحص الإجراءات.',
      blockers: procedural.data ? stringList(procedural.data?.missingFacts, 8, 600) : ['مسار الإجراءات لم يكتمل.'],
    },
  ];

  const agentRuns: AgentRun[] = [
    adminEntryRun,
    intake.run,
    auditRun,
    routingRun,
    coreRun,
    ...sourceRuns,
    ...logicalRuns,
    legislative.run,
    judicial.run,
    procedural.run,
    evidence.run,
    reasoning.run,
    rebuttal.run,
    final.run,
  ];

  const conflictRun: AgentRun = {
    id: 'conflicts',
    label: 'كاشف التعارض',
    status: report.conflictingPoints.length > 0 ? 'warning' : 'success',
    durationMs: 1,
    summary: report.conflictingPoints.length > 0
      ? `رصد ${report.conflictingPoints.length} نقطة تعارض تحتاج مراجعة.`
      : 'لم يرصد التقرير النهائي نقاط تعارض مسجلة.',
    blockers: report.conflictingPoints,
  };
  agentRuns.push(conflictRun);
  upsertLiveAgent(live, conflictRun);
  await saveLiveRun(session.id, live);

  const failedBeforeGate = agentRuns.filter((run) => run.status === 'error').length;
  const finalReviewRun: AgentRun = {
    id: 'final-review',
    label: 'بوابة المراجعة النهائية',
    status: failedBeforeGate > 0 || sourceBundle.verification.blockers.length > 0 ? 'warning' : 'success',
    durationMs: final.run.durationMs,
    model: final.run.model,
    summary: failedBeforeGate > 0
      ? 'توجد مسارات متعثرة؛ التقرير يحتاج مراجعة بشرية قبل الاعتماد.'
      : sourceBundle.verification.blockers.length > 0
        ? 'اكتمل الدمج مع قيود تحقق مرجعية معلنة.'
        : 'اكتملت بوابة الدمج والتحقق دون عوائق مسجلة.',
    blockers: [
      ...sourceBundle.verification.blockers,
      ...agentRuns.filter((run) => run.status === 'error').map((run) => `${run.label}: ${run.summary}`),
    ].slice(0, 12),
  };
  agentRuns.push(finalReviewRun);
  upsertLiveAgent(live, finalReviewRun);

  const completed = agentRuns.filter((run) => run.status === 'success').length;
  const warnings = agentRuns.filter((run) => run.status === 'warning').length;
  const failed = agentRuns.filter((run) => run.status === 'error').length;

  await recordAuditEvent({
    actorId: session.id,
    actorRole: session.role,
    action: 'admin.analysis.run',
    targetType: 'analysis',
    targetId: String(body.documentTitle || documentTypeLabel || 'untitled'),
    outcome: failed > 0 ? 'warning' : 'success',
    metadata: {
      completedAgents: completed,
      warningAgents: warnings,
      failedAgents: failed,
      officialSources: sourceBundle.verification.officialSources,
      verifiedArticles: sourceBundle.verification.verifiedArticles,
    },
  });

  live.agentRuns = agentRuns.map((run) => ({
    id: run.id,
    label: run.label,
    status: run.status,
    durationMs: run.durationMs,
    model: run.model,
    summary: run.summary,
    blockers: run.blockers,
  }));
  live.sourcePackets = sourceBundle.packets;
  live.meta.state = failed > 0 ? 'failed' : 'completed';
  await saveLiveRun(session.id, live);

  return res.status(200).json({
    runId,
    report,
    agentRuns,
    sourcePackets: sourceBundle.packets,
    meta: {
      analyzedAt: new Date().toISOString(),
      officialContextAvailable: sourceBundle.verification.officialSources > 0,
      officialSources: sourceBundle.verification.officialSources,
      verifiedArticles: sourceBundle.verification.verifiedArticles,
      sourceBlockers: sourceBundle.verification.blockers.length,
      completedAgents: completed,
      warningAgents: warnings,
      failedAgents: failed,
      architecture: 'multi-agent-v5-live-telemetry',
      buildCommit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.QADA_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || '',
    },
  });
}
