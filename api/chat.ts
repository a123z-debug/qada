import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

function getGeminiClients(): GoogleGenAI[] {
  const apiKeys = [1, 2, 3, 4]
    .map((index) => process.env[`GEMINI_API_KEY${index === 1 ? '' : `_${index}`}`]?.trim())
    .filter((apiKey): apiKey is string => Boolean(apiKey));

  return apiKeys.map((apiKey) => new GoogleGenAI({ apiKey }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // الحماية الأولى: منع أي طلبات غير POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = (req.body ?? {}) as {
    message?: string;
    messages?: Array<{ role?: string; content?: string }>;
    history?: Array<{ role: string; content: string }>;
    systemInstruction?: string;
  };
  const { message, messages = [], history = [], systemInstruction = '' } = body;
  const messageText = message || messages.map((item) => `${item.role || 'user'}: ${item.content || ''}`).join('\n\n');

  // الحماية الثانية: التحقق من نوع الرسالة وحذف الفراغات وتحديد حجمها
  if (!messageText || typeof messageText !== 'string') {
    return res.status(400).json({ error: 'Invalid request payload.' });
  }

  const sanitizedMessage = messageText.trim().slice(0, 12000);
  if (!sanitizedMessage) {
    return res.status(400).json({ error: 'Invalid request payload.' });
  }

  try {
    const clients = getGeminiClients();
    if (clients.length === 0) {
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const models = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let response: any;
    let lastError: unknown;
    for (const ai of clients) {
      for (const model of models) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: systemInstruction
              ? `${systemInstruction.trim()}\n\n${sanitizedMessage}`
              : sanitizedMessage,
          });
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (response) {
        break;
      }
    }

    if (!response) {
      throw lastError || new Error('Gemini request failed.');
    }

    const reply =
      response.text ||
      ((response as any)?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') ??
        '') ||
      'عذراً، لم أتمكن من توليد رد مناسب في الوقت الحالي.';

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
