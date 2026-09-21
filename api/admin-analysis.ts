import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { readSession } from './_auth.ts';
import { buildOfficialLegalReferenceContext } from '../src/lib/legalRetrieval.ts';

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
};

type AgentRun = {
  id: string;
  label: string;
  status: 'success' | 'error';
  durationMs: number;
  model?: string;
  summary: string;
};

type AgentResult<T = any> = {
  data: T | null;
  run: AgentRun;
};

const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];

function getGeminiClients(): GoogleGenAI[] {
  const keys = [1, 2, 3, 4]
    .map((index) => process.env[`GEMINI_API_KEY${index === 1 ? '' : `_${index}`}`]?.trim())
    .filter((key): key is string => Boolean(key));
  return keys.map((apiKey) => new GoogleGenAI({ apiKey }));
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

    if (data.length > 18_000_000) continue;
    totalChars += data.length;
    if (totalChars > 48_000_000) break;

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

  for (const model of MODELS) {
    for (let i = 0; i < clients.length; i++) {
      const client = clients[(i + clientOffset) % clients.length];
      try {
        const response = await client.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction,
            temperature,
            responseMimeType: 'application/json',
          },
        });

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

function combineWithoutFinalAgent(args: {
  intake: any;
  legislative: any;
  procedural: any;
  reasoning: any;
}) {
  const rawIssues = [
    ...(Array.isArray(args.legislative?.issues) ? args.legislative.issues : []),
    ...(Array.isArray(args.procedural?.issues) ? args.procedural.issues : []),
    ...(Array.isArray(args.reasoning?.issues) ? args.reasoning.issues : []),
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
    missingEvidence: stringList(args.reasoning?.missingEvidence),
    conflictingPoints: stringList(args.reasoning?.conflictingPoints),
    strongestVerifiedPoints: [
      ...stringList(args.legislative?.verifiedPoints),
      ...stringList(args.reasoning?.strongestVerifiedPoints),
    ],
    verificationQueue: [
      ...stringList(args.legislative?.verificationQueue),
      ...stringList(args.procedural?.verificationQueue),
      ...stringList(args.reasoning?.verificationQueue),
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

  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (session.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ONLY' });

  const body = (req.body ?? {}) as AdminAnalysisRequest;
  const inputText = typeof body.text === 'string' ? body.text.trim().slice(0, 45000) : '';
  const attachments = cleanAttachments(Array.isArray(body.attachments) ? body.attachments : []);

  if (!inputText && attachments.length === 0) {
    return res.status(400).json({ error: 'DOCUMENT_REQUIRED' });
  }

  const clients = getGeminiClients();
  if (clients.length === 0) {
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
    systemInstruction: `أنت وكيل إدخال قضائي سعودي. اقرأ المستند بدقة ولا تحكم على صحته.
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

  const officialContext = buildOfficialLegalReferenceContext(retrievalQuery, 10);
  const sourceNotice = officialContext
    ? `السياق المرجعي الرسمي المسترجع لهذه العملية:\n${officialContext}`
    : 'لا يوجد سياق رسمي كافٍ مسترجع لهذه العملية. أي استناد نظامي غير موجود صراحة يجب وسمه "التحقق الحرفي مطلوب".';

  const sharedRules = `قواعد ملزمة:
- لا تخترع مادة أو مرسوماً أو أمراً أو حكماً أو مبدأ قضائياً.
- افصل بين ما ورد في المستند وبين ما تم التحقق منه من السياق الرسمي.
- لا تنقل نصاً نظامياً حرفياً إلا إذا ظهر في السياق الرسمي أو المستند.
- إذا لم يكتمل التحقق، اجعل verificationNeeded=true واكتب ذلك بوضوح.
- لا تجزم بالبطلان أو النقض أو القبول؛ صف الأثر المحتمل فقط.
- لا تعرض بيانات هوية شخصية غير لازمة.
${ISSUE_SCHEMA}`;

  const specialistInput = `بيانات الإدخال:
العنوان: ${String(body.documentTitle || 'غير محدد').slice(0, 300)}
الاختصاص: ${String(body.court || intake.data?.jurisdiction || 'غير محدد').slice(0, 200)}
نوع المستند: ${String(intake.data?.documentType || 'غير محدد').slice(0, 160)}

المستند:
${workingText || 'لم يتوفر نص كافٍ بعد الاستخراج.'}

${sourceNotice}`;

  const [legislative, procedural, reasoning] = await Promise.all([
    generateJsonAgent<any>({
      clients,
      agentId: 'legislative-flaws',
      label: 'وكيل التشريعات والسريان والمراجع',
      clientOffset: 1,
      systemInstruction: `أنت وكيل تدقيق تشريعي سعودي.
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
    generateJsonAgent<any>({
      clients,
      agentId: 'procedural-flaws',
      label: 'وكيل الاختصاص والإجراءات',
      clientOffset: 2,
      systemInstruction: `أنت وكيل اختصاص وإجراءات قضائية سعودية.
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
    generateJsonAgent<any>({
      clients,
      agentId: 'reasoning-flaws',
      label: 'وكيل الإثبات والتكييف والتسبيب',
      clientOffset: 3,
      systemInstruction: `أنت وكيل نقد قضائي متخصص في الإثبات والتكييف والتسبيب.
افحص ترابط الوقائع بالأدلة، عبء الإثبات، التناقضات، التكييف النظامي، علاقة الأسباب بالمنطوق، الرد على الدفوع الجوهرية، واتساق الطلبات مع النتيجة.
لا تفترض أن مجرد اختلاف الرأي مع المحكمة عيب قانوني.
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
  ]);

  const synthesisPayload = {
    intake: intake.data,
    legislative: legislative.data,
    procedural: procedural.data,
    reasoning: reasoning.data,
    officialContextAvailable: Boolean(officialContext),
  };

  const final = await generateJsonAgent<any>({
    clients,
    agentId: 'admin-final',
    label: 'المراجع النهائي للأدمن',
    clientOffset: 0,
    systemInstruction: `أنت المراجع النهائي في غرفة تحليل QADA الخاصة بالأدمن.
ستستلم نتائج وكلاء مستقلين. مهمتك الدمج وإزالة التكرار وكشف التعارض بينهم، لا اختراع نقاط جديدة بلا سند.
رتب الملاحظات حسب أثرها المحتمل، واحتفظ بحالة المصدر لكل نقطة.
إذا تعارض وكيلان فضع التعارض في conflictingPoints ولا تخفِه.
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

  const report = final.data
    ? normalizeReport(final.data)
    : combineWithoutFinalAgent({
        intake: intake.data,
        legislative: legislative.data,
        procedural: procedural.data,
        reasoning: reasoning.data,
      });

  const agentRuns: AgentRun[] = [
    intake.run,
    legislative.run,
    procedural.run,
    reasoning.run,
    final.run,
  ];

  const completed = agentRuns.filter((run) => run.status === 'success').length;
  const failed = agentRuns.length - completed;

  return res.status(200).json({
    report,
    agentRuns,
    meta: {
      analyzedAt: new Date().toISOString(),
      officialContextAvailable: Boolean(officialContext),
      completedAgents: completed,
      failedAgents: failed,
      architecture: 'multi-agent-v2',
    },
  });
}
