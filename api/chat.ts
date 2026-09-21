import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.ts';
import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard.ts';
import { readSession } from './session.ts';

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
    const role = message.role === 'assistant' || message.role === 'model' ? 'assistant' : 'user';
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
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.6-flash',
      models: ['google/gemini-3.5-flash-lite'],
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
- عند ذكر سند قانوني، اذكر اسم النظام ورقم المادة والمصدر الرسمي إن كان متاحاً.
- لا تعتبر المستند سليماً أو جاهزاً للإيداع لمجرد تعذر التحليل.
- افصل بين ما هو مستخرج من المرفق وما هو استنتاج تحليلي.
- لا تُظهر أرقام الهوية أو البيانات الشخصية غير اللازمة.
- عند وجود مرفق، اقرأ المرفق أولاً وحدد نوعه وموضوعه واختصاصه قبل اقتراح أي سند نظامي.
- لا تفترض أن كل مستند يتعلق بالمادة (8) أو بالخدمة العسكرية أو ببدلات معينة.`;

type RateEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateEntry>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;
function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= RATE_MAX) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
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
    return { role: message.role === 'assistant' || message.role === 'model' ? 'model' : 'user', parts };
  }).filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }

  const session = readSession(req.headers?.cookie);
  if (!session) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }

  const forwarded = req.headers['x-forwarded-for'];
  const rawClientId = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded || req.socket?.remoteAddress || 'anonymous';
  const clientId = String(rawClientId).split(',')[0].trim().slice(0, 80);
  const limit = checkRateLimit(clientId);
  if (!limit.allowed) { res.setHeader('Retry-After', String(limit.retryAfterSeconds)); return res.status(429).json({ error: 'تم تجاوز حد الاستخدام المؤقت. حاول لاحقاً.' }); }

  const body = (req.body ?? {}) as { message?: string; messages?: IncomingMessage[]; history?: IncomingMessage[]; targetCourt?: string };
  const incomingMessages: IncomingMessage[] = Array.isArray(body.messages) && body.messages.length > 0 ? body.messages : [
    ...(Array.isArray(body.history) ? body.history : []),
    ...(typeof body.message === 'string' && body.message.trim() ? [{ role: 'user', content: body.message }] : []),
  ];
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
      'لا تستخدم رابطاً أو رقماً نظامياً جديداً خارج ما ورد في كلام المستخدم أو حزمة المصادر الرسمية. إذا كانت حزمة المصدر تحمل warning أو blocker فاذكر ذلك ولا تحوله إلى نتيجة قطعية.',
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
      const models = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
      let response: any;

      for (const ai of clients) {
        for (const model of models) {
          try {
            response = await ai.models.generateContent({
              model,
              contents: contents as any,
              config: { systemInstruction: contextInstruction, temperature: 0.2 },
            });
            break;
          } catch (error) {
            lastError = error;
          }
        }
        if (response) break;
      }

      reply = response?.text
        || response?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('')
        || '';
    }

    if (!reply.trim()) {
      throw lastError || new Error('No AI provider is currently available.');
    }

    const citationGuard = guardIntroducedLegalCitations(retrievalQuery, reply, sourceBundle.context);
    if (citationGuard.unsupportedMarkers.length > 0) {
      for (const marker of citationGuard.unsupportedMarkers) {
        reply = reply.split(marker).join(`${marker} [غير متحقق من حزمة المصادر الرسمية]`);
      }
    }

    const sourceLinks = Array.from(new Map(
      sourceBundle.packets
        .flatMap((packet) => packet.references)
        .filter((reference) => reference.sourceUrl)
        .map((reference) => [reference.sourceUrl, reference] as const)
    ).values()).slice(0, 4);

    const auditLines: string[] = [];
    if (sourceLinks.length > 0) {
      auditLines.push('', 'مصادر رسمية مرتبطة للتحقق:');
      for (const reference of sourceLinks) {
        auditLines.push(`- ${reference.name}: ${reference.sourceUrl}`);
      }
    }
    if (sourceBundle.verification.blockers.length > 0 || citationGuard.unsupportedMarkers.length > 0) {
      auditLines.push('', 'حالة التحقق: توجد نقاط تحتاج مراجعة المصدر الرسمي قبل الاعتماد النهائي.');
    }
    if (auditLines.length > 0) reply = [reply.trim(), ...auditLines].join('\n');

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ text: reply })}\n\n`); res.write('data: [DONE]\n\n'); return res.end();
  } catch (error: any) {
    console.error('AI provider error:', error?.message || error);
    return res.status(503).json({ error: 'AI_PROVIDER_UNAVAILABLE' });
  }
}
