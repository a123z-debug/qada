import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const css = fs.readFileSync('src/index.css', 'utf8');
const welcome = fs.readFileSync('src/components/workspaces/WelcomeScreen.tsx', 'utf8');
const sidebar = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
const master = fs.readFileSync('design-system/qada/MASTER.md', 'utf8');

for (const token of [
  '--qada-ink-950',
  '--qada-green-700',
  '--qada-gold-500',
  '--qada-ivory-50',
]) {
  assert(css.includes(token), 'Quiet Luxury token missing: ' + token);
}

for (const className of [
  'qada-luxury-simple',
  'qada-consultation-desk',
  'qada-simple-composer',
  'qada-professional-screen',
  'qada-pro-hero',
  'qada-pro-court-card',
  'qada-pro-feature',
]) {
  assert(welcome.includes(className), 'Premium workspace class missing: ' + className);
}

for (const className of [
  'qada-luxury-user-sidebar',
  'qada-luxury-admin-sidebar',
  'qada-sidebar-emblem',
  'qada-sidebar-court',
]) {
  assert(sidebar.includes(className), 'Premium sidebar class missing: ' + className);
}

assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'Reduced-motion support is required');
assert(css.includes('min-height: 46px') || css.includes('min-height: 44px') || welcome.includes('min-h-11'), 'Touch targets must stay at least 44px');
assert(!css.includes('@import url("https://fonts.googleapis.com') && !css.includes("@import url('https://fonts.googleapis.com"), 'Remote font imports are forbidden');
assert(master.includes('Quiet Luxury') && master.includes('Mobile-first') && master.includes('Avoid neon'), 'Design-system master must preserve the premium direction and anti-patterns');
assert(css.includes('qada-user-auth-shell') && css.includes('qada-riyadh-hero'), 'Public landing and auth surfaces must share the premium identity');

for (const path of [
  'src/components/workspaces/AdministrativeWorkspace.tsx',
  'src/components/workspaces/GeneralWorkspace.tsx',
  'src/components/workspaces/CriminalWorkspace.tsx',
]) {
  const workspace = fs.readFileSync(path, 'utf8');
  assert(workspace.includes('qada-case-workspace'), 'Premium case workspace class missing: ' + path);
}
assert(css.includes('Case workspaces — one premium legal-document language'), 'Premium case workspace CSS layer missing');

console.log(JSON.stringify({
  ok: true,
  designSystem: 'QADA Quiet Luxury',
  userSimple: true,
  professional: true,
  sidebar: true,
  publicLanding: true,
  auth: true,
  reducedMotion: true,
  remoteFonts: false,
}, null, 2));
