import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRedisConfigured, redisCommand } from './_redis.ts';
import { OFFICIAL_JUDICIAL_REFERENCE_INDEX } from '../src/data/officialJudicialReferenceIndex.ts';
import { OFFICIAL_JUDICIAL_REGULATIONS } from '../src/data/officialJudicialRegulations.ts';
import { OFFICIAL_JUDICIAL_AMENDMENTS } from '../src/data/officialJudicialAmendments.ts';

function hasLongSecret(name: string) {
  return Boolean((process.env[name] || '').trim().length >= 32);
}

function hasAdminCredential() {
  return /^[a-f0-9]{64}$/i.test((process.env.QADA_ADMIN_CREDENTIAL_HASH_V4 || '').trim());
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
  const adminConfigured = hasAdminCredential();
  const geminiConfigured = hasGeminiProvider();
  const gatewayConfigured = hasGatewayProvider();
  const aiConfigured = geminiConfigured || gatewayConfigured;
  const officialSystems = OFFICIAL_JUDICIAL_REFERENCE_INDEX.filter((item) => item.status === 'official-verified').length;
  const officialRegulations = OFFICIAL_JUDICIAL_REGULATIONS.filter((item) => item.status === 'official-verified').length;
  const officialAmendments = OFFICIAL_JUDICIAL_AMENDMENTS.filter((item) => item.status === 'official-verified').length;

  const ready = authConfigured && dataConfigured && adminConfigured && geminiConfigured && redisConfigured && redisReachable;
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    ready,
    services: {
      authConfigured,
      dataConfigured,
      adminConfigured,
      aiConfigured,
      geminiConfigured,
      gatewayConfigured,
      redisConfigured,
      redisReachable,
    },
    legalCorpus: {
      officialSystems,
      officialRegulations,
      officialAmendments,
    },
    build: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA || '',
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
    },
    checkedAt: new Date().toISOString(),
  });
}