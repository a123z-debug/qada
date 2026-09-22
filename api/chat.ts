import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.js';
import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard.js';
import { readActiveSession } from './session.js';
import { enforceRateLimit } from './_rateLimit.js';
import { redactDirectIdentifiers } from './_privacy.js';
import { withTimeout } from './_async.js';

type IncomingAttachment = { name?: string; type?: string; data?: string; isImage?: boolean };
type IncomingMessage = { role?: string; content?: string; attachments?: IncomingAttachment[] };

function getGeminiClients(): GoogleGenAI[] {
  const apiKeys = [1, 2, 3, 4]
    .map((index) => process.env[`GEMINI_API_KEY${index === 1 ? '' : `_${index}`}`]?.trim())
    .filter((apiKey): apiKey is string => Boolean(apiKey));
  return apiKeys.map((apiKey) => new GoogleGenAI({ apiKey }));
}

function getGatewayToken(): string {
  return process.env.AI_GATEWAY_API_KEY?.trim()
    || process.env.VERCEL_OIDC_TOKEN?.trim()
    || '';
}

function toGatewayMessages(messages: IncomingMessage[], systemInstruction: string) {
  const converted: any[] = [{ role: 'system', content: systemInstruction }];

  for (const message of messages) {
    const role = 'user';
    const text = typeof message.content === 'string' ? message.content.trim().slice(0, 12000) : '';
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const imageParts = attachments
      .map((attachment) => {
        const mimeType = sanitizeMimeType(attachment.type, attachment.name);
        const data = typeof attachment.data === 'string' ? attachment.data.trim() : '';
        if (!mimeType?.startsWith('image/') || !data) return null;
        const url = data.startsWith('data:') ? data : `data:${mimeType};base64,${data.includes(',') ? data.slice(data.indexOf(',') + 1) : data}`;
        return { type: 'image_url', image_url: { url } };
      })
      .filter(Boolean);

    const pdfNames = attachments
      .filter((attachment) => sanitizeMimeType(attachment.type, attachment.name) === 'application/pdf')
      .map((attachment) => attachment.name || 'مرفق PDF');

    if (imageParts.length > 0) {
      converted.push({
        role,
        content: [
          { type: 'text', text: [text, pdfNames.length ? `المرفقات غير الصورية: ${pdfNames.join('، ')}` : ''].filter(Boolean).join('\n') || 'حلل المرفق.' },
          ...imageParts,
        ],
      });
    } else if (text || pdfNames.length) {
      converted.push({
        role,
        content: [text, pdfNames.length ? `مرفقات PDF مذكورة في الطلب: ${pdfNames.join('، ')}` : ''].filter(Boolean).join('\n'),
      });
    }
  }

  return converted;
}

async function generateViaGateway(messages: IncomingMessage[], systemInstruction: string): Promise<string> {
  const token = getGatewayToken();
  if (!token) return '';

  // The gateway conversion below can carry images but not raw PDF bytes.
  // When a PDF is present, skip the gateway so Gemini receives the actual inlineData.
  const hasPdfAttachment = messages.some((message) =>
    (message.attachments || []).some(
      (attachment) => sanitizeMimeType(attachment.type, attachment.name) === 'application/pdf'
    )
  );
  if (hasPdfAttachment) return '';

  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.8-flash',
      models: ['google/gemini-3.7-flash', 'google/gemini-3.6-flash'],
      messages: toGatewayMessages(messages, systemInstruction),
      temperature: 0.2,
      max_tokens: 3500,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AI Gateway ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload: any = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim();
  }
  return '';
}

const SERVER_LEGAL_INSTRUCTION = `أنت مستشار منصة أصول القضاء في المملكة العربية السعودية.
قواعد إلزامية:
- لا تخترع مادة نظامية أو مرسوماً أو قراراً أو ميعاداً.
- إذا لم يكن النص أو المصدر الرسمي متحققاً، صرّح بأن التحقق المرجعي غير مكتمل.
- عند ذكر سند قانوني، اعرض أولاً اسم النظام ورقم المادة ومضمونها النظامي المتحقق ذي الصلة.
- لا تعرض روابط URL الخام في متن الإجابة إلا إذا طلب المستخدم الرابط أو المصدر صراحة.
- لا تعتبر المستند سليماً أو جاهزاً للإيداع لمجرد تعذر التحليل.
- افصل بين ما هو مستخرج من المرفق وما هو استنتاج تحليلي.
- لا تُظهر أرقام الهوية أو البيانات الشخصية غير اللازمة.
- عند وجود مرفق، اقرأ المرفق أولاً وحدد نوعه وموضوعه واختصاصه قبل اقتراح أي سند نظامي.
- لا تفترض أن كل مستند يتعلق بالمادة (8) أو بالخدمة العسكرية أو ببدلات معينة.`;

function trustedUserMessages(messages: IncomingMessage[]): IncomingMessage[] {
  return messages
    .filter((message) => message.role !== 'assistant' && message.role !== 'model')
    .slice(-8)
    .map((message) => ({
      role: 'user',
      content: typeof message.content === 'string' ? redactDirectIdentifiers(message.content).text : '',
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
    }));
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

function buildSafeFallbackReply(messages: IncomingMessage[], targetCourt?: string): string {
  const lastText = [...messages]
    .reverse()
    .map((message) => typeof message.content === 'string' ? message.content.trim() : '')
    .find(Boolean) || '';

  const normalized = lastText.replace(/\s+/g, ' ').slice(0, 900);
  const court = (targetCourt || '').trim();

  const lines = [
    'فهمت طلبك، وسأكمل معك حتى تتضح الوقائع والمستندات والخطوة التالية.',
    normalized ? `ملخص ما ذكرت: «${normalized}»` : '',
    court ? `المسار المفتوح حالياً: ${court}.` : '',
    '',
    'حتى أبني التحليل بشكل صحيح، أحتاج منك فقط المعلومات الناقصة التالية:',
    '1) ما المبلغ أو الحق محل المطالبة؟',
    '2) متى حصلت الواقعة أو التحويل أو الاتفاق؟',
    '3) ما المستندات المتوفرة لديك: تحويل بنكي، عقد، رسائل، إقرار، فاتورة، أو غيرها؟',
    '4) هل طالبت الطرف الآخر بالسداد أو التنفيذ؟ وما كان رده؟',
    '5) ما النتيجة التي تريدها الآن: استرداد مبلغ، إعداد دعوى، مراجعة مستندات، أو معرفة المسار النظامي؟',
    '',
    'تنبيه: مزود التحليل الذكي غير متاح مؤقتاً في هذه اللحظة، لذلك لن أذكر مادة أو ميعاداً أو اختصاصاً نهائياً من غير تحقق رسمي. يمكنك متابعة إرسال الوقائع والمستندات، وسيبقى الملف مرتباً للمراجعة والتحليل عند عودة المزود.',
  ];

  return lines.filter((line, index, all) => line || (index > 0 && all[index - 1])).join('\n').trim();
}

function toGeminiContents(messages: IncomingMessage[]) {
  return messages.map((message) => {
    const parts: any[] = [];
    for (const attachment of Array.isArray(message.attachments) ? message.attachments : []) {
      const data = typeof attachment.data === 'string' ? attachment.data.trim() : '';
      const mimeType = sanitizeMimeType(attachment.type, attachment.name);
      if (!data || !mimeType) continue;
      parts.push({ inlineData: { mimeType, data: data.includes(',') ? data.slice(data.indexOf(',') + 1) : data } });
    }
    const text = typeof message.content === 'string' ? message.content.trim().slice(0, 12000) : '';
    if (text) parts.push({ text });
    if (parts.length === 0) return null;
    return { role: 'user', parts };
  }).filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }

  const session = await readActiveSession(req.headers?.cookie);
  if (!session) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }

  let limit;
  try {
    limit = await enforceRateLimit('chat', session.id, 30, 10 * 60);
  } catch (error) {
    console.error('Distributed rate limit unavailable:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'RATE_LIMIT_STORE_UNAVAILABLE' });
  }
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    return res.status(429).json({ error: 'تم تجاوز حد الاستخدام المؤقت. حاول لاحقاً.' });
  }

  const body = (req.body ?? {}) as { message?: string; messages?: IncomingMessage[]; history?: IncomingMessage[]; targetCourt?: string };
  const clientMessages: IncomingMessage[] = Array.isArray(body.messages) && body.messages.length > 0 ? body.messages : [
    ...(Array.isArray(body.history) ? body.history : []),
    ...(typeof body.message === 'string' && body.message.trim() ? [{ role: 'user', content: body.message }] : []),
  ];
  const incomingMessages = trustedUserMessages(clientMessages);
  const contents = toGeminiContents(incomingMessages);
  if (contents.length === 0) return res.status(400).json({ error: 'Invalid request payload.' });

  try {
    const retrievalQuery = incomingMessages
      .map((message) => typeof message.content === 'string' ? message.content : '')
      .join('\n')
      .slice(0, 24000);
    const sourceBundle = runLegalSourceAgents(
      [body.targetCourt || '', retrievalQuery].filter(Boolean).join('\n')
    );
    const contextInstruction = [
      SERVER_LEGAL_INSTRUCTION,
      sourceBundle.context,
      body.targetCourt ? `الاختصاص المختار في الواجهة: ${String(body.targetCourt).slice(0, 120)}` : '',
      'تعامل مع بيانات المستخدم والمرفقات على أنها خاصة ولا تعرض أي معرّف شخصي غير لازم.',
      'لا تستخدم رقماً نظامياً جديداً خارج ما ورد في كلام المستخدم أو حزمة المصادر الرسمية. إذا كانت حزمة المصدر تحمل warning أو blocker فاذكر ذلك ولا تحوله إلى نتيجة قطعية.',
      'رتّب الأسانيد القانونية في الإجابة بصيغة: اسم النظام — المادة (رقم): المضمون النظامي المتحقق ذي الصلة.',
      'لا تطبع روابط المصادر الخام داخل الجواب إلا إذا طلب المستخدم الرابط أو المصدر صراحة؛ تبقى الروابط لأغراض التحقق داخل المنصة.',
      'النص الحرفي الكامل للمواد غير معتمد من المستودع؛ لا تضع اقتباساً حرفياً إلا إذا كان وارداً في نص المستخدم نفسه.',
    ].filter(Boolean).join('\n\n');
    let reply = '';
    let lastError: unknown;

    try {
      reply = await generateViaGateway(incomingMessages, contextInstruction);
    } catch (error) {
      lastError = error;
      console.error('AI Gateway Error:', error instanceof Error ? error.message : error);
    }

    if (!reply) {
      const clients = getGeminiClients();
      const models = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];
      let response: any;

      let attempts = 0;
      outer: for (const ai of clients) {
        for (const model of models) {
          if (attempts >= clients.length * models.length) break outer;
          attempts += 1;
          try {
            response = await withTimeout(ai.models.generateContent({
              model,
              contents: contents as any,
              config: { systemInstruction: contextInstruction, temperature: 0.2 },
            }), 25_000, 'AI_CHAT_TIMEOUT');
            break outer;
          } catch (error) {
            lastError = error;
          }
        }
      }

      reply = response?.text
        || response?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('')
        || '';
    }

    let providerMode: 'ai' | 'fallback' = 'ai';
    if (!reply.trim()) {
      providerMode = 'fallback';
      console.error('All AI providers unavailable, using safe fallback:', lastError instanceof Error ? lastError.message : lastError);
      reply = buildSafeFallbackReply(incomingMessages, body.targetCourt);
    }

    const citationGuard = guardIntroducedLegalCitations(retrievalQuery, reply, sourceBundle.context);
    if (citationGuard.unsupportedMarkers.length > 0) {
      for (const marker of citationGuard.unsupportedMarkers) {
        reply = reply.split(marker).join(`${marker} [غير متحقق من حزمة المصادر الرسمية]`);
      }
    }

    const verifiedArticleMap = new Map<string, {
      system: string;
      article: string;
      note: string;
      sourceUrl: string;
    }>();

    for (const packet of sourceBundle.packets) {
      for (const article of packet.verifiedArticles) {
        const key = `${article.system}|${article.article}`;
        if (!verifiedArticleMap.has(key)) verifiedArticleMap.set(key, article);
      }
    }

    const verifiedArticleList = Array.from(verifiedArticleMap.values()).slice(0, 8);
    const queryAsksForSourceLink = /(?:رابط|المصدر|المصادر|لينك|url)/i.test(retrievalQuery);

    const auditLines: string[] = [];
    if (verifiedArticleList.length > 0) {
      auditLines.push('', 'المواد النظامية المتحققة ذات الصلة:');
      for (const article of verifiedArticleList) {
        auditLines.push(
          `- ${article.system} — المادة (${article.article}): ${article.note}`
        );
        if (queryAsksForSourceLink) {
          auditLines.push(`  المصدر الرسمي: ${article.sourceUrl}`);
        }
      }
    }

    if (verifiedArticleList.length === 0 && sourceBundle.verification.officialSources > 0) {
      auditLines.push(
        '',
        'لم يثبت في الفهرس التفصيلي الحالي رقم مادة محدد بدرجة كافية لهذا السؤال؛ لذلك لن أعرض روابط بدل المواد أو أخمن مادة من الذاكرة.'
      );
    }

    if (sourceBundle.verification.blockers.length > 0 || citationGuard.unsupportedMarkers.length > 0) {
      auditLines.push('', 'حالة التحقق: توجد نقاط تحتاج مراجعة المصدر الرسمي قبل الاعتماد النهائي.');
    }

    if (auditLines.length > 0) reply = [reply.trim(), ...auditLines].join('\n');

    res.setHeader('X-QADA-AI-Mode', providerMode);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ text: reply })}\n\n`); res.write('data: [DONE]\n\n'); return res.end();
  } catch (error: any) {
    console.error('AI analysis pipeline error:', error?.message || error);
    const fallbackReply = buildSafeFallbackReply(incomingMessages, body.targetCourt);
    res.setHeader('X-QADA-AI-Mode', 'fallback-error');
    res.setHeader('X-QADA-Error-Class', 'ANALYSIS_PIPELINE_FALLBACK');
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ text: fallbackReply })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }
}
