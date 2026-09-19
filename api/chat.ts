import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

type IncomingAttachment = {
  name?: string;
  type?: string;
  data?: string;
  isImage?: boolean;
};

type IncomingMessage = {
  role?: string;
  content?: string;
  attachments?: IncomingAttachment[];
};

function getGeminiClients(): GoogleGenAI[] {
  const apiKeys = [1, 2, 3, 4]
    .map((index) => process.env[`GEMINI_API_KEY${index === 1 ? '' : `_${index}`}`]?.trim())
    .filter((apiKey): apiKey is string => Boolean(apiKey));

  return apiKeys.map((apiKey) => new GoogleGenAI({ apiKey }));
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

function sanitizeMimeType(type?: string, name?: string): string {
  const mime = (type || '').trim().toLowerCase();
  if (mime && mime !== 'application/octet-stream') return mime;
  const filename = (name || '').toLowerCase();
  if (filename.endsWith('.pdf')) return 'application/pdf';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  if (filename.endsWith('.webp')) return 'image/webp';
  return 'application/pdf';
}

function toGeminiContents(messages: IncomingMessage[]) {
  return messages
    .map((message) => {
      const parts: any[] = [];
      const attachments = Array.isArray(message.attachments) ? message.attachments : [];

      for (const attachment of attachments) {
        const data = typeof attachment.data === 'string' ? attachment.data.trim() : '';
        if (!data) continue;
        parts.push({
          inlineData: {
            mimeType: sanitizeMimeType(attachment.type, attachment.name),
            data: data.includes(',') ? data.slice(data.indexOf(',') + 1) : data,
          },
        });
      }

      const text = typeof message.content === 'string' ? message.content.trim().slice(0, 12000) : '';
      if (text) parts.push({ text });
      if (parts.length === 0) return null;

      return {
        role: message.role === 'assistant' || message.role === 'model' ? 'model' : 'user',
        parts,
      };
    })
    .filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = (req.body ?? {}) as {
    message?: string;
    messages?: IncomingMessage[];
    history?: IncomingMessage[];
    systemInstruction?: string;
    targetCourt?: string;
    clientPersonName?: string;
  };

  const incomingMessages: IncomingMessage[] =
    Array.isArray(body.messages) && body.messages.length > 0
      ? body.messages
      : [
          ...(Array.isArray(body.history) ? body.history : []),
          ...(typeof body.message === 'string' && body.message.trim()
            ? [{ role: 'user', content: body.message }]
            : []),
        ];

  const contents = toGeminiContents(incomingMessages);
  if (contents.length === 0) {
    return res.status(400).json({ error: 'Invalid request payload.' });
  }

  try {
    const clients = getGeminiClients();
    if (clients.length === 0) {
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const clientInstruction =
      typeof body.systemInstruction === 'string' ? body.systemInstruction.trim().slice(0, 6000) : '';
    const contextInstruction = [
      SERVER_LEGAL_INSTRUCTION,
      body.targetCourt ? `الاختصاص المختار في الواجهة: ${String(body.targetCourt).slice(0, 120)}` : '',
      body.clientPersonName ? 'استخدم اسم صاحب الشأن عند الحاجة فقط ولا تكرر بياناته.' : '',
      clientInstruction ? `تعليمات مساحة العمل:\n${clientInstruction}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const models = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let response: any;
    let lastError: unknown;

    for (const ai of clients) {
      for (const model of models) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: contents as any,
            config: {
              systemInstruction: contextInstruction,
              temperature: 0.2,
            },
          });
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (response) break;
    }

    if (!response) {
      throw lastError || new Error('Gemini request failed.');
    }

    const reply =
      response.text ||
      ((response as any)?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') ?? '');

    if (!reply.trim()) {
      return res.status(502).json({ error: 'AI_EMPTY_RESPONSE' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ text: reply })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (error: any) {
    console.error('Gemini API Error:', error?.message || error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
