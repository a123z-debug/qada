import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.ts';
import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard.ts';
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

  const geminiKeys = [
    process.env.GEMINI_API_KEY?.trim(),
    process.env.GEMINI_API_KEY_2?.trim(),
    process.env.GEMINI_API_KEY_3?.trim(),
    process.env.GEMINI_API_KEY_4?.trim(),
    process.env.GOOGLE_API_KEY?.trim(),
  ].filter((value): value is string => Boolean(value));
  const gatewayToken =
    process.env.AI_GATEWAY_API_KEY?.trim()
    || process.env.VERCEL_OIDC_TOKEN?.trim()
    || '';

  if (geminiKeys.length === 0 && !gatewayToken) {
    return res.status(503).json({ error: 'AI_AUTH_UNAVAILABLE' });
  }

  type IncomingAttachment = {
    name?: string;
    type?: string;
    data?: string;
  };
  type IncomingMessage = {
    role?: string;
    content?: string;
    attachments?: IncomingAttachment[];
  };

  const body = (req.body ?? {}) as {
    message?: string;
    messages?: IncomingMessage[];
    history?: IncomingMessage[];
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

  const allowedMime = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
  const sanitizeAttachment = (attachment: IncomingAttachment) => {
    const name = String(attachment?.name || '').toLowerCase();
    let mimeType = String(attachment?.type || '').toLowerCase();
    if (!allowedMime.has(mimeType)) {
      if (name.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (name.endsWith('.png')) mimeType = 'image/png';
      else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (name.endsWith('.webp')) mimeType = 'image/webp';
    }
    const rawData = typeof attachment?.data === 'string' ? attachment.data.trim() : '';
    if (!allowedMime.has(mimeType) || !rawData) return null;
    return {
      mimeType,
      data: rawData.includes(',') ? rawData.slice(rawData.indexOf(',') + 1) : rawData,
      name: attachment?.name || 'مرفق',
    };
  };

  const messages = sourceMessages
    .map((item) => ({
      role: item.role === 'assistant' || item.role === 'model' ? 'assistant' : 'user',
      content: typeof item.content === 'string' ? item.content.trim().slice(0, 12000) : '',
      attachments: (Array.isArray(item.attachments) ? item.attachments : [])
        .map(sanitizeAttachment)
        .filter(Boolean) as Array<{ mimeType: string; data: string; name: string }>,
    }))
    .filter((item) => item.content || item.attachments.length > 0);

  if (!messages.length) {
    return res.status(400).json({ error: 'Invalid request payload.' });
  }

  const hasAttachments = messages.some((item) => item.attachments.length > 0);

  const retrievalQuery = [
    body.targetCourt || '',
    ...messages.filter((item) => item.role === 'user').map((item) => item.content),
  ].join('\n').slice(0, 26000);
  const sourceBundle = runLegalSourceAgents(retrievalQuery);

  const system = [
    SYSTEM_INSTRUCTION,
    body.targetCourt ? `الاختصاص المختار: ${String(body.targetCourt).slice(0, 160)}` : '',
    sourceBundle.context,
    'قواعد إخراج إضافية: لا تستخدم رابطاً أو رقم مادة أو مرسوماً أو قراراً أو حكماً جديداً خارج ما ورد في كلام المستخدم أو حزمة المصادر الرسمية. إذا كانت حزمة المصدر تحمل warning أو blocker فاذكر ذلك ولا تحوله إلى نتيجة قطعية.',
    'النص الحرفي الكامل للمواد غير معتمد من المستودع؛ لا تضع اقتباساً حرفياً إلا إذا كان وارداً في نص المستخدم نفسه.',
  ].filter(Boolean).join('\n\n');

  try {
    let reply = '';

    if (geminiKeys.length > 0) {
      const geminiContents = messages.map((item) => {
        const parts: any[] = [];
        if (item.content) parts.push({ text: item.content });
        for (const attachment of item.attachments) {
          parts.push({
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.data,
            },
          });
        }
        return {
          role: item.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      });

      const geminiModels = ['gemini-3.8-flash', 'gemini-3.5-flash'];

      for (const geminiKey of geminiKeys) {
        for (const model of geminiModels) {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: {
                'x-goog-api-key': geminiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: geminiContents,
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
            if (reply) break;
          } else {
            const detail = await response.text().catch(() => '');
            console.error('Gemini HTTP error:', response.status, model, detail.slice(0, 500));
          }
        }
        if (reply) break;
      }
    }

    if (!reply && gatewayToken && !hasAttachments) {
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
      return res.status(502).json({
        error: hasAttachments
          ? 'AI_ATTACHMENT_ANALYSIS_UNAVAILABLE'
          : 'AI_PROVIDER_REQUEST_FAILED',
      });
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
      auditLines.push(
        '',
        'حالة التحقق: توجد نقاط تحتاج مراجعة المصدر الرسمي قبل الاعتماد النهائي.'
      );
    }
    if (auditLines.length > 0) reply = [reply.trim(), ...auditLines].join('\n');

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
