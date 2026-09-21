import fs from 'node:fs';

const files = [
  'src/components/ChatSettingsModal.tsx',
  'src/components/CasePleadingStudioModal.tsx',
  'src/components/JudgesCassationReviewPanel.tsx',
  'src/components/CassationJudgesPanel.tsx',
  'src/components/workspaces/WelcomeScreen.tsx',
  'src/data/promptTemplates.ts',
  'src/main.tsx',
  'src/App.tsx',
  'src/components/workspaces/AdministrativeWorkspace.tsx',
  'src/components/workspaces/CriminalWorkspace.tsx',
  'src/components/workspaces/GeneralWorkspace.tsx',
  'src/components/workspaces/LegalReviewEditor.tsx',
];

const banned: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /clientNationalId/g, reason: 'national ID must not be sent to AI routes' },
  { pattern: /1082918231/g, reason: 'hard-coded fallback identity is forbidden' },
  { pattern: /المرسوم الملكي الكريم رقم \(م\/37\)/g, reason: 'hard-coded legal conclusion must come from verified source retrieval' },
  { pattern: /حيث تنص المادة \(35\)/g, reason: 'hard-coded statutory quotation is forbidden in UI fallbacks' },
  { pattern: /المادة \(193\)/g, reason: 'hard-coded cassation citation is forbidden in UI copy' },
  { pattern: /مبدأ قضائي سارٍ/g, reason: 'UI must not label precedents as valid without source verification' },
  { pattern: /الأسانيد مطابقة للأنظمة/g, reason: 'UI must not claim universal source accuracy' },
  { pattern: /سليم تماماً/g, reason: 'AI review must not present absolute legal safety claims' },
  { pattern: /سلامة البناء القضائي[\s\S]{0,120}78%/g, reason: 'dashboard must not display a fabricated fixed legal-safety score' },
  { pattern: /FrontendGuard/g, reason: 'frontend must not disable normal copy/print/browser controls' },
  { pattern: /localStorage\.setItem\(['"]diwan_pending_attachments_v1['"]/g, reason: 'attachments must not be persisted unencrypted in legacy localStorage' },
  { pattern: /\.doc,\.docx/g, reason: 'unsupported Office files must not be advertised as directly analyzable' },
  { pattern: /جاهزة للإيداع في منصة \(معين\)/g, reason: 'prompt templates must not promise filing readiness' },
  { pattern: /المرسوم م\/37/g, reason: 'prompt templates must not hard-code a case-specific decree conclusion' },
];

const violations: string[] = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const rule of banned) {
    const matches = text.match(rule.pattern);
    if (matches?.length) {
      violations.push(`${file}: ${rule.reason} (${matches.length})`);
    }
  }
}

if (violations.length) {
  throw new Error(`Legal UI safety guard failed:\n${violations.join('\n')}`);
}

console.log(JSON.stringify({ ok: true, checkedFiles: files.length, rules: banned.length }, null, 2));
