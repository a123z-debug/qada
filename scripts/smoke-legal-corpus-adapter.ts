import {
  evaluateSaudiLegalCorpusManifest,
} from '../src/lib/legalCorpusAdapter.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const good = evaluateSaudiLegalCorpusManifest({
  version: 1,
  generated_at: '2026-10-06',
  jurisdiction: 'Saudi Arabia',
  repository: 'agent-os-lab/saudi-legal-corpus',
  consumption_policy: {
    qada_minimum_verification_status: 'verified',
    allow_needs_review_in_argument_generation: false,
    allow_partial_in_argument_generation: false,
    fail_closed_on_unknown_status: true,
  },
  systems: [
    {
      id: 'verified-law',
      name_ar: 'نظام متحقق',
      verification_status: 'verified',
      system_meta_path: 'systems/a/system.json',
      article_dataset_path: 'systems/a/articles.verified.json',
      qada_eligible: true,
    },
    {
      id: 'review-law',
      name_ar: 'نظام يحتاج مراجعة',
      verification_status: 'needs_review',
      system_meta_path: 'systems/b/system.json',
      article_dataset_path: 'systems/b/articles.needs-review.json',
      qada_eligible: false,
    },
  ],
  judgments_principles: [
    {
      id: 'verified-precedents',
      path: 'judgments-principles/verified',
      record_dataset_path: 'judgments-principles/verified/records.json',
      verification_status: 'verified',
      qada_eligible: true,
    },
    {
      id: 'draft-precedents',
      path: 'judgments-principles/draft',
      record_dataset_path: 'judgments-principles/draft/records.json',
      verification_status: 'unverified',
      qada_eligible: false,
    },
  ],
}, 'https://example.test/corpus');

assert(good.trusted, 'strict valid manifest must be trusted');
assert(good.eligibleSystems.length === 1, 'only verified eligible system should pass');
assert(good.blockedSystems.length === 1, 'needs_review system must stay blocked');
assert(good.eligiblePrecedentCorpora.length === 1, 'only verified eligible precedent corpus should pass');
assert(good.blockedPrecedentCorpora.length === 1, 'unverified precedent corpus must stay blocked');

const badPolicy = evaluateSaudiLegalCorpusManifest({
  version: 1,
  generated_at: '2026-10-06',
  jurisdiction: 'Saudi Arabia',
  repository: 'agent-os-lab/saudi-legal-corpus',
  consumption_policy: {
    qada_minimum_verification_status: 'verified',
    allow_needs_review_in_argument_generation: true,
    allow_partial_in_argument_generation: false,
    fail_closed_on_unknown_status: true,
  },
  systems: [],
  judgments_principles: [],
}, 'https://example.test/corpus');

assert(!badPolicy.trusted, 'relaxed manifest policy must fail closed');
assert(badPolicy.blockers.length > 0, 'relaxed manifest policy must explain blocker');

const unsafePrecedent = evaluateSaudiLegalCorpusManifest({
  version: 1,
  generated_at: '2026-10-07',
  jurisdiction: 'Saudi Arabia',
  repository: 'agent-os-lab/saudi-legal-corpus',
  consumption_policy: {
    qada_minimum_verification_status: 'verified',
    allow_needs_review_in_argument_generation: false,
    allow_partial_in_argument_generation: false,
    fail_closed_on_unknown_status: true,
  },
  systems: [],
  judgments_principles: [{
    id: 'unsafe-precedents',
    path: 'judgments-principles/unsafe',
    record_dataset_path: 'judgments-principles/unsafe/records.json',
    verification_status: 'partial',
    qada_eligible: true,
  }],
}, 'https://example.test/corpus');

assert(!unsafePrecedent.trusted, 'precedent eligibility must never override non-verified status');

const lyingEligibility = evaluateSaudiLegalCorpusManifest({
  version: 1,
  generated_at: '2026-10-06',
  jurisdiction: 'Saudi Arabia',
  repository: 'agent-os-lab/saudi-legal-corpus',
  consumption_policy: {
    qada_minimum_verification_status: 'verified',
    allow_needs_review_in_argument_generation: false,
    allow_partial_in_argument_generation: false,
    fail_closed_on_unknown_status: true,
  },
  systems: [{
    id: 'unsafe-law',
    name_ar: 'نظام غير متحقق',
    verification_status: 'partial',
    system_meta_path: 'systems/x/system.json',
    article_dataset_path: 'systems/x/articles.json',
    qada_eligible: true,
  }],
  judgments_principles: [],
}, 'https://example.test/corpus');

assert(!lyingEligibility.trusted, 'qada_eligible must never override non-verified status');

console.log(JSON.stringify({
  ok: true,
  eligible: good.eligibleSystems.length,
  blocked: good.blockedSystems.length,
  failClosedPolicy: badPolicy.blockers.length,
  failClosedEligibility: lyingEligibility.blockers.length,
  eligiblePrecedentCorpora: good.eligiblePrecedentCorpora.length,
  failClosedPrecedent: unsafePrecedent.blockers.length,
}, null, 2));
