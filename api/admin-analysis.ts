import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { readSession } from './_auth.ts';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.ts';

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

function enforceVerificationGate(report: ReturnType<typeof normalizeReport>, verification: {
  officialSources: number;
  verifiedArticles: number;
  blockers: string[];
  literalQuotationReady: boolean;
  precedentCorpusReady: boolean;
}) {
  const queue = new Set(report.verificationQueue);
  for (const blocker of verification.blockers) queue.add(blocker);

  const issues = report.issues.map((issue) => {
    let sourceStatus = issue.sourceStatus;
    let verificationNeeded = issue.verificationNeeded;
    let legalBasis = issue.legalBasis;

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

  const sourceBundle = runLegalSourceAgents(retrievalQuery);
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
${ISSUE_SCHEMA}`;

  const specialistInput = `بيانات الإدخال:
العنوان: ${String(body.documentTitle || 'غير محدد').slice(0, 300)}
الاختصاص: ${String(body.court || intake.data?.jurisdiction || 'غير محدد').slice(0, 200)}
نوع المستند: ${String(intake.data?.documentType || 'غير محدد').slice(0, 160)}

المستند:
${workingText || 'لم يتوفر نص كافٍ بعد الاستخراج.'}

${sourceNotice}`;

  const [legislative, judicial, procedural, evidence, reasoning, rebuttal] = await Promise.all([
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
      agentId: 'judicial-flaws',
      label: 'وكيل العيوب القضائية والمبادئ',
      clientOffset: 2,
      systemInstruction: `أنت وكيل مراجعة قضائية سعودي.
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
    generateJsonAgent<any>({
      clients,
      agentId: 'procedural-flaws',
      label: 'وكيل الاختصاص والإجراءات',
      clientOffset: 3,
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
      agentId: 'evidence-flaws',
      label: 'وكيل الإثبات والمرفقات',
      clientOffset: 0,
      systemInstruction: `أنت وكيل إثبات قضائي سعودي.
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
    generateJsonAgent<any>({
      clients,
      agentId: 'reasoning-flaws',
      label: 'وكيل التكييف والتسبيب',
      clientOffset: 1,
      systemInstruction: `أنت وكيل تكييف وتسبيب قضائي سعودي.
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
    generateJsonAgent<any>({
      clients,
      agentId: 'rebuttal-review',
      label: 'وكيل مراجعة الدفوع والردود',
      clientOffset: 2,
      systemInstruction: `أنت وكيل مراجعة دفوع وردود.
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
  ]);

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

  const final = await generateJsonAgent<any>({
    clients,
    agentId: 'admin-final',
    label: 'المراجع النهائي للأدمن',
    clientOffset: 0,
    systemInstruction: `أنت المراجع النهائي في غرفة تحليل QADA الخاصة بالأدمن.
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

  const report = enforceVerificationGate(rawReport, sourceBundle.verification);

  const sourceRuns: AgentRun[] = sourceBundle.runs.map((run) => ({
    id: run.id,
    label: run.label,
    status: run.status,
    durationMs: run.durationMs,
    summary: run.summary,
    blockers: run.blockers,
  }));

  const documentTypeLabel = String(intake.data?.documentType || body.documentTitle || '').trim();
  const auditIsJudgment = /حكم|قرار قضائي|قضاء|دائرة/i.test(documentTypeLabel);
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
    status: 'success',
    durationMs: 1,
    summary: `فعّل ${sourceRuns.length} وكلاء مصادر و6 مسارات تحليل تخصصية.`,
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

  const agentRuns: AgentRun[] = [
    intake.run,
    auditRun,
    routingRun,
    coreRun,
    ...sourceRuns,
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

  const completed = agentRuns.filter((run) => run.status === 'success').length;
  const warnings = agentRuns.filter((run) => run.status === 'warning').length;
  const failed = agentRuns.filter((run) => run.status === 'error').length;

  return res.status(200).json({
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
      architecture: 'multi-agent-v3-source-gated',
    },
  });
}
