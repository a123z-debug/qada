import {
  sameOriginMutationAllowed,
} from '../api/_requestGuard.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function req(method: string, headers: Record<string, string>) {
  return { method, headers };
}

assert(sameOriginMutationAllowed(req('GET', { host: 'qada.example' })), 'GET must remain allowed');
assert(sameOriginMutationAllowed(req('POST', {
  host: 'qada.example',
  origin: 'https://qada.example',
  'sec-fetch-site': 'same-origin',
})), 'same-origin POST must be allowed');

assert(!sameOriginMutationAllowed(req('POST', {
  host: 'qada.example',
  origin: 'https://evil.example',
  'sec-fetch-site': 'cross-site',
})), 'cross-site origin must be blocked');

assert(!sameOriginMutationAllowed(req('POST', {
  host: 'qada.example',
  origin: 'https://sibling.example',
  'sec-fetch-site': 'same-site',
})), 'same-site sibling origin must be blocked');

assert(!sameOriginMutationAllowed(req('DELETE', {
  host: 'qada.example',
  referer: 'https://evil.example/page',
})), 'foreign referer must be blocked when origin is absent');

assert(sameOriginMutationAllowed(req('POST', {
  host: 'qada.example',
})), 'non-browser authenticated API clients without browser fetch headers must remain usable');

assert(sameOriginMutationAllowed(req('POST', {})), 'direct non-browser handler calls without browser metadata must remain usable');
assert(!sameOriginMutationAllowed(req('POST', {
  origin: 'https://evil.example',
})), 'browser-like request without Host must fail closed');

console.log(JSON.stringify({ ok: true, siblingDomainCsrfBlocked: true }, null, 2));
