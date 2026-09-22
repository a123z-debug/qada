import net from 'node:net';
import tls from 'node:tls';

export type RedisScalar = string | number;

function upstashRedisUrl(): string {
  return (process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/$/, '');
}

function upstashRedisToken(): string {
  return (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
}

function nativeRedisUrl(): string {
  return (process.env.REDIS_URL || '').trim();
}

function hasUpstashRedis(): boolean {
  return Boolean(upstashRedisUrl() && upstashRedisToken());
}

function hasNativeRedis(): boolean {
  return /^rediss?:\/\//i.test(nativeRedisUrl());
}

export function isRedisConfigured(): boolean {
  return hasUpstashRedis() || hasNativeRedis();
}

export function redisPrefix(): string {
  return (process.env.QADA_REDIS_PREFIX || 'qada:v1').trim() || 'qada:v1';
}

async function parseHttpResponse(response: Response): Promise<any> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`REDIS_HTTP_${response.status}`);
  }
  if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
    throw new Error(`REDIS_ERROR:${String(payload.error).slice(0, 180)}`);
  }
  return payload;
}

function encodeRespCommand(command: RedisScalar[]): Buffer {
  const chunks: Buffer[] = [Buffer.from(`*${command.length}\r\n`)];
  for (const item of command) {
    const value = Buffer.from(String(item), 'utf8');
    chunks.push(Buffer.from(`$${value.length}\r\n`), value, Buffer.from('\r\n'));
  }
  return Buffer.concat(chunks);
}

type ParsedResp = { value: any; next: number };

function parseResp(buffer: Buffer, offset = 0): ParsedResp | null {
  if (offset >= buffer.length) return null;
  const prefix = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf('\r\n', offset + 1);
  if (lineEnd < 0) return null;
  const line = buffer.toString('utf8', offset + 1, lineEnd);

  if (prefix === '+') return { value: line, next: lineEnd + 2 };
  if (prefix === '-') throw new Error(`REDIS_ERROR:${line.slice(0, 180)}`);
  if (prefix === ':') return { value: Number(line), next: lineEnd + 2 };

  if (prefix === '$') {
    const length = Number(line);
    if (!Number.isInteger(length)) throw new Error('REDIS_PROTOCOL_ERROR');
    if (length === -1) return { value: null, next: lineEnd + 2 };
    const bodyStart = lineEnd + 2;
    const bodyEnd = bodyStart + length;
    if (buffer.length < bodyEnd + 2) return null;
    return { value: buffer.toString('utf8', bodyStart, bodyEnd), next: bodyEnd + 2 };
  }

  if (prefix === '*') {
    const count = Number(line);
    if (!Number.isInteger(count)) throw new Error('REDIS_PROTOCOL_ERROR');
    if (count === -1) return { value: null, next: lineEnd + 2 };
    const values: any[] = [];
    let cursor = lineEnd + 2;
    for (let index = 0; index < count; index += 1) {
      const parsed = parseResp(buffer, cursor);
      if (!parsed) return null;
      values.push(parsed.value);
      cursor = parsed.next;
    }
    return { value: values, next: cursor };
  }

  throw new Error('REDIS_PROTOCOL_ERROR');
}

async function nativeRedisCommands(commands: RedisScalar[][]): Promise<any[]> {
  const rawUrl = nativeRedisUrl();
  if (!rawUrl) throw new Error('REDIS_NOT_CONFIGURED');

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error('REDIS_URL_INVALID');
  }

  if (parsedUrl.protocol !== 'redis:' && parsedUrl.protocol !== 'rediss:') {
    throw new Error('REDIS_URL_INVALID');
  }

  const host = parsedUrl.hostname;
  const port = Number(parsedUrl.port || (parsedUrl.protocol === 'rediss:' ? 6380 : 6379));
  const username = decodeURIComponent(parsedUrl.username || '');
  const password = decodeURIComponent(parsedUrl.password || '');
  if (!host || !Number.isFinite(port)) throw new Error('REDIS_URL_INVALID');

  const authCommand: RedisScalar[] | null = password
    ? (username ? ['AUTH', username, password] : ['AUTH', password])
    : null;
  const wireCommands = authCommand ? [authCommand, ...commands] : commands;

  return new Promise<any[]>((resolve, reject) => {
    let settled = false;
    let socket: any;
    let pending = Buffer.alloc(0);
    const responses: any[] = [];

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (socket) {
        socket.removeAllListeners();
        socket.end();
        socket.destroy();
      }
      if (error) {
        reject(error);
        return;
      }
      resolve(authCommand ? responses.slice(1) : responses);
    };

    const consume = () => {
      try {
        while (responses.length < wireCommands.length) {
          const parsed = parseResp(pending, 0);
          if (!parsed) return;
          responses.push(parsed.value);
          pending = pending.subarray(parsed.next);
        }
        finish();
      } catch (error) {
        finish(error instanceof Error ? error : new Error('REDIS_PROTOCOL_ERROR'));
      }
    };

    const onConnect = () => {
      try {
        socket.write(Buffer.concat(wireCommands.map(encodeRespCommand)));
      } catch (error) {
        finish(error instanceof Error ? error : new Error('REDIS_WRITE_FAILED'));
      }
    };

    const timer = setTimeout(() => finish(new Error('REDIS_TIMEOUT')), 5000);

    socket = parsedUrl.protocol === 'rediss:'
      ? tls.connect({ host, port, servername: host, rejectUnauthorized: true }, onConnect)
      : net.createConnection({ host, port }, onConnect);

    socket.on('data', (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      consume();
    });
    socket.on('error', (error: Error) => finish(new Error(`REDIS_CONNECTION_ERROR:${error.message.slice(0, 160)}`)));
    socket.on('close', () => {
      if (!settled && responses.length < wireCommands.length) finish(new Error('REDIS_CONNECTION_CLOSED'));
    });
  });
}

export async function redisCommand(command: RedisScalar[]): Promise<any> {
  if (hasUpstashRedis()) {
    const response = await fetch(upstashRedisUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstashRedisToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
    });
    const payload = await parseHttpResponse(response);
    return payload?.result;
  }

  if (hasNativeRedis()) {
    const [result] = await nativeRedisCommands([command]);
    return result;
  }

  throw new Error('REDIS_NOT_CONFIGURED');
}

export async function redisPipeline(commands: RedisScalar[][]): Promise<any[]> {
  if (hasUpstashRedis()) {
    const response = await fetch(`${upstashRedisUrl()}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstashRedisToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      cache: 'no-store',
    });
    const payload = await parseHttpResponse(response);
    if (!Array.isArray(payload)) throw new Error('REDIS_INVALID_PIPELINE_RESPONSE');
    return payload.map((item) => {
      if (item?.error) throw new Error(`REDIS_ERROR:${String(item.error).slice(0, 180)}`);
      return item?.result;
    });
  }

  if (hasNativeRedis()) {
    return nativeRedisCommands(commands);
  }

  throw new Error('REDIS_NOT_CONFIGURED');
}
