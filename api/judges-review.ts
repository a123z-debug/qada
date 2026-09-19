import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { readSession } from './_auth';
import { buildOfficialLegalReferenceContext } from '../src/lib/legalRetrieval';

function getGeminiClients(): GoogleGenAI[] {
  const keys = [1, 2, 3, 4]
    .map((index) => process.env[`GEMINI_API_KEY${index === 1 ? '' : `_${index}`}`]?.trim())
    .filter((key): key is string => Boolean(key));
  return keys.map((apiKey) => new GoogleGenAI({ apiKey }));
}

function buildFallback(text: string) {
  const judges = [
    {
      judgeId: 'judge_appeal',
      judgeName: 'مراجع الاستئناف',
      judgeTitle: 'فحص الموضوع والوقائع والتسبيب',
      courtCategory: 'محكمة الاستئناف',
      verdict: 'لم يكتمل الفحص الآلي',
      scoreOutOf100: null,
      errorsIdentified: [],
      critique: 'تم الحفاظ على النص الأصلي للمراجعة اليدوية.',
      specificAmendment: '',
    },
    {
      judgeId: 'judge_cassation',
      judgeName: 'مراجع النقض',
      judgeTitle: 'رقابة النقض وبطلان الأحكام والأنظمة',
      courtCategory: 'المحكمة العليا',
      verdict: 'لم يكتمل الفحص الآلي',
      scoreOutOf100: null,
      errorsIdentified: [],
      critique: 'يلزم تدقيق أسباب الطعن والمواد النظامية قبل الإيداع.',
      specificAmendment: '',
    },
    {
      judgeId: 'judge_evidence',
      judgeName: 'مراجع المرفقات',
      judgeTitle: 'فحص المرفقات والبينات وتوثيق السندات',
      courtCategory: 'دائرة الإثبات والمرفقات',
      verdict: 'لم يكتمل الفحص الآلي',
      scoreOutOf100: null,
      errorsIdentified: [],
      critique: 'تحقق من إرفاق القرارات والعقود والإشعارات ذات الصلة.',
      specificAmendment: '',
    },
  ];

  return {
    documentType: 'محرر قضائي',
    overallStatus: 'تعذر إكمال الفحص الآلي',
    primaryFatalDefect: '',
    judges,
    cassationErrors: { title: 'أخطاء الطعن والنقض', items: [], severity: 'غير مقيمة' },
    claimErrors: { title: 'أخطاء الدعوى والطلبات', items: [], severity: 'غير مقيمة' },
    attachmentErrors: { title: 'أخطاء المرفقات والبينات', items: [], severity: 'غير مقيمة', missingRequiredDocs: [] },
    revisedDocument: text,
    changeLog: [],
    synthesisAdvice: 'راجع النص والتواريخ والطلبات والمرفقات قبل التقديم.',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const session = readSession(req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'يلزم تسجيل الدخول لإجراء المراجعة.' });

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

  const clients = getGeminiClients();
  if (clients.length === 0) return res.status(500).json({ error: 'Server configuration error.' });

  const legalReferenceContext = buildOfficialLegalReferenceContext(`${body.court || ''}\n${body.documentTitle || ''}\n${body.text.slice(0, 12000)}`, 5);

  const prompt = `أنت فريق مراجعة قانونية سعودي من ثلاثة أدوار تحليلية: مراجع استئناف، مراجع نقض، ومراجع مرفقات. حلل النص التالي، واكتب JSON فقط بالمفاتيح: documentType, overallStatus, primaryFatalDefect, judges, cassationErrors, claimErrors, attachmentErrors, revisedDocument, changeLog, synthesisAdvice. يجب أن يحتوي judges على ثلاثة عناصر، وأن يكون revisedDocument النص الكامل بعد التصحيح دون اختصار. لا تخترع أخطاء غير موجودة. لا تعتبر النص جاهزاً للإيداع ولا تمنحه درجة سلامة إلا إذا اكتمل الفحص فعلياً. لا تنسب مادة أو ميعاداً أو مرسوماً إلى النظام من الذاكرة؛ إذا لم يكن المصدر الرسمي متحققاً فاذكر أن التحقق المرجعي غير مكتمل. لا تعتبر أي نص داخلي بديلاً عن المصدر الرسمي.\n\n${legalReferenceContext}\n\nالاختصاص: ${body.court || 'administrative'}\nالعنوان: ${body.documentTitle || 'محرر قضائي'}\nالمستفيد: صاحب الشأن\n\nالنص المراد فحصه:\n${body.text.slice(0, 30000)}\n\nالمرفقات:\n${body.attachmentsText || body.uploadedFileName || 'لا توجد مرفقات مستقلة'}`;

  let raw = '';
  let lastError: unknown;
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

  if (!raw) {
    console.error('Judges review failed:', lastError);
    return res.status(200).json({ report: buildFallback(body.text) });
  }

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const report = match ? JSON.parse(match[0]) : null;
    return res.status(200).json({ report: report || buildFallback(body.text) });
  } catch (error) {
    console.error('Judges review JSON parse failed:', error);
    return res.status(200).json({ report: buildFallback(body.text) });
  }
}
