import fs from 'node:fs';
import path from 'node:path';

type Finding = {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  location: string;
  issue: string;
  fix: string;
};

const findings: Finding[] = [];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'scratch', '.git'].includes(entry.name)) continue;
      out.push(...walk(full));
    } else if (/\.(?:ts|tsx|js|jsx|html)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const runtimeFiles = [
  'server.ts',
  'index.html',
  ...walk('api'),
  ...walk('src'),
].filter((file) => !file.includes('security-007-audit'));

const secretPatterns: Array<[RegExp, string]> = [
  [/AIza[0-9A-Za-z_-]{25,}/g, 'Google API key'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, 'OpenAI-style API key'],
  [/\bghp_[A-Za-z0-9]{30,}\b/g, 'GitHub personal token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g, 'Slack token'],
  [/\bAKIA[0-9A-Z]{16}\b/g, 'AWS access key'],
];

for (const file of runtimeFiles) {
  const source = fs.readFileSync(file, 'utf8');

  for (const [pattern, label] of secretPatterns) {
    if (pattern.test(source)) {
      findings.push({
        severity: 'CRITICAL',
        location: file,
        issue: `Hardcoded secret pattern detected: ${label}`,
        fix: 'Remove the credential from source and rotate it; keep the replacement only in Railway Variables/secrets.',
      });
    }
    pattern.lastIndex = 0;
  }

  if (/\beval\s*\(|new\s+Function\s*\(/.test(source)) {
    findings.push({
      severity: 'CRITICAL',
      location: file,
      issue: 'Dynamic code execution sink detected',
      fix: 'Remove eval/new Function and use explicit parsing/dispatch.',
    });
  }

  if (/node:child_process|from\s+['"]child_process['"]|\bexecSync\s*\(|\bspawnSync\s*\(/.test(source)) {
    findings.push({
      severity: 'HIGH',
      location: file,
      issue: 'Process execution capability exists in runtime code',
      fix: 'Remove shell/process execution from web runtime or strictly isolate it in an offline build job.',
    });
  }

  if (/Access-Control-Allow-Origin['"]?\s*,?\s*['"]\*['"]/.test(source)) {
    findings.push({
      severity: 'HIGH',
      location: file,
      issue: 'Wildcard CORS detected',
      fix: 'Use same-origin requests or an explicit origin allowlist.',
    });
  }

  if (file !== 'src/utils/printMemo.ts' && /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/.test(source)) {
    findings.push({
      severity: 'HIGH',
      location: file,
      issue: 'Potential DOM XSS sink detected',
      fix: 'Render user data through React text nodes or escape/sanitize it before any HTML sink.',
    });
  }

  if (/console\.(?:log|info|warn|error)\([^\n]*(?:AUTH_SECRET|DATA_SECRET|GEMINI_API_KEY|AI_GATEWAY_API_KEY|REDIS_URL)/.test(source)) {
    findings.push({
      severity: 'CRITICAL',
      location: file,
      issue: 'Potential secret logging detected',
      fix: 'Log only non-secret readiness metadata; never log secret values.',
    });
  }
}

const printMemo = fs.readFileSync('src/utils/printMemo.ts', 'utf8');
if (
  printMemo.includes('document.write(formattedHtml)')
  && !(printMemo.includes('const escapeHtml') && printMemo.includes('escapedContent') && printMemo.includes('escapedTitle'))
) {
  findings.push({
    severity: 'HIGH',
    location: 'src/utils/printMemo.ts',
    issue: 'Print HTML sink is not protected by escaping',
    fix: 'Escape both title and document content before document.write.',
  });
}
if (printMemo.includes('<script>')) {
  findings.push({
    severity: 'HIGH',
    location: 'src/utils/printMemo.ts',
    issue: 'Inline script in print document',
    fix: 'Do not inject script into printable documents.',
  });
}

const session = fs.readFileSync('api/session.ts', 'utf8');
for (const required of [
  "const OPEN_TEST_MODE = process.env.QADA_OPEN_TEST_MODE === 'true';",
  "const GUEST_ACCESS_ENABLED = process.env.QADA_GUEST_ACCESS === 'true';",
  'if (!OPEN_TEST_MODE)',
  'if (!GUEST_ACCESS_ENABLED)',
  'HttpOnly',
  'SameSite=Strict',
]) {
  if (!session.includes(required)) {
    findings.push({
      severity: 'CRITICAL',
      location: 'api/session.ts',
      issue: `Authentication hardening invariant missing: ${required}`,
      fix: 'Restore fail-closed test/guest access and hardened HttpOnly session cookies.',
    });
  }
}

const server = fs.readFileSync('server.ts', 'utf8');
for (const required of [
  'Content-Security-Policy',
  "object-src 'none'",
  "frame-ancestors 'none'",
  "const PUBLIC_INDEXING_ENABLED = process.env.QADA_PUBLIC_INDEXING === 'true';",
  "X-Robots-Tag', 'noindex, nofollow, noarchive'",
]) {
  if (!server.includes(required)) {
    findings.push({
      severity: 'HIGH',
      location: 'server.ts',
      issue: `Web hardening invariant missing: ${required}`,
      fix: 'Restore CSP/private-by-default indexing and security headers.',
    });
  }
}

const clientFiles = walk('src');
for (const file of clientFiles) {
  const source = fs.readFileSync(file, 'utf8');
  if (/GEMINI_API_KEY|AI_GATEWAY_API_KEY|AUTH_SECRET|DATA_SECRET|REDIS_URL/.test(source)) {
    findings.push({
      severity: 'CRITICAL',
      location: file,
      issue: 'Server secret name/reference found in client bundle source',
      fix: 'Move provider/auth/storage secrets exclusively to server-side modules and Railway Variables.',
    });
  }
}

const protectedEndpoints = [
  'api/chat.ts',
  'api/judges-review.ts',
  'api/convert-story.ts',
  'api/legal-source-search.ts',
  'api/admin-analysis.ts',
  'api/cases.ts',
  'api/admin-runs.ts',
  'api/admin-users.ts',
  'api/audit-log.ts',
];
for (const file of protectedEndpoints) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('readActiveSession')) {
    findings.push({
      severity: 'CRITICAL',
      location: file,
      issue: 'Protected endpoint does not read an active signed session',
      fix: 'Require readActiveSession and return 401 before accessing protected data or AI.',
    });
  }
}

const critical = findings.filter((item) => item.severity === 'CRITICAL');
const high = findings.filter((item) => item.severity === 'HIGH');

if (findings.length) {
  const report = findings
    .map((item, index) => [
      `[${index + 1}] ${item.severity}`,
      `location: ${item.location}`,
      `issue: ${item.issue}`,
      `fix: ${item.fix}`,
    ].join('\n'))
    .join('\n\n');

  throw new Error(`007 AppSec audit failed\n\n${report}`);
}

console.log(JSON.stringify({
  ok: true,
  agent: '007',
  filesScanned: runtimeFiles.length,
  critical: critical.length,
  high: high.length,
  checks: [
    'hardcoded secrets',
    'dynamic code execution',
    'process execution',
    'wildcard CORS',
    'DOM XSS sinks',
    'secret logging',
    'print HTML escaping',
    'test/guest access fail-closed',
    'session cookie hardening',
    'CSP/security headers',
    'private-by-default indexing',
    'client secret separation',
    'protected API session gates',
  ],
  note: 'Static/release audit only; authenticated dynamic security testing on staging is still required before public launch.',
}, null, 2));
