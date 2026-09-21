import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.ts';

type Court = 'administrative' | 'general' | 'criminal';

type RateEntry = { count: number; resetAt: number };
const rateStore = new Map<string, RateEntry>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20;

function clientId(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded || req.socket?.remoteAddress || 'anonymous';
  return String(raw).split(',')[0].trim().slice(0, 120);
}

function allowRequest(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const current = rateStore.get(key);
  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= RATE_MAX) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
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

function parseJson(raw: string): any | null {
  const text = (raw || '').trim();
  if (!text) return null;
  const candidates = [
    text,
    text.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '').trim(),
  ];
  const match = text.match(/\{[\s\S]*\}/);
  if (match) candidates.push(match[0]);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

async function askAi(prompt: string): Promise<any | null> {
  const gatewayToken = getGatewayToken();
  if (gatewayToken) {
    try {
      const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.6-flash',
          models: ['google/gemini-3.5-flash-lite'],
          messages: [
            {
              role: 'system',
              content: 'أعد JSON صالحاً فقط. لا تضف مواد نظامية أو أرقام أنظمة أو أحكام قضائية.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.05,
          response_format: { type: 'json_object' },
          max_tokens: 2200,
        }),
      });
      if (response.ok) {
        const payload: any = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        const raw = typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('')
            : '';
        const parsed = parseJson(raw);
        if (parsed) return parsed;
      }
    } catch {}
  }

  const clients = getGeminiClients();
  const models = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  for (const client of clients) {
    for (const model of models) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.05,
            responseMimeType: 'application/json',
          },
        });
        const parsed = parseJson(response.text || '');
        if (parsed) return parsed;
      } catch {}
    }
  }

  return null;
}

function courtLabel(court: Court): string {
  if (court === 'criminal') return 'المحاكم الجزائية';
  if (court === 'general') return 'المحاكم العامة';
  return 'القضاء الإداري وديوان المظالم';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const limit = allowRequest(clientId(req));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: 'تم تجاوز حد الاستخدام المؤقت. حاول لاحقاً.' });
  }

  const body = (req.body ?? {}) as { story?: string; court?: Court };
  const story = typeof body.story === 'string' ? body.story.trim().slice(0, 18000) : '';
  const court: Court = body.court === 'general' || body.court === 'criminal'
    ? body.court
    : 'administrative';

  if (!story) {
    return res.status(400).json({ error: 'يُرجى كتابة ما حدث أو لصق النص.' });
  }

  const sourceBundle = runLegalSourceAgents([
    courtLabel(court),
    story,
  ].join('\n'));

  const prompt = [
    `الاختصاص: ${courtLabel(court)}`,
    'حوّل سرد المستخدم إلى تكييف عملي مبدئي دون اختراع سند قانوني.',
    'أعد JSON فقط بالشكل التالي:',
    '{"subject":"موضوع قانوني قصير ومحايد","requests":["طلبات إجرائية/موضوعية يمكن للمستخدم مراجعتها"]}',
    'مهم: لا تذكر أرقام مواد أو مراسيم أو أحكام؛ ستضاف المراجع الموثقة آلياً من طبقة مستقلة.',
    '',
    'سرد المستخدم:',
    story,
  ].join('\n');

  const ai = await askAi(prompt);
  if (!ai) {
    return res.status(503).json({ error: 'AI_PROVIDER_UNAVAILABLE' });
  }

  const subject = String(ai.subject || ai.disputedSubject || '').trim().slice(0, 600);
  const requests = Array.isArray(ai.requests)
    ? ai.requests.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 12)
    : [];

  if (!subject) {
    return res.status(502).json({ error: 'AI_INVALID_RESPONSE' });
  }

  const legalBases: string[] = [];
  const seen = new Set<string>();

  for (const packet of sourceBundle.packets) {
    for (const article of packet.verifiedArticles) {
      const item = `${article.system} — المادة ${article.article} — ${article.sourceUrl}`;
      if (!seen.has(item)) {
        seen.add(item);
        legalBases.push(item);
      }
      if (legalBases.length >= 8) break;
    }
    if (legalBases.length >= 8) break;
  }

  if (legalBases.length < 8) {
    for (const packet of sourceBundle.packets) {
      for (const reference of packet.references) {
        if (!reference.sourceUrl) continue;
        const item = [
          reference.name,
          reference.issueInstrument || '',
          reference.sourceUrl,
        ].filter(Boolean).join(' — ');
        if (!seen.has(item)) {
          seen.add(item);
          legalBases.push(item);
        }
        if (legalBases.length >= 8) break;
      }
      if (legalBases.length >= 8) break;
    }
  }

  return res.status(200).json({
    subject,
    legal_bases: legalBases,
    requests,
    disputedSubject: subject,
    legalBases: legalBases.map((item) => `- ${item}`).join('\n'),
    claimDemands: requests.map((item, index) => `${index + 1}. ${item}`).join('\n'),
    verification: {
      officialSources: sourceBundle.verification.officialSources,
      verifiedArticles: sourceBundle.verification.verifiedArticles,
      blockers: sourceBundle.verification.blockers,
      literalQuotationReady: sourceBundle.verification.literalQuotationReady,
      precedentCorpusReady: sourceBundle.verification.precedentCorpusReady,
    },
  });
}
