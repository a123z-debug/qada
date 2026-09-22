import { createHash } from 'node:crypto';
import { isRedisConfigured, redisCommand, redisPipeline, redisPrefix } from './_redis.ts';

type LocalEntry = { count: number; resetAt: number };
const localLimits = new Map<string, LocalEntry>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  backend: 'redis' | 'memory';
};

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function localLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const current = localLimits.get(key);
  if (!current || current.resetAt <= now) {
    localLimits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0, backend: 'memory' };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      backend: 'memory',
    };
  }
  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfterSeconds: 0, backend: 'memory' };
}

export async function enforceRateLimit(
  namespace: string,
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeWindow = Math.max(1, Math.floor(windowSeconds));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSeconds / safeWindow);
  const retryAfterSeconds = Math.max(1, safeWindow - (nowSeconds % safeWindow));
  const key = `${redisPrefix()}:rate:${namespace}:${digest(identity)}:${bucket}`;

  if (isRedisConfigured()) {
    try {
      const [countRaw] = await redisPipeline([
        ['INCR', key],
        ['EXPIRE', key, safeWindow + 5],
      ]);
      const count = Number(countRaw || 0);
      return {
        allowed: count <= safeLimit,
        remaining: Math.max(0, safeLimit - count),
        retryAfterSeconds: count <= safeLimit ? 0 : retryAfterSeconds,
        backend: 'redis',
      };
    } catch {
      return localLimit(key, safeLimit, safeWindow);
    }
  }

  return localLimit(key, safeLimit, safeWindow);
}

export async function clearRateLimit(
  namespace: string,
  identity: string,
  windowSeconds: number,
): Promise<void> {
  const safeWindow = Math.max(1, Math.floor(windowSeconds));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSeconds / safeWindow);
  const key = `${redisPrefix()}:rate:${namespace}:${digest(identity)}:${bucket}`;

  if (isRedisConfigured()) {
    try {
      await redisCommand(['DEL', key]);
    } catch {
      // Authentication must not fail because a best-effort rate-limit reset failed.
    }
    return;
  }

  localLimits.delete(key);
}
