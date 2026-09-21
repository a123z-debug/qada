export type RedisScalar = string | number;

function redisUrl(): string {
  return (process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/$/, '');
}

function redisToken(): string {
  return (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
}

export function isRedisConfigured(): boolean {
  return Boolean(redisUrl() && redisToken());
}

export function redisPrefix(): string {
  return (process.env.QADA_REDIS_PREFIX || 'qada:v1').trim() || 'qada:v1';
}

async function parseResponse(response: Response): Promise<any> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`REDIS_HTTP_${response.status}`);
  }
  if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
    throw new Error(`REDIS_ERROR:${String(payload.error).slice(0, 180)}`);
  }
  return payload;
}

export async function redisCommand(command: RedisScalar[]): Promise<any> {
  if (!isRedisConfigured()) throw new Error('REDIS_NOT_CONFIGURED');
  const response = await fetch(redisUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  const payload = await parseResponse(response);
  return payload?.result;
}

export async function redisPipeline(commands: RedisScalar[][]): Promise<any[]> {
  if (!isRedisConfigured()) throw new Error('REDIS_NOT_CONFIGURED');
  const response = await fetch(`${redisUrl()}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    cache: 'no-store',
  });
  const payload = await parseResponse(response);
  if (!Array.isArray(payload)) throw new Error('REDIS_INVALID_PIPELINE_RESPONSE');
  return payload.map((item) => {
    if (item?.error) throw new Error(`REDIS_ERROR:${String(item.error).slice(0, 180)}`);
    return item?.result;
  });
}