import fs from 'node:fs';

const workspaceFiles = [
  'src/components/workspaces/AdministrativeWorkspace.tsx',
  'src/components/workspaces/CriminalWorkspace.tsx',
  'src/components/workspaces/GeneralWorkspace.tsx',
];

const violations: string[] = [];
for (const file of workspaceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('localStorage.setItem(storageKey')) {
    violations.push(file + ': draft is still persisted in localStorage');
  }
  if (!source.includes('sessionStorage.setItem(storageKey')) {
    violations.push(file + ': temporary session draft persistence missing');
  }
}

const app = fs.readFileSync('src/App.tsx', 'utf8');
if (app.includes('judgmentRecordsStorageKey') || app.includes('writeStorage(') || app.includes('readStorage<')) {
  violations.push('src/App.tsx: case repository must not use browser storage helpers');
}
if (!app.includes("fetch('/api/cases'") && !app.includes('fetch(`/api/cases')) {
  violations.push('src/App.tsx: encrypted server case repository is not wired');
}
if (!app.includes("localStorage.removeItem('diwan_pending_attachments_v1')")) {
  violations.push('src/App.tsx: legacy attachment cache cleanup missing');
}

const casesApi = fs.readFileSync('api/cases.ts', 'utf8');
if (!casesApi.includes("protectJson(value, 'case-record')")) {
  violations.push('api/cases.ts: case records are not encrypted before persistence');
}
if (!casesApi.includes("session.role !== 'admin'")) {
  violations.push('api/cases.ts: admin-only all-user case view is not enforced');
}

if (violations.length) {
  throw new Error('Privacy storage smoke failed:\n' + violations.join('\n'));
}

console.log(JSON.stringify({
  ok: true,
  temporaryWorkspaceDrafts: workspaceFiles.length,
  encryptedServerCases: true,
  persistentLegacyCleanup: true,
}, null, 2));