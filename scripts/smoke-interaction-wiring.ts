import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const sidebar = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const admin = fs.readFileSync('api/admin-analysis.ts', 'utf8');
const sourceAgents = fs.readFileSync('src/lib/legalSourceAgents.ts', 'utf8');
const map = fs.readFileSync('src/components/admin/AdminAgentMap.tsx', 'utf8');

const workspaces: Record<string, string> = {
  administrative: fs.readFileSync('src/components/workspaces/AdministrativeWorkspace.tsx', 'utf8'),
  general: fs.readFileSync('src/components/workspaces/GeneralWorkspace.tsx', 'utf8'),
  criminal: fs.readFileSync('src/components/workspaces/CriminalWorkspace.tsx', 'utf8'),
};

const serviceIds = [
  'administrative_claim','administrative_appeal','administrative_memo','administrative_attachments',
  'general_claim','general_appeal','general_memo','general_attachments',
  'criminal_defense','criminal_appeal','criminal_procedural','criminal_evidence',
];

for (const id of serviceIds) {
  assert(sidebar.includes(`id: '${id}'`), 'Sidebar service missing: ' + id);
  const group = id.split('_')[0];
  assert(workspaces[group]?.includes(id), 'Workspace handler missing for service: ' + id);
}

const sidebarCallbacks = [
  'onOpenKnowledge','onOpenSearch','onOpenAssistant','onOpenReports',
  'onOpenAdminMap','onOpenAdminAnalysis','onOpenAdminUsers','onOpenAdminAudit','onOpenAccountSecurity',
];
for (const callback of sidebarCallbacks) {
  assert(sidebar.includes(callback), 'Sidebar callback missing: ' + callback);
  assert(app.includes(callback + '='), 'App wiring missing for: ' + callback);
}

for (const component of [
  'AdminAgentMap','AdminAnalysisRoom','AdminUserManagement','AdminAuditLog',
  'CaseDossierModal','JudgmentRepositoryModal','LegalReferencesModal','PdfUploadModal','CasePleadingStudioModal',
]) {
  assert(app.includes(component), 'Application surface missing: ' + component);
}

function walkTsx(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir + '/' + entry.name;
    if (entry.isDirectory()) files.push(...walkTsx(full));
    else if (entry.isFile() && full.endsWith('.tsx')) files.push(full);
  }
  return files;
}

const inertButtons: string[] = [];
for (const file of walkTsx('src')) {
  const source = fs.readFileSync(file, 'utf8');
  const buttons = source.match(/<button\b[\s\S]*?>/g) || [];
  buttons.forEach((tag, index) => {
    const interactive = /onClick\s*=/.test(tag) || /type\s*=\s*["']submit["']/.test(tag) || /formAction\s*=/.test(tag);
    if (!interactive) inertButtons.push(file + '#button-' + (index + 1));
  });
}
assert(inertButtons.length === 0, 'Inert HTML buttons found: ' + inertButtons.join(', '));

const runtimeAgentIds = new Set<string>();
for (const match of admin.matchAll(/agentId:\s*'([^']+)'/g)) runtimeAgentIds.add(match[1]);
for (const match of admin.matchAll(/id:\s*'([^']+)'/g)) runtimeAgentIds.add(match[1]);
for (const match of sourceAgents.matchAll(/agentId:\s*'([^']+)'/g)) runtimeAgentIds.add(match[1]);

for (const id of ['judgment-audit', 'memo-audit']) {
  if (admin.includes(`'${id}'`)) runtimeAgentIds.add(id);
}

const requiredAgentNodes = [
  'document-reader','case-router','qada-core','facts','jurisdiction','characterization','evidence','reasoning','procedure',
  'src-bog','src-personnel','src-royal','src-precedents','official-source','exact-text','amendments','conflicts','final-review',
  'judgment-audit','memo-audit','legislative-flaws','judicial-flaws','procedural-flaws','evidence-flaws','reasoning-flaws','rebuttal-review','admin-final',
];

for (const id of requiredAgentNodes) {
  assert(map.includes(`id: '${id}'`), 'Agent missing from operations map: ' + id);
  assert(runtimeAgentIds.has(id), 'Map agent has no runtime/source implementation: ' + id);
}

assert(map.includes('onClick={() => setSelectedId(node.id)}'), 'Map nodes are not clickable');
assert(map.includes('runtimeById.get(selected.id)'), 'Selected map node does not expose runtime telemetry');
assert(map.includes('sourcePacketById.get(selected.id)'), 'Selected source node does not expose source provenance');

for (const workspace of Object.values(workspaces)) {
  assert(workspace.includes("fetch('/api/chat'"), 'Workspace generation button is not wired to chat API');
  assert(workspace.includes('readSseTextResponse'), 'Workspace response streaming is not wired');
  assert(workspace.includes('readFileAsAttachment'), 'Workspace attachment button is not wired');
}

console.log(JSON.stringify({
  ok: true,
  sidebarServices: serviceIds.length,
  sidebarCallbacks: sidebarCallbacks.length,
  operationalAgentNodes: requiredAgentNodes.length,
  workspaceFamilies: Object.keys(workspaces).length,
  inertButtons: inertButtons.length,
}, null, 2));