const SYSTEM_INSTRUCTION = `أنت المستشار الذكي لمنصة أصول القضاء في المملكة العربية السعودية.
التزم بالدقة والتحفظ القانوني:
- لا تخترع مادة نظامية أو مرسوماً أو قراراً أو ميعاداً.
- إذا لم يكن لديك نص رسمي متحقق منه، صرّح أن التحقق المرجعي غير مكتمل.
- لا تعرض بيانات شخصية غير لازمة.
- افصل بين الوقائع التي يذكرها المستخدم وبين التحليل والاستنتاج.`;

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const geminiKey =
    process.env.GEMINI_API_KEY?.trim()
    || process.env.GOOGLE_API_KEY?.trim()
    || '';
  const gatewayToken =
    process.env.AI_GATEWAY_API_KEY?.trim()
    || process.env.VERCEL_OIDC_TOKEN?.trim()
    || '';

  if (!geminiKey && !gatewayToken) {
    return res.status(503).json({ error: 'AI_AUTH_UNAVAILABLE' });
  }

  const body = (req.body ?? {}) as {
    message?: string;
    messages?: Array<{ role?: string; content?: string }>;
    history?: Array<{ role?: string; content?: string }>;
    targetCourt?: string;
  };

  const sourceMessages = Array.isArray(body.messages) && body.messages.length
    ? body.messages
    : [
        ...(Array.isArray(body.history) ? body.history : []),
        ...(typeof body.message === 'string' && body.message.trim()
          ? [{ role: 'user', content: body.message }]
          : []),
      ];

  const messages = sourceMessages
    .map((item) => ({
      role: item.role === 'assistant' || item.role === 'model' ? 'assistant' : 'user',
      content: typeof item.content === 'string' ? item.content.trim().slice(0, 12000) : '',
    }))
    .filter((item) => item.content);

  if (!messages.length) {
    return res.status(400).json({ error: 'Invalid request payload.' });
  }

  const system = [
    SYSTEM_INSTRUCTION,
    body.targetCourt ? `الاختصاص المختار: ${String(body.targetCourt).slice(0, 160)}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    let reply = '';

    if (geminiKey) {
      const transcript = [
        system,
        ...messages.map((item) => `${item.role === 'assistant' ? 'المستشار' : 'المستخدم'}: ${item.content}`),
      ].join('\n\n');

      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': geminiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: transcript }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
          }),
        },
      );

      if (response.ok) {
        const payload: any = await response.json();
        reply = payload?.candidates?.[0]?.content?.parts
          ?.map((part: any) => typeof part?.text === 'string' ? part.text : '')
          .join('')
          .trim() || '';
      } else {
        const detail = await response.text().catch(() => '');
        console.error('Gemini HTTP error:', response.status, detail.slice(0, 500));
      }
    }

    if (!reply && gatewayToken) {
      const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.6-flash',
          models: ['google/gemini-3.5-flash-lite'],
          messages: [{ role: 'system', content: system }, ...messages],
          temperature: 0.2,
          max_tokens: 3000,
        }),
      });

      if (response.ok) {
        const payload: any = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        reply = typeof content === 'string' ? content.trim() : '';
      } else {
        const detail = await response.text().catch(() => '');
        console.error('AI Gateway HTTP error:', response.status, detail.slice(0, 500));
      }
    }

    if (!reply) {
      return res.status(502).json({ error: 'AI_PROVIDER_REQUEST_FAILED' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.write(`data: ${JSON.stringify({ text: reply.trim() })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (error) {
    console.error('AI runtime error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'AI_RUNTIME_ERROR' });
  }
}
