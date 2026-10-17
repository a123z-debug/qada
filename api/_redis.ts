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

function isHostedRuntime(): boolean {
  return process.env.VERCEL === '1'
    || Boolean(process.env.VERCEL_ENV)
    || Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID);
}

// REDIS_URL=memory:// keeps the store inside this server process so the whole platform
// (accounts, cases, Sentinel, audit log) can be tried locally without Redis. Data is lost
// on restart, and hosted runtimes refuse it: serverless or multi-instance deploys would
// silently drop accounts and cases.
function hasMemoryRedis(): boolean {
  return /^memory:\/\//i.test(nativeRedisUrl()) && !isHostedRuntime();
}

export function isRedisConfigured(): boolean {
  return hasMemoryRedis() || hasUpstashRedis() || hasNativeRedis();
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

type MemoryEntry =
  | { type: 'string'; value: string; expiresAt: number }
  | { type: 'set'; value: Set<string>; expiresAt: number }
  | { type: 'list'; value: string[]; expiresAt: number };

const memoryStore = new Map<string, MemoryEntry>();
let memoryStoreAnnounced = false;

function liveMemoryEntry(key: string): MemoryEntry | undefined {
  const entry = memoryStore.get(key);
  if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return undefined;
  }
  return entry;
}

function memoryEntryOfType<T extends MemoryEntry['type']>(key: string, type: T): Extract<MemoryEntry, { type: T }> | undefined {
  const entry = liveMemoryEntry(key);
  if (entry && entry.type !== type) throw new Error('REDIS_ERROR:WRONGTYPE Operation against a key holding the wrong kind of value');
  return entry as Extract<MemoryEntry, { type: T }> | undefined;
}

function memoryListRange(length: number, start: number, stop: number): [number, number] {
  return [Math.max(0, start < 0 ? length + start : start), Math.min(length - 1, stop < 0 ? length + stop : stop)];
}

// Covers exactly the commands the API uses; anything else fails loudly instead of misbehaving.
function memoryCommand(command: RedisScalar[]): any {
  if (!memoryStoreAnnounced) {
    memoryStoreAnnounced = true;
    console.warn('[QADA_STORE] memory store active — in-process data for local testing; lost on restart.');
  }
  const [name, ...args] = command.map(String);
  const key = args[0];
  switch (name.toUpperCase()) {
    case 'PING':
      return 'PONG';
    case 'GET':
      return memoryEntryOfType(key, 'string')?.value ?? null;
    case 'MGET':
      return args.map((item) => memoryEntryOfType(item, 'string')?.value ?? null);
    case 'SET': {
      let expiresAt = 0;
      for (let index = 2; index < args.length; index += 1) {
        const option = args[index].toUpperCase();
        if (option === 'NX' && liveMemoryEntry(key)) return null;
        if (option === 'XX' && !liveMemoryEntry(key)) return null;
        if (option === 'EX') expiresAt = Date.now() + Number(args[++index]) * 1000;
        if (option === 'PX') expiresAt = Date.now() + Number(args[++index]);
      }
      memoryStore.set(key, { type: 'string', value: args[1], expiresAt });
      return 'OK';
    }
    case 'DEL':
      return args.filter((item) => liveMemoryEntry(item) && memoryStore.delete(item)).length;
    case 'INCR': {
      const entry = memoryEntryOfType(key, 'string');
      const next = Number(entry?.value ?? 0) + 1;
      if (!Number.isSafeInteger(next)) throw new Error('REDIS_ERROR:ERR value is not an integer or out of range');
      memoryStore.set(key, { type: 'string', value: String(next), expiresAt: entry?.expiresAt ?? 0 });
      return next;
    }
    case 'EXPIRE': {
      const entry = liveMemoryEntry(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + Number(args[1]) * 1000;
      return 1;
    }
    case 'SADD': {
      const entry = memoryEntryOfType(key, 'set') ?? { type: 'set' as const, value: new Set<string>(), expiresAt: 0 };
      const before = entry.value.size;
      for (const member of args.slice(1)) entry.value.add(member);
      memoryStore.set(key, entry);
      return entry.value.size - before;
    }
    case 'SREM': {
      const entry = memoryEntryOfType(key, 'set');
      if (!entry) return 0;
      const removed = args.slice(1).filter((member) => entry.value.delete(member)).length;
      if (!entry.value.size) memoryStore.delete(key);
      return removed;
    }
    case 'SMEMBERS':
      return Array.from(memoryEntryOfType(key, 'set')?.value ?? []);
    case 'LPUSH': {
      const entry = memoryEntryOfType(key, 'list') ?? { type: 'list' as const, value: [] as string[], expiresAt: 0 };
      for (const item of args.slice(1)) entry.value.unshift(item);
      memoryStore.set(key, entry);
      return entry.value.length;
    }
    case 'LRANGE': {
      const list = memoryEntryOfType(key, 'list')?.value ?? [];
      const [from, to] = memoryListRange(list.length, Number(args[1]), Number(args[2]));
      return list.slice(from, to + 1);
    }
    case 'LTRIM': {
      const entry = memoryEntryOfType(key, 'list');
      if (!entry) return 'OK';
      const [from, to] = memoryListRange(entry.value.length, Number(args[1]), Number(args[2]));
      entry.value = entry.value.slice(from, to + 1);
      if (!entry.value.length) memoryStore.delete(key);
      return 'OK';
    }
    default:
      throw new Error(`REDIS_ERROR:memory store does not support ${name}`);
  }
}

export async function redisCommand(command: RedisScalar[]): Promise<any> {
  if (hasMemoryRedis()) return memoryCommand(command);

  // Prefer Railway/native Redis when configured. This prevents stale Upstash REST
  // credentials from shadowing a healthy in-project Redis database.
  if (hasNativeRedis()) {
    const [result] = await nativeRedisCommands([command]);
    return result;
  }

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

  throw new Error('REDIS_NOT_CONFIGURED');
}

export async function redisPipeline(commands: RedisScalar[][]): Promise<any[]> {
  if (hasMemoryRedis()) return commands.map((command) => memoryCommand(command));

  // Keep the same precedence for pipelines and single commands.
  if (hasNativeRedis()) {
    return nativeRedisCommands(commands);
  }

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

  throw new Error('REDIS_NOT_CONFIGURED');
}
