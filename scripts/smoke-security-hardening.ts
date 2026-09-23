import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const server = fs.readFileSync('server.ts', 'utf8');
const session = fs.readFileSync('api/session.ts', 'utf8');
const editor = fs.readFileSync('src/components/workspaces/LegalReviewEditor.tsx', 'utf8');
const chatMessage = fs.readFileSync('src/components/ChatMessage.tsx', 'utf8');
const cases = fs.readFileSync('api/cases.ts', 'utf8');
const workflow = fs.readFileSync('.github/workflows/build-check.yml', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const printMemo = fs.readFileSync('src/utils/printMemo.ts', 'utf8');

for (const header of [
  'Content-Security-Policy',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'X-Frame-Options',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
]) {
  assert(server.includes(header), 'server missing security header: ' + header);
}
assert(server.includes("object-src 'none'") && server.includes("frame-ancestors 'none'"), 'CSP baseline is incomplete');
assert(server.includes("process.env.RAILWAY_ENVIRONMENT === 'production'"), 'Railway must be recognized as production for HSTS');
assert(session.includes("process.env.RAILWAY_ENVIRONMENT === 'production'"), 'Railway must be recognized as production for auth/test-mode gating');

assert(!editor.includes('dangerouslySetInnerHTML'), 'raw HTML rendering returned to LegalReviewEditor');
assert(editor.includes('highlightedSegments'), 'safe highlighted React rendering is missing');

assert(!session.includes('DEV_ADMIN_HASH_V7'), 'static development admin credential fallback returned');
assert(!session.includes("if (OPEN_TEST_MODE) {\n    return createHash"), 'static test session secret fallback returned');
assert(session.includes("createHash('sha256').update(a).digest()") && session.includes('timingSafeEqual(aa, bb)'), 'constant-length credential comparison is missing');
assert(session.includes('verificationSalt') && session.includes('credentialsMatch'), 'login timing equalization path is missing');

assert(workflow.includes('permissions:\n  contents: read'), 'GitHub Actions token permissions are not restricted');
assert(workflow.includes('persist-credentials: false'), 'checkout still persists Git credentials');

assert(!html.includes('fonts.googleapis.com') && !html.includes('fonts.gstatic.com'), 'external font subresource remains in index');
assert(!printMemo.includes('fonts.googleapis.com'), 'external font subresource remains in print helper');
assert(!printMemo.includes('<script>'), 'print helper must not inject inline script');

assert(chatMessage.includes('maskNationalId') && chatMessage.includes('{maskedNationalId}'), 'national ID masking is missing');
assert(!chatMessage.includes('الهوية: {activeNationalId}'), 'full national ID is still rendered');
assert(!chatMessage.includes('هيئة القضاة بالكامل'), 'automated review is still labelled as a real judges panel');

assert(cases.includes("confidentiality === 'case-only-secret'"), 'case-only secret policy is missing');
assert(cases.includes('excludeFromCrossCaseComparison: isCaseOnlySecret ? true'), 'case-only knowledge is not forced out of cross-case comparisons');
assert(cases.includes('excludeFromLegalCorpus: isCaseOnlySecret ? true'), 'case-only knowledge is not forced out of the legal corpus');
assert(cases.includes('stripCrossCaseKnowledge'), 'aggregate case views do not strip case-only knowledge');
assert(cases.includes('hasExplicitDossierLinkEvidence'), 'dossier auto-link still lacks explicit judicial linkage evidence');

console.log(JSON.stringify({
  ok: true,
  csp: true,
  rawHtmlSinkRemoved: true,
  authTimingHardened: true,
  staticAuthFallbacksRemoved: true,
  workflowCredentialsHardened: true,
  externalFontSubresourcesRemoved: true,
  nationalIdMasked: true,
  caseOnlyKnowledgeEnforced: true,
  dossierAutoLinkRequiresExplicitEvidence: true,
}, null, 2));
