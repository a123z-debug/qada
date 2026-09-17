import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = (req.body ?? {}) as { message?: string; history?: Array<{ role: string; content: string }> };
  const { message, history = [] } = body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured in the Vercel environment variables.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
    });

    const reply =
      (response as any)?.text ??
      (response as any)?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') ??
      'عذراً، لم أتمكن من توليد رد مناسب في الوقت الحالي.';

    return res.status(200).json({
      reply,
      history: [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: reply },
      ],
    });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      error: error?.message || 'Internal Server Error',
    });
  }
}
