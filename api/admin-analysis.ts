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

function normalizeReport(input: any) {
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
  const issues = Array.isArray(input?.issues)
    ? input.issues.slice(0, 60).map((issue: any, index: number) => ({
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
      }))
    : [];

  return {
    documentType: String(input?.documentType || 'مستند قانوني').slice(0, 160),
    jurisdiction: String(input?.jurisdiction || 'غير محدد').slice(0, 160),
    executiveSummary: String(input?.executiveSummary || '').slice(0, 6000),
    issues,
    missingFacts: Array.isArray(input?.missingFacts) ? input.missingFacts.slice(0, 30).map((v: any) => String(v).slice(0, 500)) : [],
    missingEvidence: Array.isArray(input?.missingEvidence) ? input.missingEvidence.slice(0, 30).map((v: any) => String(v).slice(0, 500)) : [],
    conflictingPoints: Array.isArray(input?.conflictingPoints) ? input.conflictingPoints.slice(0, 30).map((v: any) => String(v).slice(0, 800)) : [],
    strongestVerifiedPoints: Array.isArray(input?.strongestVerifiedPoints) ? input.strongestVerifiedPoints.slice(0, 30).map((v: any) => String(v).slice(0, 800)) : [],
    verificationQueue: Array.isArray(input?.verificationQueue) ? input.verificationQueue.slice(0, 40).map((v: any) => String(v).slice(0, 800)) : [],
    finalNotes: String(input?.finalNotes || '').slice(0, 5000),
  };
}

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
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 40000) : '';
  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 5) : [];

  if (!text && attachments.length === 0) {
    return res.status(400).json({ error: 'DOCUMENT_REQUIRED' });
  }

  const retrievalQuery = [
    body.court || '',
    body.documentTitle || '',
    text.slice(0, 24000),
  ].filter(Boolean).join('\n');

  const officialContext = buildOfficialLegalReferenceContext(retrievalQuery, 8);

  const instruction = `أنت "غرفة التحليل القضائي الخاصة بالأدمن" في منصة QADA السعودية.
مهمتك فحص الحكم أو المذكرة أو القرار أو اللائحة فحصاً نقدياً منظماً، لا إصدار حكم قضائي جديد ولا ادعاء القطع بما لا يثبت.

قواعد إلزامية:
1) افصل بين: ما ورد في المستند، وما استنتجته تحليلياً، وما تم التحقق منه من مصدر رسمي.
2) لا تخترع مادة أو مرسوماً أو أمراً أو حكماً أو مبدأ قضائياً.
3) لا تنقل نصاً نظامياً حرفياً إلا إذا كان وارداً في السياق الرسمي المسترجع أو في المستند نفسه؛ وإلا اكتب "التحقق الحرفي مطلوب".
4) افحص تحديداً: الاختصاص، الإجراءات والمواعيد، التكييف، الإثبات وعبء الإثبات، التسبيب، علاقة الأسباب بالمنطوق، الطلبات، التعارض الداخلي، النصوص النظامية، التعديلات والسريان، والمبادئ القضائية ذات الصلة.
5) عند كل عيب اذكر أثره المحتمل بصياغة احتمالية مهنية، لا تجزم بالبطلان أو النقض إلا إذا كان السند المتحقق يسمح بذلك.
6) اجعل sourceStatus واحداً من أوصاف واضحة مثل: "متحقق من السياق الرسمي"، "وارد في المستند فقط"، "التحقق الحرفي مطلوب"، "مصدر غير مكتمل".
7) verificationNeeded=true إذا احتاجت النقطة مراجعة مصدر رسمي أو ملف ناقص.
8) لا تعرض بيانات هوية شخصية غير لازمة.
9) أعِد JSON صالحاً فقط بدون Markdown.

صيغة JSON المطلوبة:
{
  "documentType": "...",
  "jurisdiction": "...",
  "executiveSummary": "...",
  "issues": [
    {
      "id": "issue-1",
      "category": "تشريعي|قضائي|إجرائي|إثبات|تكييف|تسبيب|اختصاص|طلبات|صياغة|تعارض|مرجعي|أخرى",
      "severity": "حرج|عالٍ|متوسط|منخفض|ملاحظة",
      "title": "...",
      "documentSegment": "...",
      "analysis": "...",
      "legalBasis": "...",
      "sourceStatus": "...",
      "impact": "...",
      "verificationNeeded": true
    }
  ],
  "missingFacts": [],
  "missingEvidence": [],
  "conflictingPoints": [],
  "strongestVerifiedPoints": [],
  "verificationQueue": [],
  "finalNotes": "..."
}

السياق المرجعي الرسمي المتاح لهذه العملية:
${officialContext || 'لا يوجد سياق رسمي كافٍ مسترجع لهذه العملية؛ يجب التصريح بعدم اكتمال التحقق.'}`;

  const parts: any[] = [];
  for (const attachment of attachments) {
    const mimeType = sanitizeMimeType(attachment.type, attachment.name);
    const raw = typeof attachment.data === 'string' ? attachment.data.trim() : '';
    if (!mimeType || !raw) continue;
    const data = raw.startsWith('data:') && raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    parts.push({ inlineData: { mimeType, data } });
  }

  const promptText = [
    `عنوان المستند: ${String(body.documentTitle || 'غير محدد').slice(0, 300)}`,
    `الاختصاص المبدئي: ${String(body.court || 'غير محدد').slice(0, 200)}`,
    text ? `النص المراد تحليله:\n${text}` : 'اعتمد على المرفقات المرسلة واقرأها أولاً.',
  ].join('\n\n');
  parts.push({ text: promptText });

  const clients = getGeminiClients();
  if (clients.length === 0) {
    return res.status(503).json({ error: 'AI_PROVIDER_UNAVAILABLE' });
  }

  const models = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
  let lastError: unknown;

  for (const client of clients) {
    for (const model of models) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction: instruction,
            temperature: 0.05,
            responseMimeType: 'application/json',
          },
        });

        const raw = response.text
          || response.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('')
          || '';
        const parsed = parseJson(raw);
        if (!parsed) throw new Error('AI_INVALID_RESPONSE');

        return res.status(200).json({
          report: normalizeReport(parsed),
          meta: {
            model,
            analyzedAt: new Date().toISOString(),
            officialContextAvailable: Boolean(officialContext),
          },
        });
      } catch (error) {
        lastError = error;
      }
    }
  }

  console.error('Admin analysis failed:', lastError);
  return res.status(503).json({ error: 'AI_ANALYSIS_UNAVAILABLE' });
}
