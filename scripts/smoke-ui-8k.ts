import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const main = fs.readFileSync('src/main.tsx', 'utf8');
const css = fs.readFileSync('src/qada-8k.css', 'utf8');
const master = fs.readFileSync('design-system/qada/MASTER.md', 'utf8');

assert(main.includes("import './index.css';\nimport './qada-8k.css';"), 'QADA 8K must load after legacy index.css');
assert(master.includes('a123z-debug/ui-ux-pro-max-skill'), 'QADA 8K must cite the user fork as design source');
assert(master.includes('Legal Services') && master.includes('Accessible & Ethical') && master.includes('Swiss'), 'Design system must preserve UI/UX Pro Max legal-service recommendations');

for (const token of [
  '--q8-ink-950',
  '--q8-green-700',
  '--q8-brass-500',
  '--q8-ivory-50',
  '--q8-motion-base',
  '--q8-shadow-3',
]) {
  assert(css.includes(token), 'Missing QADA 8K semantic token: ' + token);
}

for (const rule of [
  'prefers-reduced-motion',
  ':focus-visible',
  'min-height: 44px',
  'scrollbar-width: thin',
  'qada-8k-modal',
  'qada-8k-admin-view',
  'qada-8k-editor',
  'qada-8k-story',
  'qada-8k-floating-chat',
  'qada-8k-judge-panel',
]) {
  assert(css.includes(rule), 'Missing QADA 8K delivery rule: ' + rule);
}

assert(!css.includes('fonts.googleapis.com'), 'QADA 8K must not add remote font dependencies');

const requiredHooks: Record<string, string[]> = {
  'src/components/LoginScreen.tsx': ['qada-8k-auth', 'qada-8k-auth-card'],
  'src/components/AccountSecurityModal.tsx': ['qada-8k-modal-overlay', 'qada-8k-modal'],
  'src/components/Article8CalculatorModal.tsx': ['qada-8k-modal-overlay', 'qada-8k-modal'],
  'src/components/CaseDossierModal.tsx': ['qada-8k-modal-overlay', 'qada-8k-dossier'],
  'src/components/CasePleadingStudioModal.tsx': ['qada-8k-modal-overlay', 'qada-8k-pleading'],
  'src/components/ChatSettingsModal.tsx': ['qada-8k-modal-overlay', 'qada-8k-modal'],
  'src/components/JudgmentRepositoryModal.tsx': ['qada-8k-modal-overlay', 'qada-8k-repository'],
  'src/components/LegalReferencesModal.tsx': ['qada-8k-modal-overlay', 'qada-8k-references'],
  'src/components/PdfUploadModal.tsx': ['qada-8k-modal-overlay', 'qada-8k-upload'],
  'src/components/PromptLibraryModal.tsx': ['qada-8k-modal-overlay', 'qada-8k-library'],
  'src/components/WelcomeStarters.tsx': ['qada-8k-welcome'],
  'src/components/ChatMessage.tsx': ['qada-8k-message'],
  'src/components/chat/FloatingChatBot.tsx': ['qada-8k-floating-chat'],
  'src/components/workspaces/LegalReviewEditor.tsx': ['qada-8k-editor'],
  'src/components/workspaces/PlainStoryInput.tsx': ['qada-8k-story'],
  'src/components/CassationJudgesPanel.tsx': ['qada-8k-judge-panel'],
  'src/components/JudgesCassationReviewPanel.tsx': ['qada-8k-judge-panel'],
  'src/components/admin/AdminAgentMap.tsx': ['qada-8k-admin-view'],
  'src/components/admin/AdminAnalysisRoom.tsx': ['qada-8k-admin-view'],
  'src/components/admin/AdminAuditLog.tsx': ['qada-8k-admin-view'],
  'src/components/admin/AdminSentinel.tsx': ['qada-8k-admin-view', 'qada-8k-sentinel'],
  'src/components/admin/AdminUserManagement.tsx': ['qada-8k-admin-view'],
};

for (const [path, hooks] of Object.entries(requiredHooks)) {
  const source = fs.readFileSync(path, 'utf8');
  for (const hook of hooks) {
    assert(source.includes(hook), 'Missing premium hook ' + hook + ' in ' + path);
  }
}

for (const path of [
  'src/components/workspaces/AdministrativeWorkspace.tsx',
  'src/components/workspaces/GeneralWorkspace.tsx',
  'src/components/workspaces/CriminalWorkspace.tsx',
]) {
  const source = fs.readFileSync(path, 'utf8');
  assert(source.includes('qada-case-workspace'), 'Case workspace missing unified QADA premium hook: ' + path);
  assert(!source.includes('🪄'), 'Emoji must not be used as professional UI icon: ' + path);
}

for (const path of [
  'src/components/workspaces/PlainStoryInput.tsx',
  'src/components/workspaces/LegalReviewEditor.tsx',
  'src/components/JudgesCassationReviewPanel.tsx',
]) {
  const source = fs.readFileSync(path, 'utf8');
  for (const emoji of ['📋', '🪄', '⚖️', '⚠️', '📎']) {
    assert(!source.includes(emoji), 'Structural emoji remains in professional UI: ' + emoji + ' in ' + path);
  }
}

for (const path of [
  'src/components/AccountSecurityModal.tsx',
  'src/components/CasePleadingStudioModal.tsx',
  'src/components/JudgmentRepositoryModal.tsx',
  'src/components/ChatSettingsModal.tsx',
  'src/components/Article8CalculatorModal.tsx',
  'src/components/PromptLibraryModal.tsx',
  'src/components/PdfUploadModal.tsx',
]) {
  const source = fs.readFileSync(path, 'utf8');
  assert(source.includes('aria-label='), 'Premium modal needs accessible icon-control labels: ' + path);
}

console.log(JSON.stringify({
  ok: true,
  source: 'a123z-debug/ui-ux-pro-max-skill',
  system: 'QADA 8K Quiet Luxury',
  componentHooks: Object.keys(requiredHooks).length,
  accessibility: true,
  reducedMotion: true,
  remoteFonts: false,
  structuralEmoji: false,
}, null, 2));
