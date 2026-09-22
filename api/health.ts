import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRedisConfigured, redisCommand } from './_redis.js';

function hasLongSecret(name: string) {
  return Boolean((process.env[name] || '').trim().length >= 32);
}

function hasGatewayProvider() {
  return Boolean((process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || '').trim());
}

function hasGeminiProvider() {
  return [1, 2, 3, 4].some((index) =>
    Boolean(process.env[`GEMINI_API_KEY${index === 1 ? '' : `_${index}`}`]?.trim())
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const redisConfigured = isRedisConfigured();
    let redisReachable = false;

    if (redisConfigured) {
      try {
        redisReachable = String(await redisCommand(['PING'])).toUpperCase() === 'PONG';
      } catch {
        redisReachable = false;
      }
    }

    const authConfigured = hasLongSecret('AUTH_SECRET');
    const dataConfigured = hasLongSecret('DATA_SECRET');
    const geminiConfigured = hasGeminiProvider();
    const gatewayConfigured = hasGatewayProvider();
    const aiConfigured = geminiConfigured || gatewayConfigured;

    const ready =
      authConfigured &&
      dataConfigured &&
      geminiConfigured &&
      redisConfigured &&
      redisReachable;

    return res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'degraded',
      ready,
      services: {
        authConfigured,
        dataConfigured,
        aiConfigured,
        geminiConfigured,
        gatewayConfigured,
        redisConfigured,
        redisReachable,
      },
      build: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA || '',
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health endpoint failed:', error instanceof Error ? error.message : error);
    return res.status(503).json({
      status: 'degraded',
      ready: false,
      error: 'HEALTH_CHECK_FAILED',
      checkedAt: new Date().toISOString(),
    });
  }
}
