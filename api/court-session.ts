import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { readActiveSession } from './session.js';
import { enforceRateLimit } from './_rateLimit.js';
import { withTimeout } from './_async.js';
import { USER_AI_MODELS, isQuotaError, isModelCoolingDown, markModelQuotaError } from './_aiRuntime.js';
import {
  CourtStageError,
  parseCourtStageRequest,
  runCourtStage,
  type CourtGenerator,
} from './_courtEngine.js';
import { buildCourtRunSnapshot, recordCourtSessionRun } from './_courtTelemetry.js';

// Each request runs exactly one courtroom stage (defense, prosecution or bench).
// The browser chains the stages, so every request stays inside serverless limits.
const STAGE_BUDGET_MS = 55_000;
const CALL_TIMEOUT_MS = 45_000;
const MIN_ATTEMPT_MS = 6_000;

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

async function generateViaGateway(prompt: string, temperature: number, timeoutMs: number): Promise<string> {
  const token = getGatewayToken();
  if (!token) return '';

  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.5-flash',
      models: ['google/gemini-3.6-flash', 'google/gemini-3.5-flash-lite', 'google/gemini-3.1-flash-lite'],
      messages: [
        { role: 'system', content: 'أعد JSON صالحاً فقط دون أي نص خارج JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature,
      response_format: { type: 'json_object' },
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AI Gateway ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload: any = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim();
  }
  return '';
}

function createCourtGenerator(deadlineAt: number): CourtGenerator {
  const remaining = () => deadlineAt - Date.now();

  return async (prompt, { temperature, attachments }) => {
    let lastError: unknown;

    // The gateway is text-only; binary evidence must reach Gemini directly.
    if (attachments.length === 0 && getGatewayToken() && remaining() > MIN_ATTEMPT_MS) {
      try {
        const reply = await generateViaGateway(prompt, temperature, Math.min(CALL_TIMEOUT_MS, remaining()));
        if (reply) return reply;
      } catch (error) {
        lastError = error;
      }
    }

    const clients = getGeminiClients();
    outer: for (const model of USER_AI_MODELS) {
      if (isModelCoolingDown(model)) continue;
      for (const client of clients) {
        const budget = Math.min(CALL_TIMEOUT_MS, remaining());
        if (budget < MIN_ATTEMPT_MS) break outer;
        try {
          const response = await withTimeout(client.models.generateContent({
            model,
            contents: attachments.length > 0
              ? [{ role: 'user', parts: [...attachments, { text: prompt }] }]
              : prompt,
            config: { temperature, responseMimeType: 'application/json', maxOutputTokens: 8192 },
          }), budget, 'AI_COURT_TIMEOUT');
          const reply = response.text?.trim() || '';
          if (reply) return reply;
        } catch (error) {
          lastError = error;
          if (isQuotaError(error)) {
            markModelQuotaError(model, error);
            break;
          }
        }
      }
    }

    if (lastError) {
      console.error('Court session providers unavailable:', lastError instanceof Error ? lastError.message : lastError);
    }
    return '';
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await readActiveSession(req.headers?.cookie);
  if (!session) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }

  try {
    // A full session is up to 3 rounds × 3 stages.
    const limit = await enforceRateLimit('court-session', session.id, 45, 10 * 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }
  } catch (error) {
    console.error('Court session rate limit unavailable:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'RATE_LIMIT_STORE_UNAVAILABLE' });
  }

  const parsed = parseCourtStageRequest(req.body);
  if (parsed.ok === false) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const startedAt = Date.now();
    const result = await runCourtStage(
      parsed.input,
      createCourtGenerator(startedAt + STAGE_BUDGET_MS),
      parsed.attachments,
    );

    // A finished session lights up the court agents in the admin room. Telemetry never delays or breaks the user.
    if (result.stage === 'bench' && result.decision.nextStep !== 'revise' && parsed.input.defense && parsed.input.prosecution) {
      try {
        await withTimeout(recordCourtSessionRun(buildCourtRunSnapshot({
          systemId: parsed.input.systemId,
          levelId: parsed.input.levelId,
          round: result.round,
          defense: parsed.input.defense,
          prosecution: parsed.input.prosecution,
          ruling: result.ruling,
          decision: result.decision,
          findings: result.findings,
          benchDurationMs: Date.now() - startedAt,
        })), 800, 'COURT_TELEMETRY_TIMEOUT');
      } catch (telemetryError) {
        console.warn('Court telemetry skipped:', telemetryError instanceof Error ? telemetryError.message : telemetryError);
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof CourtStageError) {
      return res.status(error.status).json({ error: error.code });
    }
    console.error('Court session stage failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'COURT_SESSION_FAILED' });
  }
}
