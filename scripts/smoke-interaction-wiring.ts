import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const sidebar = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const admin = fs.readFileSync('api/admin-analysis.ts', 'utf8');
const sourceAgents = fs.readFileSync('src/lib/legalSourceAgents.ts', 'utf8');
const map = fs.readFileSync('src/components/admin/AdminAgentMap.tsx', 'utf8');
const welcome = fs.readFileSync('src/components/workspaces/WelcomeScreen.tsx', 'utf8');
const login = fs.readFileSync('src/components/LoginScreen.tsx', 'utf8');
const chatApi = fs.readFileSync('api/chat.ts', 'utf8');
const hujjaAgent = fs.readFileSync('src/lib/hujjaBayanAgent.ts', 'utf8');

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
assert(map.includes('onNavigateNode') && app.includes('onNavigateNode={(nodeId) =>'),
  'Blueprint module navigation is not wired to the live application');
for (const id of ['settings','search','laws','judgments','references','cases','advisor','drafting','editor-tool','final-output']) {
  assert(map.includes(`'${id}'`), 'Navigable blueprint module missing: ' + id);
}

for (const workspace of Object.values(workspaces)) {
  assert(workspace.includes("fetch('/api/chat'"), 'Workspace generation button is not wired to chat API');
  assert(workspace.includes('readSseTextResponse'), 'Workspace response streaming is not wired');
  assert(workspace.includes('readFileAsAttachment'), 'Workspace attachment button is not wired');
}

assert(welcome.includes('QADA SIMPLE'), 'Simple interface label missing');
assert(welcome.includes('وش تبي QADA ينجز لك؟') && welcome.includes('bg-[#f7f8fa]'),
  'Simple workspace must use the calm mobile-first light interface');
assert(login.includes('صُممت الواجهة للجوال أولاً') && login.includes('text-base') && login.includes('min-h-12'),
  'Login must remain mobile-first with touch-sized controls and readable inputs');
assert(app.includes("simpleUserMode = session.role === 'user' && interfaceMode === 'simple'"),
  'Simple user mode must have a dedicated minimal application shell');
assert(app.includes("handleInterfaceModeChange('professional')") && app.includes('احترافي'),
  'Simple mobile dock must offer a direct professional-mode handoff');
assert(welcome.includes('QADA PROFESSIONAL'), 'Professional interface label missing');
assert(welcome.includes('واجهة الإدارة'), 'Admin interface entry missing');
assert(welcome.includes("fetch('/api/ai'"), 'Simple interface is not wired to the canonical assistant API');
assert(welcome.includes('readSseTextResponse'), 'Simple interface streaming parser missing');
assert(welcome.includes('readFileAsAttachment'), 'Simple interface attachment handling missing');
assert(welcome.includes("fetch('/api/cases?workspace=1'"), 'Simple and Professional shared workspace persistence missing');
assert(welcome.includes('ملف العمل المشترك بين Simple وProfessional'), 'Professional shared-workspace handoff missing');
assert(welcome.includes('ما الذي تريد من QADA أن ينجزه لك؟'), 'Simple interface primary task prompt missing');
const floatingChat = fs.readFileSync('src/components/chat/FloatingChatBot.tsx', 'utf8');
assert(floatingChat.includes('assistantHttpError'), 'Floating assistant must expose actionable HTTP errors');
assert(floatingChat.includes("credentials: 'same-origin'"), 'Floating assistant must explicitly send the QADA session cookie');
assert(floatingChat.includes("cache: 'no-store'"), 'Floating assistant requests must not reuse stale responses');
assert(welcome.includes('simpleAssistantHttpError'), 'Simple mode must expose actionable HTTP errors');
assert(welcome.includes("credentials: 'same-origin'"), 'Simple mode must explicitly send the QADA session cookie');
assert(welcome.includes("responseMode: 'simple'"), 'Simple interface must request concise response mode');
assert(floatingChat.includes("responseMode?: 'simple' | 'professional'") && floatingChat.includes('responseMode,'),
  'Floating assistant must follow the unified Simple/Professional workspace mode');
assert(chatApi.includes('SIMPLE_RESPONSE_INSTRUCTION'), 'Chat API missing dedicated Simple response contract');
assert(chatApi.includes('buildHujjaBayanInstruction') && chatApi.includes('isHujjaDraftingRequest'),
  'Chat API must route drafting tasks through Hujja wa Bayan');
assert(chatApi.includes('generateContentStream'), 'Hujja wa Bayan must use native Gemini streaming');
assert(chatApi.includes('streamHujjaViaGemini'), 'Hujja wa Bayan streaming helper missing');
assert(chatApi.includes("X-QADA-Agent', 'hujja-bayan'") && chatApi.includes("X-Accel-Buffering', 'no'"),
  'Hujja wa Bayan SSE headers must identify the agent and disable proxy buffering');
assert(chatApi.includes('protectStreamingSegment') && chatApi.includes('guardIntroducedLegalCitations'),
  'Hujja wa Bayan streaming must guard citations before emitting text');
assert(floatingChat.includes('animate-pulse text-amber-400') && floatingChat.includes('▎'),
  'Floating assistant must show a live typing cursor during streamed drafting');
assert(hujjaAgent.includes('المرحلة الأولى — الاستقراء قبل الكتابة') && hujjaAgent.includes('المرحلة الثانية — الصياغة'),
  'Hujja wa Bayan must enforce the two-step drafting workflow');
assert(hujjaAgent.includes('لا تدّع أنك درست أحكاماً مشابهة') && hujjaAgent.includes('لا تخترع واقعة أو مادة أو حكماً أو مبدأ قضائياً'),
  'Hujja wa Bayan must not invent precedent or legal authority');
assert(chatApi.includes('detectSimpleIntent'), 'Simple assistant must classify the practical user intent before answering');
assert(chatApi.includes('buildSimpleActionDirective'), 'Simple assistant must inject an action-first directive');
assert(chatApi.includes('simpleReplyLooksLikeLecture'), 'Simple assistant must detect professional-format lecture regressions');
assert(chatApi.includes('enforceSimpleActionFirst'), 'Simple assistant must replace unsolicited lecture responses with action-first guidance');
assert(chatApi.includes('simpleUserExplicitlyRequestsDetail'), 'Simple assistant must preserve detailed legal analysis when the user explicitly requests it');
assert(chatApi.includes('النية العملية المستنتجة: مطالبة مالية / استرداد مبلغ.'), 'Money-claim routing directive missing');
assert(chatApi.includes('النية العملية المستنتجة: إعداد لائحة اعتراض/استئناف.'), 'Appeal drafting routing directive missing');
assert(chatApi.includes('لا تشرح منصة QADA'), 'Simple assistant must not explain the platform unless asked');
assert(chatApi.includes('الرد المثالي في Simple: توجّه واضح → خطوة تالية → سؤالان أو أقل عند الحاجة.'), 'Simple action-first response contract missing');
assert(chatApi.includes("responseMode === 'professional' && verifiedArticleList.length > 0"),
  'Simple mode must not auto-append the verified legal article list');
assert(login.includes("action: authMode === 'register' ? 'register' : 'user-login'"), 'Email/password user access missing');
assert(login.includes('إنشاء مستخدم جديد'), 'New user registration UI missing');
assert(!login.includes("mode: 'admin',\n      title: 'الإدارة'"), 'Admin must not be exposed as a primary portal card');
assert(login.includes('setInterfaceMenuOpen') && login.includes('setAdminOpen(true)'),
  'Admin access must remain available only from the QADA interface chooser');
assert(welcome.includes('changeInterfaceMode') && welcome.includes("onModeChange?: (mode: 'simple' | 'professional') => void"),
  'Simple and Professional must be two modes of the same workspace');
assert(app.includes('handleInterfaceModeChange') && app.includes('onModeChange={handleInterfaceModeChange}'),
  'Unified workspace mode switch is not wired through the application');
assert(app.includes("responseMode={session.role === 'admin' ? 'professional' : interfaceMode}"),
  'Assistant response mode is not synchronized with the unified workspace switch');
assert(app.includes("setIsAdminMapOpen(userSession.workspaceMode === 'admin')"), 'Admin portal does not open the admin workspace directly');

console.log(JSON.stringify({
  ok: true,
  sidebarServices: serviceIds.length,
  sidebarCallbacks: sidebarCallbacks.length,
  operationalAgentNodes: requiredAgentNodes.length,
  workspaceFamilies: Object.keys(workspaces).length,
  inertButtons: inertButtons.length,
  interfaceModes: ['unified-user-workspace:simple↔professional', 'admin-hidden-in-chooser'],
}, null, 2));