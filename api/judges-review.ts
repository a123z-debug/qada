import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.js';
import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard.js';
import { readActiveSession } from './session.js';
import { enforceRateLimit } from './_rateLimit.js';
import { redactDirectIdentifiers } from './_privacy.js';
import { withTimeout } from './_async.js';
import { USER_AI_MODELS, isQuotaError, isModelCoolingDown, markModelQuotaError } from './_aiRuntime.js';

type IncomingAttachment = {
  name?: string;
  type?: string;
  data?: string;
};

function normalizeAttachment(att: IncomingAttachment): { inlineData: { mimeType: string; data: string } } | null {
  const data = typeof att?.data === 'string' ? att.data.trim() : '';
  if (!data) return null;

  const name = String(att?.name || '').toLowerCase();
  let mimeType = String(att?.type || '').trim().toLowerCase();
  if (mimeType === 'application/octet-stream' || !mimeType.includes('/')) {
    if (name.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (name.endsWith('.png')) mimeType = 'image/png';
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (name.endsWith('.webp')) mimeType = 'image/webp';
  }

  if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) return null;
  const base64 = data.startsWith('data:') && data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
  return { inlineData: { mimeType, data: base64 } };
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

async function generateReviewViaGateway(prompt: string): Promise<string> {
  const token = getGatewayToken();
  if (!token) return '';

  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(25_000),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.5-flash',
      models: ['google/gemini-3.5-flash-lite', 'google/gemini-3.1-flash-lite', 'google/gemini-3.6-flash'],
      messages: [
        { role: 'system', content: 'أعد JSON صالحاً فقط دون أي نص خارج JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 7000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AI Gateway ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload: any = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const session = await readActiveSession(req.headers?.cookie);
  if (!session) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }

  try {
    const limit = await enforceRateLimit('judges-review', session.id, 20, 10 * 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }
  } catch (error) {
    console.error('Judges-review rate limit unavailable:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'RATE_LIMIT_STORE_UNAVAILABLE' });
  }

  const body = (req.body ?? {}) as {
    text?: string;
    court?: string;
    documentTitle?: string;
    clientName?: string;
    attachmentsText?: string;
    uploadedFileName?: string;
    attachments?: IncomingAttachment[];
  };

  if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
    return res.status(400).json({ error: 'نص المذكرة القضائية مطلوب.' });
  }

  const safeText = redactDirectIdentifiers(body.text).text;
  const safeAttachmentsText = redactDirectIdentifiers(String(body.attachmentsText || '')).text;

  const attachmentParts = (Array.isArray(body.attachments) ? body.attachments : [])
    .map(normalizeAttachment)
    .filter((part): part is { inlineData: { mimeType: string; data: string } } => Boolean(part));

  const sourceBundle = runLegalSourceAgents(
    `${body.court || ''}\n${body.documentTitle || ''}\n${safeText.slice(0, 16000)}`,
  );
  const legalReferenceContext = [
    sourceBundle.context,
    `المصادر الرسمية الفريدة: ${sourceBundle.verification.officialSources}`,
    `المواد المفهرسة المتحقق من وجودها: ${sourceBundle.verification.verifiedArticles}`,
    'النص الحرفي الكامل غير معتمد من المستودع؛ أي اقتباس حرفي يحتاج مطابقة المصدر الرسمي.',
    'قاعدة السوابق القضائية الرسمية الكاملة غير جاهزة؛ لا تنسب رقماً أو مبدأً إلى حكم غير موجود صراحة في حزمة المصدر.',
  ].join('\n\n');

  const prompt = `أنت فريق مراجعة قانونية سعودي من ثلاثة أدوار تحليلية: مراجع استئناف، مراجع نقض، ومراجع مرفقات. حلل النص التالي، واكتب JSON فقط بالمفاتيح: documentType, overallStatus, primaryFatalDefect, judges, cassationErrors, claimErrors, attachmentErrors, revisedDocument, changeLog, synthesisAdvice. يجب أن يحتوي judges على ثلاثة عناصر، وأن يكون revisedDocument النص الكامل بعد التصحيح دون اختصار. لا تخترع أخطاء غير موجودة. لا تعتبر النص جاهزاً للإيداع ولا تمنحه درجة سلامة إلا إذا اكتمل الفحص فعلياً. لا تنسب مادة أو ميعاداً أو مرسوماً أو قراراً أو حكماً قضائياً إلى النظام من الذاكرة. لا تضف في revisedDocument أي سند قانوني جديد ما لم يكن موجوداً أصلاً في النص أو مثبتاً صراحة في حزمة المصادر الرسمية. إذا لم يكن المصدر الرسمي متحققاً فاذكر أن التحقق المرجعي غير مكتمل، ولا تعتبر أي نص داخلي بديلاً عن المصدر الرسمي.\n\n${legalReferenceContext}\n\nالاختصاص: ${body.court || 'administrative'}\nالعنوان: ${body.documentTitle || 'محرر قضائي'}\nالمستفيد: صاحب الشأن\n\nالنص المراد فحصه:\n${safeText.slice(0, 30000)}\n\nالمرفقات:\n${safeAttachmentsText || body.uploadedFileName || 'لا توجد مرفقات مستقلة'}`;

  let raw = '';
  let lastError: unknown;

  try {
    // The gateway request is text-only here. If binary evidence exists, use Gemini
    // directly so the review agent actually reads the PDF/image bytes.
    raw = attachmentParts.length === 0 ? await generateReviewViaGateway(prompt) : '';
  } catch (error) {
    lastError = error;
    console.error('AI Gateway review failed:', error instanceof Error ? error.message : error);
  }

  if (!raw) {
    const clients = getGeminiClients();
    const models = USER_AI_MODELS;

    let attempts = 0;
    outer: for (const model of models) {
        if (isModelCoolingDown(model)) continue;
      for (const client of clients) {
        if (attempts >= clients.length * models.length) break outer;
        attempts += 1;
        try {
          const response = await withTimeout(client.models.generateContent({
            model,
            contents: attachmentParts.length > 0
              ? [{ role: 'user', parts: [...attachmentParts, { text: prompt }] }]
              : prompt,
          }), 28_000, 'AI_REVIEW_TIMEOUT');
          raw = response.text?.trim() || '';
          if (raw) break outer;
        } catch (error) {
          lastError = error;
          if (isQuotaError(error)) {
          markModelQuotaError(model, error);
          break;
        }
        }
      }
    }
  }

  if (!raw) {
    console.error('Judges review failed:', lastError);
    return res.status(503).json({ error: 'AI_REVIEW_UNAVAILABLE' });
  }

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: 'AI_INVALID_RESPONSE' });
    const report = JSON.parse(match[0]);
    const revisedDocument = typeof report?.revisedDocument === 'string' ? report.revisedDocument : '';
    const citationGuard = revisedDocument
      ? guardIntroducedLegalCitations(safeText, revisedDocument, legalReferenceContext)
      : { introducedMarkers: [], unsupportedMarkers: [], blocked: false };

    if (citationGuard.blocked) {
      report.revisedDocument = body.text;
      report.overallStatus = 'معيب بحاجة لتصحيح';
      report.changeLog = Array.isArray(report.changeLog) ? report.changeLog : [];
      report.changeLog.push('أوقفت بوابة التحقق تطبيق الصياغة المنقحة لأنها أدخلت إحالات قانونية جديدة غير مثبتة في حزمة المصادر الرسمية.');
      report.synthesisAdvice = [
        String(report.synthesisAdvice || ''),
        'تمت إعادة revisedDocument إلى النص الأصلي بسبب أسانيد قانونية جديدة غير متحققة. راجع المصادر الرسمية ثم أعد الفحص.',
      ].filter(Boolean).join('\n');
    }

    return res.status(200).json({
      report,
      sourceAudit: {
        officialSources: sourceBundle.verification.officialSources,
        verifiedArticles: sourceBundle.verification.verifiedArticles,
        blockers: sourceBundle.verification.blockers,
        literalQuotationReady: sourceBundle.verification.literalQuotationReady,
        precedentCorpusReady: sourceBundle.verification.precedentCorpusReady,
        introducedMarkers: citationGuard.introducedMarkers,
        unsupportedMarkers: citationGuard.unsupportedMarkers,
        blockedRevision: citationGuard.blocked,
      },
      sourcePackets: sourceBundle.packets,
    });
  } catch (error) {
    console.error('Judges review JSON parse failed:', error);
    return res.status(502).json({ error: 'AI_INVALID_RESPONSE' });
  }
}
