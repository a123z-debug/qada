import fs from 'node:fs';

const files = [
  'src/components/workspaces/AdministrativeWorkspace.tsx',
  'src/components/workspaces/CriminalWorkspace.tsx',
  'src/components/workspaces/GeneralWorkspace.tsx',
];

const violations: string[] = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('localStorage.setItem(storageKey')) {
    violations.push(`${file}: draft is still persisted in localStorage`);
  }
  if (!source.includes('sessionStorage.setItem(storageKey')) {
    violations.push(`${file}: session-scoped draft persistence missing`);
  }
}

const app = fs.readFileSync('src/App.tsx', 'utf8');
if (app.includes('localStorage.setItem(key, JSON.stringify(value))')) {
  violations.push('src/App.tsx: case repository still persists through localStorage');
}
if (!app.includes('sessionStorage.setItem(key, JSON.stringify(value))')) {
  violations.push('src/App.tsx: session-scoped repository persistence missing');
}
if (!app.includes("localStorage.removeItem('diwan_pending_attachments_v1')")) {
  violations.push('src/App.tsx: legacy attachment cache cleanup missing');
}

if (violations.length) {
  throw new Error(`Privacy storage smoke failed:\n${violations.join('\n')}`);
}

console.log(JSON.stringify({ ok: true, sessionScopedDrafts: files.length, persistentLegacyCleanup: true }, null, 2));