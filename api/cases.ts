import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { readActiveSession } from './session.js';
import { isRedisConfigured, redisCommand, redisPrefix } from './_redis.js';
import { enforceRateLimit } from './_rateLimit.js';
import { protectJson, unprotectJson } from './_secureStore.js';
import { recordAuditEvent } from './_audit.js';

type StoredCase = {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  record: Record<string, unknown>;
  savedAt: number;
};

type SharedWorkspaceMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type SharedWorkspaceState = {
  version: 1;
  simpleMessages: SharedWorkspaceMessage[];
  simpleDraft: string;
  updatedAt: number;
};

const MAX_CASES_PER_USER = 100;
const MAX_CASES_ADMIN_VIEW = 300;

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 40);
}

function userIndexKey(ownerId: string) {
  return `${redisPrefix()}:cases:user:${digest(ownerId)}`;
}

function allIndexKey() {
  return `${redisPrefix()}:cases:all`;
}

function caseKey(ownerId: string, caseId: string) {
  return `${redisPrefix()}:case:${digest(ownerId)}:${digest(caseId)}`;
}

function workspaceKey(ownerId: string) {
  return `${redisPrefix()}:workspace:${digest(ownerId)}`;
}

function normalizeNationalId(value: unknown): string {
  return String(value || '').replace(/\D/g, '').slice(0, 20);
}

function normalizeToken(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\u064B-\u065F\u0670]+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, 180);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 80)
    : [];
}

function sanitizeCaseKnowledge(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  const allowedKinds = new Set(['confirmed-fact', 'strength', 'risk', 'comparison', 'evidence-needed']);
  const allowedStatuses = new Set(['confirmed', 'needs-verification', 'pending-evidence']);
  const allowedConfidentiality = new Set(['case-only-secret', 'case-private', 'normal']);

  return value
    .slice(0, 200)
    .map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const raw = item as Record<string, unknown>;
      const confidentiality = allowedConfidentiality.has(String(raw.confidentiality || ''))
        ? String(raw.confidentiality)
        : 'case-private';
      const isCaseOnlySecret = confidentiality === 'case-only-secret';
      return {
        id: String(raw.id || `knowledge-${index + 1}`).slice(0, 180),
        kind: allowedKinds.has(String(raw.kind || '')) ? String(raw.kind) : 'confirmed-fact',
        title: String(raw.title || '').slice(0, 500),
        detail: String(raw.detail || '').slice(0, 12_000),
        status: allowedStatuses.has(String(raw.status || '')) ? String(raw.status) : 'needs-verification',
        confidentiality,
        allowedCaseOnly: isCaseOnlySecret ? true : Boolean(raw.allowedCaseOnly),
        excludeFromCrossCaseComparison: isCaseOnlySecret ? true : Boolean(raw.excludeFromCrossCaseComparison),
        excludeFromLegalCorpus: isCaseOnlySecret ? true : Boolean(raw.excludeFromLegalCorpus),
        sourceLabel: String(raw.sourceLabel || '').slice(0, 500),
        sourceDate: String(raw.sourceDate || '').slice(0, 120),
        createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now(),
      };
    })
    .filter((item) => item !== null) as Array<Record<string, unknown>>;
}

function stripCrossCaseKnowledge(record: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(record.caseKnowledge)) return record;
  return {
    ...record,
    caseKnowledge: record.caseKnowledge.filter((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const note = item as Record<string, unknown>;
      return note.confidentiality !== 'case-only-secret'
        && note.excludeFromCrossCaseComparison !== true;
    }),
  };
}

function personIndexKey(ownerId: string, nationalId: string) {
  return `${redisPrefix()}:cases:person:${digest(ownerId)}:${digest(nationalId)}`;
}

function collectCaseNumbers(record: Record<string, unknown>): Set<string> {
  const values = [
    record.caseNumber,
    record.rootCaseNumber,
    ...stringList(record.relatedCaseNumbers),
    ...(Array.isArray(record.caseChronology)
      ? record.caseChronology.flatMap((stage) => {
          if (!stage || typeof stage !== 'object') return [];
          const row = stage as Record<string, unknown>;
          return [row.caseNumber, ...stringList(row.relatedCaseNumbers)];
        })
      : []),
  ];
  return new Set(values.map(normalizeToken).filter(Boolean));
}

function collectJudgmentNumbers(record: Record<string, unknown>): Set<string> {
  const values = [
    record.judgmentNumber,
    ...stringList(record.relatedJudgmentNumbers),
    ...(Array.isArray(record.caseChronology)
      ? record.caseChronology.flatMap((stage) => {
          if (!stage || typeof stage !== 'object') return [];
          const row = stage as Record<string, unknown>;
          return stringList(row.relatedJudgmentNumbers);
        })
      : []),
  ];
  return new Set(values.map(normalizeToken).filter(Boolean));
}

function intersects(a: Set<string>, b: Set<string>) {
  for (const value of a) if (b.has(value)) return true;
  return false;
}

function dossierScore(record: Record<string, unknown>, existing: Record<string, unknown>): number {
  const nationalId = normalizeNationalId(record.nationalId);
  if (!nationalId || nationalId !== normalizeNationalId(existing.nationalId)) return -1;

  let score = 0;
  if (normalizeToken(record.agencyName) && normalizeToken(record.agencyName) === normalizeToken(existing.agencyName)) score += 20;
  if (intersects(collectCaseNumbers(record), collectCaseNumbers(existing))) score += 100;
  if (intersects(collectJudgmentNumbers(record), collectJudgmentNumbers(existing))) score += 80;

  const root = normalizeToken(record.rootCaseNumber);
  if (root && collectCaseNumbers(existing).has(root)) score += 100;

  const matter = normalizeToken(record.matterTitle);
  if (matter && matter === normalizeToken(existing.matterTitle)) score += 70;
  return score;
}

function hasExplicitDossierLinkEvidence(
  record: Record<string, unknown>,
  existing: Record<string, unknown>,
): boolean {
  if (intersects(collectCaseNumbers(record), collectCaseNumbers(existing))) return true;
  if (intersects(collectJudgmentNumbers(record), collectJudgmentNumbers(existing))) return true;
  const root = normalizeToken(record.rootCaseNumber);
  return Boolean(root && collectCaseNumbers(existing).has(root));
}

async function existingPersonCases(ownerId: string, nationalId: string): Promise<StoredCase[]> {
  if (!nationalId) return [];
  let members = await redisCommand(['SMEMBERS', personIndexKey(ownerId, nationalId)]);
  let keys = Array.isArray(members) ? members.filter((item): item is string => typeof item === 'string') : [];

  // Backfill support for records saved before the person index existed.
  if (!keys.length) {
    members = await redisCommand(['SMEMBERS', userIndexKey(ownerId)]);
    keys = Array.isArray(members) ? members.filter((item): item is string => typeof item === 'string') : [];
  }

  const records = await loadMany(keys.slice(0, MAX_CASES_PER_USER));
  return records.filter((item) => normalizeNationalId(item.record.nationalId) === nationalId);
}

async function attachDossierMetadata(ownerId: string, record: Record<string, unknown>): Promise<Record<string, unknown>> {
  const nationalId = normalizeNationalId(record.nationalId);
  if (!nationalId) {
    return {
      ...record,
      dossierId: typeof record.dossierId === 'string' && record.dossierId.trim()
        ? record.dossierId.trim().slice(0, 180)
        : `dos-${digest(`${ownerId}:${String(record.id)}`).slice(0, 24)}`,
      dossierLinkStatus: 'new',
    };
  }

  const identityFingerprint = digest(`${ownerId}:${nationalId}`).slice(0, 24);
  const explicitDossierId = typeof record.dossierId === 'string' ? record.dossierId.trim().slice(0, 180) : '';
  if (explicitDossierId) {
    return { ...record, identityFingerprint, dossierId: explicitDossierId, dossierLinkStatus: 'linked', candidateDossierId: undefined };
  }

  const existing = (await existingPersonCases(ownerId, nationalId))
    .filter((item) => String(item.record.id || '') !== String(record.id || ''))
    .map((item) => ({ item, score: dossierScore(record, item.record) }))
    .sort((a, b) => b.score - a.score);

  const best = existing[0];
  const existingDossier = best && typeof best.item.record.dossierId === 'string'
    ? String(best.item.record.dossierId)
    : '';

  if (best && best.score >= 80 && existingDossier && hasExplicitDossierLinkEvidence(record, best.item.record)) {
    return {
      ...record,
      identityFingerprint,
      dossierId: existingDossier,
      dossierLinkStatus: 'linked',
      candidateDossierId: undefined,
    };
  }

  const dossierId = `dos-${digest(`${ownerId}:${nationalId}:${String(record.id)}`).slice(0, 24)}`;
  if (best && best.score >= 20 && existingDossier) {
    return {
      ...record,
      identityFingerprint,
      dossierId,
      dossierLinkStatus: 'candidate',
      candidateDossierId: existingDossier,
    };
  }

  return { ...record, identityFingerprint, dossierId, dossierLinkStatus: 'new', candidateDossierId: undefined };
}

function sanitizeWorkspaceMessage(input: unknown): SharedWorkspaceMessage | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const item = input as Record<string, unknown>;
  const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
  const content = typeof item.content === 'string' ? item.content.trim().slice(0, 40_000) : '';
  const id = typeof item.id === 'string' ? item.id.trim().slice(0, 180) : '';
  if (!role || !content || !id) return null;
  return { id, role, content };
}

function sanitizeWorkspaceState(input: unknown): SharedWorkspaceState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_WORKSPACE_STATE');
  const raw = input as Record<string, unknown>;
  const simpleMessages = Array.isArray(raw.simpleMessages)
    ? raw.simpleMessages
        .map(sanitizeWorkspaceMessage)
        .filter((item): item is SharedWorkspaceMessage => Boolean(item))
        .slice(-40)
    : [];
  const simpleDraft = typeof raw.simpleDraft === 'string' ? raw.simpleDraft.slice(0, 20_000) : '';
  const state: SharedWorkspaceState = {
    version: 1,
    simpleMessages,
    simpleDraft,
    updatedAt: Date.now(),
  };
  if (JSON.stringify(state).length > 250_000) throw new Error('WORKSPACE_STATE_TOO_LARGE');
  return state;
}

function sanitizeRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_CASE');
  const record = input as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim().slice(0, 180) : '';
  if (!id) throw new Error('INVALID_CASE_ID');
  const raw = JSON.stringify(record);
  if (raw.length > 350_000) throw new Error('CASE_TOO_LARGE');
  const clean = JSON.parse(raw) as Record<string, unknown>;
  if ('caseKnowledge' in clean) clean.caseKnowledge = sanitizeCaseKnowledge(clean.caseKnowledge);
  return clean;
}

async function loadMany(keys: string[]): Promise<StoredCase[]> {
  if (!keys.length) return [];
  const values = await redisCommand(['MGET', ...keys]);
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => unprotectJson<StoredCase>(typeof value === 'string' ? value : '', 'case-record'))
    .filter((value): value is StoredCase => Boolean(value));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const session = await readActiveSession(req.headers?.cookie);
  if (!session) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  if (!isRedisConfigured() && req.method === 'GET') {
    return res.status(200).json({
      records: [],
      degraded: true,
      warning: 'مخزن القضايا الدائم غير مهيأ بعد.',
      meta: { scope: String(req.query?.scope || '') === 'all' ? 'all' : 'user', count: 0, truncated: false },
    });
  }
  if (!isRedisConfigured()) return res.status(503).json({ error: 'CASE_STORE_UNAVAILABLE' });

  try {
    const limit = await enforceRateLimit('cases', session.id, 120, 10 * 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }

    const workspaceMode = String(req.query?.workspace || '') === '1';
    if (workspaceMode) {
      if (req.method === 'GET') {
        const stored = await redisCommand(['GET', workspaceKey(session.id)]);
        const state = unprotectJson<SharedWorkspaceState>(
          typeof stored === 'string' ? stored : '',
          'workspace-state',
        );
        return res.status(200).json({
          state: state?.version === 1
            ? state
            : { version: 1, simpleMessages: [], simpleDraft: '', updatedAt: 0 },
        });
      }

      if (req.method === 'PUT' || req.method === 'POST') {
        const state = sanitizeWorkspaceState((req.body as any)?.state);
        await redisCommand(['SET', workspaceKey(session.id), protectJson(state, 'workspace-state')]);
        return res.status(200).json({ ok: true, state });
      }

      if (req.method === 'DELETE') {
        await redisCommand(['DEL', workspaceKey(session.id)]);
        return res.status(204).end();
      }

      res.setHeader('Allow', 'GET, PUT, POST, DELETE');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (req.method === 'GET') {
      const wantsAll = String(req.query?.scope || '') === 'all';
      if (wantsAll && session.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ONLY' });
      const index = wantsAll ? allIndexKey() : userIndexKey(session.id);
      const members = await redisCommand(['SMEMBERS', index]);
      const keys = Array.isArray(members) ? members.filter((item): item is string => typeof item === 'string') : [];
      const limitedKeys = keys.slice(0, wantsAll ? MAX_CASES_ADMIN_VIEW : MAX_CASES_PER_USER);
      const stored = await loadMany(limitedKeys);
      stored.sort((a, b) => Number(b.record.updatedAt || b.savedAt) - Number(a.record.updatedAt || a.savedAt));
      return res.status(200).json({
        records: stored.map((item) => wantsAll
          ? { ...stripCrossCaseKnowledge(item.record), storageOwnerId: item.ownerId }
          : item.record),
        meta: { scope: wantsAll ? 'all' : 'user', count: stored.length, truncated: keys.length > limitedKeys.length },
      });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const record = sanitizeRecord((req.body as any)?.record);
      const requestedOwner = typeof record.storageOwnerId === 'string' ? record.storageOwnerId.trim() : '';
      const ownerId = session.role === 'admin' && requestedOwner ? requestedOwner : session.id;
      const { storageOwnerId: _storageOwnerId, ...cleanInputRecord } = record;
      const cleanRecord = await attachDossierMetadata(ownerId, cleanInputRecord);
      const id = String(cleanRecord.id);
      const key = caseKey(ownerId, id);
      const value: StoredCase = {
        ownerId,
        ownerName: ownerId === session.id ? session.name : 'مستخدم المنصة',
        ownerEmail: ownerId === session.id ? session.email : '',
        record: cleanRecord,
        savedAt: Date.now(),
      };
      await redisCommand(['SET', key, protectJson(value, 'case-record')]);
      await redisCommand(['SADD', userIndexKey(ownerId), key]);
      await redisCommand(['SADD', allIndexKey(), key]);
      const nationalId = normalizeNationalId(cleanRecord.nationalId);
      if (nationalId) await redisCommand(['SADD', personIndexKey(ownerId, nationalId), key]);
      await recordAuditEvent({
        actorId: session.id,
        actorRole: session.role,
        action: 'case.save',
        targetType: 'case',
        targetId: `${ownerId}:${id}`,
        outcome: 'success',
        metadata: {
          adminCrossUser: ownerId !== session.id,
          dossierId: String(cleanRecord.dossierId || ''),
          dossierLinkStatus: String(cleanRecord.dossierLinkStatus || ''),
          identityFingerprint: String(cleanRecord.identityFingerprint || ''),
        },
      });
      return res.status(200).json({ ok: true, record: session.role === 'admin' ? { ...cleanRecord, storageOwnerId: ownerId } : cleanRecord });
    }

    if (req.method === 'DELETE') {
      const caseId = String(req.query?.id || '').trim();
      if (!caseId) return res.status(400).json({ error: 'CASE_ID_REQUIRED' });
      const requestedOwner = String(req.query?.ownerId || '').trim();
      const ownerId = session.role === 'admin' && requestedOwner ? requestedOwner : session.id;
      const key = caseKey(ownerId, caseId);
      const encodedBeforeDelete = await redisCommand(['GET', key]);
      const storedBeforeDelete = unprotectJson<StoredCase>(
        typeof encodedBeforeDelete === 'string' ? encodedBeforeDelete : '',
        'case-record',
      );
      await redisCommand(['DEL', key]);
      await redisCommand(['SREM', userIndexKey(ownerId), key]);
      await redisCommand(['SREM', allIndexKey(), key]);
      const nationalIdBeforeDelete = normalizeNationalId(storedBeforeDelete?.record?.nationalId);
      if (nationalIdBeforeDelete) {
        await redisCommand(['SREM', personIndexKey(ownerId, nationalIdBeforeDelete), key]);
      }
      await recordAuditEvent({
        actorId: session.id,
        actorRole: session.role,
        action: 'case.delete',
        targetType: 'case',
        targetId: `${ownerId}:${caseId}`,
        outcome: 'success',
        metadata: { adminCrossUser: ownerId !== session.id },
      });
      return res.status(204).end();
    }

    res.setHeader('Allow', 'GET, PUT, POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    console.error('Case store error:', code);
    if (code === 'INVALID_CASE' || code === 'INVALID_CASE_ID' || code === 'INVALID_WORKSPACE_STATE') return res.status(400).json({ error: code });
    if (code === 'CASE_TOO_LARGE') return res.status(413).json({ error: 'CASE_TOO_LARGE' });
    if (code === 'WORKSPACE_STATE_TOO_LARGE') return res.status(413).json({ error: 'WORKSPACE_STATE_TOO_LARGE' });
    return res.status(503).json({ error: 'CASE_STORE_UNAVAILABLE' });
  }
}