import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readActiveSession } from './session.js';
import { isRedisConfigured, redisCommand, redisPrefix } from './_redis.js';
import { protectJson, unprotectJson } from './_secureStore.js';

type AccountRecord = {
  version: 2;
  id: string;
  name: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: number;
  sessionRevision?: number;
  disabledAt?: number;
};

type StoredCase = {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  record: Record<string, unknown>;
  savedAt: number;
};

type WorkspaceState = {
  version: 1;
  simpleMessages: unknown[];
  simpleDraft: string;
  updatedAt: number;
};

type MigrationBundle = {
  schema: 1;
  exportedAt: number;
  sourcePrefix: string;
  accounts: AccountRecord[];
  cases: StoredCase[];
  workspaces: Array<{ ownerId: string; state: WorkspaceState }>;
  adminRuns: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
};

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function digest(value: string) {
  return sha256(value).slice(0, 40);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function safeTokenEqual(a: string, b: string) {
  const aa = createHash('sha256').update(a).digest();
  const bb = createHash('sha256').update(b).digest();
  return timingSafeEqual(aa, bb);
}

function migrationToken() {
  return String(process.env.QADA_MIGRATION_TOKEN || '').trim();
}

function migrationEnabled() {
  return migrationToken().length >= 32;
}

function accountKey(prefix: string, email: string) {
  return `${prefix}:account:${sha256(normalizeEmail(email))}`;
}
function accountIndexKey(prefix: string) {
  return `${prefix}:accounts:index`;
}
function accountIdKey(prefix: string, userId: string) {
  return `${prefix}:account-id:${sha256(userId)}`;
}
function allCasesKey(prefix: string) {
  return `${prefix}:cases:all`;
}
function userCasesKey(prefix: string, ownerId: string) {
  return `${prefix}:cases:user:${digest(ownerId)}`;
}
function caseKey(prefix: string, ownerId: string, caseId: string) {
  return `${prefix}:case:${digest(ownerId)}:${digest(caseId)}`;
}
function workspaceKey(prefix: string, ownerId: string) {
  return `${prefix}:workspace:${digest(ownerId)}`;
}
function personIndexKey(prefix: string, ownerId: string, nationalId: string) {
  return `${prefix}:cases:person:${digest(ownerId)}:${digest(nationalId)}`;
}
function runsKey(prefix: string) {
  return `${prefix}:admin:runs`;
}
function auditKey(prefix: string) {
  return `${prefix}:audit:v1`;
}

function normalizeNationalId(value: unknown) {
  return String(value || '').replace(/\D/g, '').slice(0, 20);
}

async function readMany(keys: string[]) {
  if (!keys.length) return [];
  const values = await redisCommand(['MGET', ...keys]);
  return Array.isArray(values) ? values : [];
}

async function buildExportBundle(): Promise<MigrationBundle> {
  if (!isRedisConfigured()) throw new Error('REDIS_NOT_CONFIGURED');
  const prefix = redisPrefix();

  const accountKeysRaw = await redisCommand(['SMEMBERS', accountIndexKey(prefix)]);
  const accountKeys = Array.isArray(accountKeysRaw) ? accountKeysRaw.filter((v): v is string => typeof v === 'string') : [];
  const accountValues = await readMany(accountKeys);
  const accounts = accountValues
    .map((value) => unprotectJson<AccountRecord>(typeof value === 'string' ? value : '', 'account-record'))
    .filter((value): value is AccountRecord => Boolean(value?.id && value?.email));

  const caseKeysRaw = await redisCommand(['SMEMBERS', allCasesKey(prefix)]);
  const caseKeys = Array.isArray(caseKeysRaw) ? caseKeysRaw.filter((v): v is string => typeof v === 'string') : [];
  const caseValues = await readMany(caseKeys);
  const cases = caseValues
    .map((value) => unprotectJson<StoredCase>(typeof value === 'string' ? value : '', 'case-record'))
    .filter((value): value is StoredCase => Boolean(value?.ownerId && value?.record));

  const ownerIds = new Set<string>(accounts.map((a) => a.id));
  for (const item of cases) ownerIds.add(item.ownerId);
  const workspaces: Array<{ ownerId: string; state: WorkspaceState }> = [];
  for (const ownerId of ownerIds) {
    const raw = await redisCommand(['GET', workspaceKey(prefix, ownerId)]);
    const state = unprotectJson<WorkspaceState>(typeof raw === 'string' ? raw : '', 'workspace-state');
    if (state?.version === 1) workspaces.push({ ownerId, state });
  }

  const runValues = await redisCommand(['LRANGE', runsKey(prefix), 0, 49]);
  const adminRuns = (Array.isArray(runValues) ? runValues : [])
    .map((value) => unprotectJson<Record<string, unknown>>(typeof value === 'string' ? value : '', 'admin-run'))
    .filter((value): value is Record<string, unknown> => Boolean(value));

  const auditValues = await redisCommand(['LRANGE', auditKey(prefix), 0, 499]);
  const auditEvents = (Array.isArray(auditValues) ? auditValues : [])
    .map((value) => unprotectJson<Record<string, unknown>>(typeof value === 'string' ? value : '', 'audit-event'))
    .filter((value): value is Record<string, unknown> => Boolean(value));

  return {
    schema: 1,
    exportedAt: Date.now(),
    sourcePrefix: prefix,
    accounts,
    cases,
    workspaces,
    adminRuns,
    auditEvents,
  };
}

function recordTimestamp(item: StoredCase) {
  const updatedAt = Number(item.record?.updatedAt || 0);
  return Math.max(Number(item.savedAt || 0), Number.isFinite(updatedAt) ? updatedAt : 0);
}

async function importBundle(bundle: MigrationBundle) {
  if (!isRedisConfigured()) throw new Error('REDIS_NOT_CONFIGURED');
  if (!bundle || bundle.schema !== 1) throw new Error('MIGRATION_SCHEMA_INVALID');
  const prefix = redisPrefix();

  const result = {
    accountsImported: 0,
    accountsSkipped: 0,
    casesImported: 0,
    casesSkipped: 0,
    workspacesImported: 0,
    workspacesSkipped: 0,
    adminRunsImported: 0,
    auditEventsImported: 0,
  };

  for (const account of bundle.accounts || []) {
    if (!account?.id || !account?.email || account.version !== 2) continue;
    const key = accountKey(prefix, account.email);
    const existingRaw = await redisCommand(['GET', key]);
    const existing = unprotectJson<AccountRecord>(typeof existingRaw === 'string' ? existingRaw : '', 'account-record');
    if (existing) {
      result.accountsSkipped += 1;
      continue;
    }
    await redisCommand(['SET', key, protectJson(account, 'account-record')]);
    await redisCommand(['SADD', accountIndexKey(prefix), key]);
    await redisCommand(['SET', accountIdKey(prefix, account.id), key]);
    result.accountsImported += 1;
  }

  for (const item of bundle.cases || []) {
    const id = String(item?.record?.id || '').trim();
    if (!item?.ownerId || !id) continue;
    const key = caseKey(prefix, item.ownerId, id);
    const existingRaw = await redisCommand(['GET', key]);
    const existing = unprotectJson<StoredCase>(typeof existingRaw === 'string' ? existingRaw : '', 'case-record');
    if (existing && recordTimestamp(existing) >= recordTimestamp(item)) {
      result.casesSkipped += 1;
      continue;
    }

    await redisCommand(['SET', key, protectJson(item, 'case-record')]);
    await redisCommand(['SADD', userCasesKey(prefix, item.ownerId), key]);
    await redisCommand(['SADD', allCasesKey(prefix), key]);
    const nationalId = normalizeNationalId(item.record?.nationalId);
    if (nationalId) await redisCommand(['SADD', personIndexKey(prefix, item.ownerId, nationalId), key]);
    result.casesImported += 1;
  }

  for (const item of bundle.workspaces || []) {
    if (!item?.ownerId || item?.state?.version !== 1) continue;
    const key = workspaceKey(prefix, item.ownerId);
    const existingRaw = await redisCommand(['GET', key]);
    const existing = unprotectJson<WorkspaceState>(typeof existingRaw === 'string' ? existingRaw : '', 'workspace-state');
    if (existing && Number(existing.updatedAt || 0) >= Number(item.state.updatedAt || 0)) {
      result.workspacesSkipped += 1;
      continue;
    }
    await redisCommand(['SET', key, protectJson(item.state, 'workspace-state')]);
    result.workspacesImported += 1;
  }

  const currentRunsRaw = await redisCommand(['LRANGE', runsKey(prefix), 0, 49]);
  const currentRuns = (Array.isArray(currentRunsRaw) ? currentRunsRaw : [])
    .map((value) => unprotectJson<Record<string, unknown>>(typeof value === 'string' ? value : '', 'admin-run'))
    .filter((value): value is Record<string, unknown> => Boolean(value));
  const runIds = new Set(currentRuns.map((run) => String(run.runId || '')));
  for (const run of [...(bundle.adminRuns || [])].reverse()) {
    const id = String(run.runId || '');
    if (!id || runIds.has(id)) continue;
    await redisCommand(['LPUSH', runsKey(prefix), protectJson(run, 'admin-run')]);
    runIds.add(id);
    result.adminRunsImported += 1;
  }
  await redisCommand(['LTRIM', runsKey(prefix), 0, 49]);

  const currentAuditRaw = await redisCommand(['LRANGE', auditKey(prefix), 0, 499]);
  const currentAudit = (Array.isArray(currentAuditRaw) ? currentAuditRaw : [])
    .map((value) => unprotectJson<Record<string, unknown>>(typeof value === 'string' ? value : '', 'audit-event'))
    .filter((value): value is Record<string, unknown> => Boolean(value));
  const auditIds = new Set(currentAudit.map((event) => String(event.id || '')));
  for (const event of [...(bundle.auditEvents || [])].reverse()) {
    const id = String(event.id || '');
    if (!id || auditIds.has(id)) continue;
    await redisCommand(['LPUSH', auditKey(prefix), protectJson(event, 'audit-event')]);
    auditIds.add(id);
    result.auditEventsImported += 1;
  }
  await redisCommand(['LTRIM', auditKey(prefix), 0, 499]);

  return result;
}

function sourceAuthorized(req: VercelRequest) {
  const configured = migrationToken();
  const supplied = String(req.headers['x-qada-migration-token'] || '');
  return configured.length >= 32 && supplied.length >= 32 && safeTokenEqual(configured, supplied);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!migrationEnabled()) return res.status(404).json({ error: 'NOT_FOUND' });

  const action = String(req.query?.action || '');

  if (req.method === 'GET' && action === 'export') {
    if (!sourceAuthorized(req)) return res.status(403).json({ error: 'MIGRATION_FORBIDDEN' });
    try {
      const bundle = await buildExportBundle();
      return res.status(200).json(bundle);
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'MIGRATION_EXPORT_FAILED' });
    }
  }

  if (req.method === 'POST' && action === 'pull') {
    const session = await readActiveSession(req.headers?.cookie);
    const adminAuthorized = Boolean(session && session.role === 'admin');
    const tokenAuthorized = sourceAuthorized(req);
    if (!adminAuthorized && !tokenAuthorized) {
      return res.status(403).json({ error: 'MIGRATION_FORBIDDEN' });
    }

    const sourceUrl = String(process.env.QADA_MIGRATION_SOURCE_URL || '').trim().replace(/\/$/, '');
    const token = migrationToken();
    if (!sourceUrl || token.length < 32) return res.status(503).json({ error: 'MIGRATION_SOURCE_NOT_CONFIGURED' });

    try {
      const response = await fetch(`${sourceUrl}/api/migration?action=export`, {
        headers: { 'x-qada-migration-token': token },
        cache: 'no-store',
      });
      if (!response.ok) return res.status(502).json({ error: `MIGRATION_SOURCE_HTTP_${response.status}` });
      const bundle = await response.json() as MigrationBundle;
      const result = await importBundle(bundle);
      return res.status(200).json({ ok: true, sourceExportedAt: bundle.exportedAt, result });
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'MIGRATION_PULL_FAILED' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
