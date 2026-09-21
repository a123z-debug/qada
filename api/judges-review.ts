import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.ts';
import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard.ts';

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
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.6-flash',
      models: ['google/gemini-3.5-flash-lite'],
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

  const body = (req.body ?? {}) as {
    text?: string;
    court?: string;
    documentTitle?: string;
    clientName?: string;
    attachmentsText?: string;
    uploadedFileName?: string;
  };

  if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
    return res.status(400).json({ error: 'نص المذكرة القضائية مطلوب.' });
  }

  const sourceBundle = runLegalSourceAgents(
    `${body.court || ''}\n${body.documentTitle || ''}\n${body.text.slice(0, 16000)}`,
  );
  const legalReferenceContext = [
    sourceBundle.context,
    `المصادر الرسمية الفريدة: ${sourceBundle.verification.officialSources}`,
    `المواد المفهرسة المتحقق من وجودها: ${sourceBundle.verification.verifiedArticles}`,
    'النص الحرفي الكامل غير معتمد من المستودع؛ أي اقتباس حرفي يحتاج مطابقة المصدر الرسمي.',
    'قاعدة السوابق القضائية الرسمية الكاملة غير جاهزة؛ لا تنسب رقماً أو مبدأً إلى حكم غير موجود صراحة في حزمة المصدر.',
  ].join('\n\n');

  const prompt = `أنت فريق مراجعة قانونية سعودي من ثلاثة أدوار تحليلية: مراجع استئناف، مراجع نقض، ومراجع مرفقات. حلل النص التالي، واكتب JSON فقط بالمفاتيح: documentType, overallStatus, primaryFatalDefect, judges, cassationErrors, claimErrors, attachmentErrors, revisedDocument, changeLog, synthesisAdvice. يجب أن يحتوي judges على ثلاثة عناصر، وأن يكون revisedDocument النص الكامل بعد التصحيح دون اختصار. لا تخترع أخطاء غير موجودة. لا تعتبر النص جاهزاً للإيداع ولا تمنحه درجة سلامة إلا إذا اكتمل الفحص فعلياً. لا تنسب مادة أو ميعاداً أو مرسوماً أو قراراً أو حكماً قضائياً إلى النظام من الذاكرة. لا تضف في revisedDocument أي سند قانوني جديد ما لم يكن موجوداً أصلاً في النص أو مثبتاً صراحة في حزمة المصادر الرسمية. إذا لم يكن المصدر الرسمي متحققاً فاذكر أن التحقق المرجعي غير مكتمل، ولا تعتبر أي نص داخلي بديلاً عن المصدر الرسمي.\n\n${legalReferenceContext}\n\nالاختصاص: ${body.court || 'administrative'}\nالعنوان: ${body.documentTitle || 'محرر قضائي'}\nالمستفيد: صاحب الشأن\n\nالنص المراد فحصه:\n${body.text.slice(0, 30000)}\n\nالمرفقات:\n${body.attachmentsText || body.uploadedFileName || 'لا توجد مرفقات مستقلة'}`;

  let raw = '';
  let lastError: unknown;

  try {
    raw = await generateReviewViaGateway(prompt);
  } catch (error) {
    lastError = error;
    console.error('AI Gateway review failed:', error instanceof Error ? error.message : error);
  }

  if (!raw) {
    const clients = getGeminiClients();
    const models = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    for (const client of clients) {
      for (const model of models) {
        try {
          const response = await client.models.generateContent({ model, contents: prompt });
          raw = response.text?.trim() || '';
          if (raw) break;
        } catch (error) {
          lastError = error;
        }
      }
      if (raw) break;
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
      ? guardIntroducedLegalCitations(body.text, revisedDocument, legalReferenceContext)
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

    const blockedAmendmentMarkers = new Set<string>();
    if (Array.isArray(report?.judges)) {
      for (const judge of report.judges) {
        const amendment = typeof judge?.specificAmendment === 'string'
          ? judge.specificAmendment.trim()
          : '';
        if (!amendment) continue;

        const amendmentGuard = guardIntroducedLegalCitations(
          body.text,
          amendment,
          legalReferenceContext,
        );

        if (amendmentGuard.blocked) {
          for (const marker of amendmentGuard.unsupportedMarkers) {
            blockedAmendmentMarkers.add(marker);
          }
          judge.specificAmendment = '';
          judge.errorsIdentified = Array.isArray(judge.errorsIdentified)
            ? judge.errorsIdentified
            : [];
          judge.errorsIdentified.push(
            'حُجب تعديل مقترح لأنه أدخل إحالة قانونية جديدة لم تثبت في حزمة المصادر الرسمية.'
          );
        }
      }
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
        blockedSpecificAmendments: blockedAmendmentMarkers.size,
        blockedAmendmentMarkers: Array.from(blockedAmendmentMarkers),
      },
      sourcePackets: sourceBundle.packets,
    });
  } catch (error) {
    console.error('Judges review JSON parse failed:', error);
    return res.status(502).json({ error: 'AI_INVALID_RESPONSE' });
  }
}
