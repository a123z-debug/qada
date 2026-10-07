export type CorpusVerificationStatus = 'verified' | 'partial' | 'unverified' | 'needs_review';

export type CorpusSystemManifest = {
  id: string;
  name_ar: string;
  verification_status: CorpusVerificationStatus;
  system_meta_path: string;
  article_dataset_path: string;
  table_dataset_path?: string | null;
  qada_eligible: boolean;
  reason_ar?: string;
};

export type CorpusPrecedentManifest = {
  id: string;
  path: string;
  record_dataset_path?: string | null;
  verification_status: CorpusVerificationStatus;
  qada_eligible: boolean;
};

export type SaudiLegalCorpusManifest = {
  version: 1;
  generated_at: string;
  jurisdiction: string;
  repository: string;
  consumption_policy: {
    qada_minimum_verification_status: 'verified';
    allow_needs_review_in_argument_generation: false;
    allow_partial_in_argument_generation: false;
    fail_closed_on_unknown_status: true;
    note_ar?: string;
  };
  systems: CorpusSystemManifest[];
  judgments_principles: CorpusPrecedentManifest[];
};

export type CorpusBridgeStatus = {
  configured: boolean;
  available: boolean;
  trusted: boolean;
  baseUrl: string;
  eligibleSystems: CorpusSystemManifest[];
  blockedSystems: CorpusSystemManifest[];
  eligiblePrecedentCorpora: CorpusPrecedentManifest[];
  blockedPrecedentCorpora: CorpusPrecedentManifest[];
  blockers: string[];
  manifest?: SaudiLegalCorpusManifest;
};

export type VerifiedCorpusPrecedent = {
  record_id: string;
  court_system: string;
  court_name: string;
  court_level?: string | null;
  circuit?: string | null;
  case_number: string;
  judgment_number?: string | null;
  judgment_date: { hijri: string; gregorian?: string | null };
  source_title?: string | null;
  source_url: string;
  publication_authority?: string | null;
  facts_summary?: string | null;
  legal_issues?: string[];
  cited_provisions?: Array<{ instrument: string; provision: string; source_url?: string | null }>;
  holding_summary?: string | null;
  outcome?: string | null;
  principle: {
    text: string;
    kind: 'verbatim-official';
    citation_ready: true;
    source_locator?: string | null;
  };
  verification: {
    status: 'verified';
    verified_at?: string | null;
    content_sha256?: string | null;
    source_sha256?: string | null;
  };
};

export type VerifiedCorpusArticle = {
  system_id: string;
  article_number: string;
  current_text: string;
  effective_date?: string | null;
  amendments?: string[];
  amending_instruments?: string[];
  sources: string[];
  source_urls?: string[];
  verification: {
    status: 'verified';
    verified_at?: string | null;
    content_sha256?: string | null;
  };
};

function safeBaseUrl(value: string): string {
  const raw = String(value || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function isVerificationStatus(value: unknown): value is CorpusVerificationStatus {
  return value === 'verified'
    || value === 'partial'
    || value === 'unverified'
    || value === 'needs_review';
}

function normalizePrecedentCorpus(input: unknown): CorpusPrecedentManifest | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (
    typeof raw.id !== 'string'
    || typeof raw.path !== 'string'
    || !isVerificationStatus(raw.verification_status)
    || typeof raw.qada_eligible !== 'boolean'
  ) {
    return null;
  }
  return {
    id: raw.id.trim().slice(0, 160),
    path: raw.path.trim().slice(0, 500),
    record_dataset_path: typeof raw.record_dataset_path === 'string'
      ? raw.record_dataset_path.trim().slice(0, 500)
      : null,
    verification_status: raw.verification_status,
    qada_eligible: raw.qada_eligible,
  };
}

function normalizeSystem(input: unknown): CorpusSystemManifest | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (
    typeof raw.id !== 'string'
    || typeof raw.name_ar !== 'string'
    || !isVerificationStatus(raw.verification_status)
    || typeof raw.system_meta_path !== 'string'
    || typeof raw.article_dataset_path !== 'string'
    || typeof raw.qada_eligible !== 'boolean'
  ) {
    return null;
  }
  return {
    id: raw.id.trim().slice(0, 160),
    name_ar: raw.name_ar.trim().slice(0, 300),
    verification_status: raw.verification_status,
    system_meta_path: raw.system_meta_path.trim().slice(0, 500),
    article_dataset_path: raw.article_dataset_path.trim().slice(0, 500),
    table_dataset_path: typeof raw.table_dataset_path === 'string' ? raw.table_dataset_path.trim().slice(0, 500) : null,
    qada_eligible: raw.qada_eligible,
    reason_ar: typeof raw.reason_ar === 'string' ? raw.reason_ar.trim().slice(0, 1000) : '',
  };
}

export function evaluateSaudiLegalCorpusManifest(payload: unknown, baseUrl = ''): CorpusBridgeStatus {
  const blockers: string[] = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      configured: Boolean(baseUrl),
      available: false,
      trusted: false,
      baseUrl,
      eligibleSystems: [],
      blockedSystems: [],
      eligiblePrecedentCorpora: [],
      blockedPrecedentCorpora: [],
      blockers: ['Saudi Legal Corpus manifest غير صالح أو غير قابل للقراءة.'],
    };
  }

  const raw = payload as Record<string, unknown>;
  const policy = raw.consumption_policy && typeof raw.consumption_policy === 'object' && !Array.isArray(raw.consumption_policy)
    ? raw.consumption_policy as Record<string, unknown>
    : null;

  if (raw.version !== 1) blockers.push('إصدار manifest غير مدعوم.');
  if (raw.jurisdiction !== 'Saudi Arabia') blockers.push('نطاق corpus لا يطابق المملكة العربية السعودية.');
  if (raw.repository !== 'agent-os-lab/saudi-legal-corpus') blockers.push('هوية مستودع corpus غير متوقعة.');

  const strictPolicy = Boolean(
    policy
    && policy.qada_minimum_verification_status === 'verified'
    && policy.allow_needs_review_in_argument_generation === false
    && policy.allow_partial_in_argument_generation === false
    && policy.fail_closed_on_unknown_status === true
  );
  if (!strictPolicy) blockers.push('سياسة استهلاك corpus لا تحقق شرط QADA fail-closed.');

  const systemsRaw = Array.isArray(raw.systems) ? raw.systems : [];
  const systems = systemsRaw.map(normalizeSystem).filter((item): item is CorpusSystemManifest => Boolean(item));
  if (systems.length !== systemsRaw.length) blockers.push('manifest يحتوي سجلات أنظمة غير صالحة.');

  const eligibleSystems: CorpusSystemManifest[] = [];
  const blockedSystems: CorpusSystemManifest[] = [];
  for (const system of systems) {
    if (system.qada_eligible && system.verification_status === 'verified') {
      eligibleSystems.push(system);
      continue;
    }
    blockedSystems.push(system);
    if (system.qada_eligible && system.verification_status !== 'verified') {
      blockers.push(`النظام ${system.id} معلّم qada_eligible دون حالة verified.`);
    }
  }

  const precedentRaw = Array.isArray(raw.judgments_principles) ? raw.judgments_principles : [];
  const precedentCorpora = precedentRaw
    .map(normalizePrecedentCorpus)
    .filter((item): item is CorpusPrecedentManifest => Boolean(item));
  if (precedentCorpora.length !== precedentRaw.length) blockers.push('manifest يحتوي سجلات سوابق قضائية غير صالحة.');

  const eligiblePrecedentCorpora: CorpusPrecedentManifest[] = [];
  const blockedPrecedentCorpora: CorpusPrecedentManifest[] = [];
  for (const corpus of precedentCorpora) {
    if (
      corpus.qada_eligible
      && corpus.verification_status === 'verified'
      && corpus.record_dataset_path
    ) {
      eligiblePrecedentCorpora.push(corpus);
      continue;
    }
    blockedPrecedentCorpora.push(corpus);
    if (corpus.qada_eligible && corpus.verification_status !== 'verified') {
      blockers.push(`مجموعة السوابق ${corpus.id} معلّمة qada_eligible دون حالة verified.`);
    }
    if (corpus.qada_eligible && !corpus.record_dataset_path) {
      blockers.push(`مجموعة السوابق ${corpus.id} مؤهلة دون record_dataset_path.`);
    }
  }

  const manifest = blockers.length === 0
    ? payload as SaudiLegalCorpusManifest
    : undefined;

  return {
    configured: Boolean(baseUrl),
    available: true,
    trusted: blockers.length === 0,
    baseUrl,
    eligibleSystems,
    blockedSystems,
    eligiblePrecedentCorpora,
    blockedPrecedentCorpora,
    blockers: Array.from(new Set(blockers)),
    ...(manifest ? { manifest } : {}),
  };
}

export async function loadSaudiLegalCorpusManifest(): Promise<CorpusBridgeStatus> {
  const configured = String(process.env.SAUDI_LEGAL_CORPUS_BASE_URL || '').trim();
  if (!configured) {
    return {
      configured: false,
      available: false,
      trusted: false,
      baseUrl: '',
      eligibleSystems: [],
      blockedSystems: [],
      eligiblePrecedentCorpora: [],
      blockedPrecedentCorpora: [],
      blockers: ['SAUDI_LEGAL_CORPUS_BASE_URL غير مهيأ؛ الجسر الخارجي معطل دون تأثير على الفهارس الداخلية.'],
    };
  }

  const baseUrl = safeBaseUrl(configured);
  if (!baseUrl) {
    return {
      configured: true,
      available: false,
      trusted: false,
      baseUrl: '',
      eligibleSystems: [],
      blockedSystems: [],
      eligiblePrecedentCorpora: [],
      blockedPrecedentCorpora: [],
      blockers: ['SAUDI_LEGAL_CORPUS_BASE_URL يجب أن يكون رابط HTTPS صالحاً بلا بيانات اعتماد مضمّنة.'],
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/manifest.v1.json`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
      cache: 'no-store',
    });
    if (!response.ok) {
      return {
        configured: true,
        available: false,
        trusted: false,
        baseUrl,
        eligibleSystems: [],
        blockedSystems: [],
        blockers: [`تعذر قراءة Saudi Legal Corpus manifest (HTTP ${response.status}).`],
      };
    }
    const payload = await response.json();
    return evaluateSaudiLegalCorpusManifest(payload, baseUrl);
  } catch (error) {
    return {
      configured: true,
      available: false,
      trusted: false,
      baseUrl,
      eligibleSystems: [],
      blockedSystems: [],
      eligiblePrecedentCorpora: [],
      blockedPrecedentCorpora: [],
      blockers: [`تعذر الاتصال بـ Saudi Legal Corpus: ${error instanceof Error ? error.message : 'unknown error'}`],
    };
  }
}

function requestedArticleNumbers(query: string): Set<string> {
  const out = new Set<string>();
  const patterns = [
    /الماد(?:ة|ه)\s*\(?\s*(\d{1,3})(?:\s*\/\s*(\d{1,3}))?\s*\)?/g,
    /ماد(?:ة|ه)\s*\(?\s*(\d{1,3})(?:\s*\/\s*(\d{1,3}))?\s*\)?/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(query)) !== null) {
      out.add(match[2] ? `${match[1]}/${match[2]}` : match[1]);
    }
  }
  return out;
}

export async function fetchVerifiedCorpusArticles(query: string): Promise<{
  status: CorpusBridgeStatus;
  articles: VerifiedCorpusArticle[];
  blockers: string[];
}> {
  const status = await loadSaudiLegalCorpusManifest();
  if (!status.configured || !status.available || !status.trusted || !status.manifest) {
    return { status, articles: [], blockers: status.blockers };
  }

  const requested = requestedArticleNumbers(query);
  if (requested.size === 0 || status.eligibleSystems.length === 0) {
    return { status, articles: [], blockers: [] };
  }

  const articles: VerifiedCorpusArticle[] = [];
  const blockers: string[] = [];

  for (const system of status.eligibleSystems.slice(0, 8)) {
    try {
      const response = await fetch(`${status.baseUrl}/${system.article_dataset_path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3500),
        cache: 'no-store',
      });
      if (!response.ok) {
        blockers.push(`تعذر قراءة dataset للنظام ${system.id} (HTTP ${response.status}).`);
        continue;
      }
      const payload = await response.json() as { articles?: unknown[] };
      for (const item of Array.isArray(payload?.articles) ? payload.articles : []) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const raw = item as Record<string, any>;
        const number = String(raw.article_number || '').trim();
        if (!requested.has(number)) continue;
        if (raw.verification?.status !== 'verified') {
          blockers.push(`رفض corpus المادة ${number} من ${system.id}: حالة السجل ليست verified.`);
          continue;
        }
        if (
          raw.system_id !== system.id
          || typeof raw.current_text !== 'string'
          || !Array.isArray(raw.sources)
        ) {
          blockers.push(`رفض corpus المادة ${number} من ${system.id}: بنية السجل غير مكتملة.`);
          continue;
        }
        articles.push({
          system_id: system.id,
          article_number: number,
          current_text: raw.current_text,
          effective_date: typeof raw.effective_date === 'string' ? raw.effective_date : null,
          amendments: Array.isArray(raw.amendments) ? raw.amendments.map(String) : [],
          amending_instruments: Array.isArray(raw.amending_instruments) ? raw.amending_instruments.map(String) : [],
          sources: raw.sources.map(String),
          source_urls: Array.isArray(raw.source_urls) ? raw.source_urls.map(String) : [],
          verification: {
            status: 'verified',
            verified_at: typeof raw.verification?.verified_at === 'string' ? raw.verification.verified_at : null,
            content_sha256: typeof raw.verification?.content_sha256 === 'string' ? raw.verification.content_sha256 : null,
          },
        });
      }
    } catch (error) {
      blockers.push(`تعذر قراءة dataset للنظام ${system.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return {
    status,
    articles: articles.slice(0, 40),
    blockers: Array.from(new Set(blockers)),
  };
}


function normalizeCorpusSearchText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function corpusQueryTokens(query: string): string[] {
  return Array.from(new Set(
    normalizeCorpusSearchText(query)
      .split(' ')
      .filter((token) => token.length >= 3)
      .slice(0, 60),
  ));
}

export async function fetchVerifiedCorpusPrecedents(query: string): Promise<{
  status: CorpusBridgeStatus;
  precedents: VerifiedCorpusPrecedent[];
  blockers: string[];
}> {
  const status = await loadSaudiLegalCorpusManifest();
  if (!status.configured || !status.available || !status.trusted || !status.manifest) {
    return { status, precedents: [], blockers: status.blockers };
  }

  if (status.eligiblePrecedentCorpora.length === 0) {
    return {
      status,
      precedents: [],
      blockers: ['لا توجد حالياً مجموعة سوابق قضائية verified ومؤهلة لـ QADA في Saudi Legal Corpus.'],
    };
  }

  const tokens = corpusQueryTokens(query);
  const candidates: Array<{ score: number; record: VerifiedCorpusPrecedent }> = [];
  const blockers: string[] = [];

  for (const corpus of status.eligiblePrecedentCorpora.slice(0, 6)) {
    if (!corpus.record_dataset_path) continue;
    try {
      const response = await fetch(`${status.baseUrl}/${corpus.record_dataset_path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3500),
        cache: 'no-store',
      });
      if (!response.ok) {
        blockers.push(`تعذر قراءة مجموعة السوابق ${corpus.id} (HTTP ${response.status}).`);
        continue;
      }

      const payload = await response.json() as { records?: unknown[] };
      for (const item of Array.isArray(payload.records) ? payload.records : []) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const raw = item as Record<string, any>;
        if (
          raw.verification?.status !== 'verified'
          || raw.principle?.kind !== 'verbatim-official'
          || raw.principle?.citation_ready !== true
          || typeof raw.source_url !== 'string'
          || typeof raw.record_id !== 'string'
          || typeof raw.case_number !== 'string'
          || typeof raw.court_name !== 'string'
          || typeof raw.principle?.text !== 'string'
        ) {
          blockers.push(`رفض سجل سابقة من ${corpus.id}: السجل ليس verified + verbatim-official + citation_ready.`);
          continue;
        }

        const haystack = normalizeCorpusSearchText([
          raw.court_name,
          raw.case_number,
          raw.judgment_number || '',
          raw.facts_summary || '',
          ...(Array.isArray(raw.legal_issues) ? raw.legal_issues : []),
          raw.holding_summary || '',
          raw.outcome || '',
          raw.principle.text,
        ].join(' '));
        const score = tokens.length === 0
          ? 1
          : tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
        if (score <= 0) continue;

        candidates.push({
          score,
          record: raw as VerifiedCorpusPrecedent,
        });
      }
    } catch (error) {
      blockers.push(`تعذر قراءة مجموعة السوابق ${corpus.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return {
    status,
    precedents: candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((item) => item.record),
    blockers: Array.from(new Set(blockers)),
  };
}
