type MockResponse = {
  statusCode: number;
  headers: Record<string, unknown>;
  body: unknown;
  ended: boolean;
  setHeader(name: string, value: unknown): void;
  status(code: number): MockResponse;
  json(value: unknown): MockResponse;
  end(value?: unknown): MockResponse;
};

function createResponse(): MockResponse {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; this.ended = true; return this; },
    end(value) { this.body = value; this.ended = true; return this; },
  };
}

async function exercise(path: string, method: string, expected: number[]) {
  const mod = await import(path);
  if (typeof mod.default !== 'function') throw new Error(path + ': default handler missing');

  const req: any = {
    method,
    headers: {},
    query: {},
    body: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = createResponse();

  await mod.default(req, res as any);

  if (!expected.includes(res.statusCode)) {
    throw new Error(path + ': unexpected status ' + res.statusCode + ' body=' + JSON.stringify(res.body));
  }

  return { path, status: res.statusCode };
}

const results = [];
results.push(await exercise('../api/health.ts', 'GET', [200, 503]));
results.push(await exercise('../api/session.ts', 'GET', [401, 200]));
results.push(await exercise('../api/cases.ts', 'GET', [401]));
results.push(await exercise('../api/admin-runs.ts', 'GET', [401]));
results.push(await exercise('../api/admin-users.ts', 'GET', [401]));
results.push(await exercise('../api/chat.ts', 'POST', [401]));

console.log(JSON.stringify({ ok: true, results }, null, 2));
