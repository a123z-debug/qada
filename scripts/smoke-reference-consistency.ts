// Cross-layer consistency checks for the legal reference data. The platform
// keeps three reference layers (legacy library, official judicial index and the
// per-law official files used by the source agents); any disagreement in
// issuance data or verification status between them must fail the build.
import { OFFICIAL_JUDICIAL_REFERENCE_INDEX } from '../src/data/officialJudicialReferenceIndex.js';
import { OFFICIAL_REFERENCE_INDEX } from '../src/data/officialReferenceIndex.js';
import { LEGAL_REFERENCE_SYSTEMS } from '../src/data/legalReferences.js';
import { BOARD_OF_GRIEVANCES_LAW_1428 } from '../src/data/officialReferences/boardOfGrievancesLaw1428.js';
import { BOARD_OF_GRIEVANCES_PROCEDURE_LAW_1435 } from '../src/data/officialReferences/boardOfGrievancesProcedureLaw1435.js';
import { BOARD_OF_GRIEVANCES_EXECUTION_LAW_1443 } from '../src/data/officialReferences/boardOfGrievancesExecutionLaw1443.js';
import { CIVIL_PROCEDURE_LAW_1435 } from '../src/data/officialReferences/civilProcedureLaw1435.js';
import { COMMERCIAL_COURTS_LAW_1441 } from '../src/data/officialReferences/commercialCourtsLaw1441.js';
import { CRIMINAL_PROCEDURE_LAW_1435 } from '../src/data/officialReferences/criminalProcedureLaw1435.js';
import { EXECUTION_LAW_1447 } from '../src/data/officialReferences/executionLaw1447.js';
import { JUDICIARY_LAW_1428 } from '../src/data/officialReferences/judiciaryLaw1428.js';
import { LAW_PRACTICE_LAW_1422 } from '../src/data/officialReferences/lawPracticeLaw1422.js';
import { PERSONNEL_SERVICE_LAW_1397 } from '../src/data/officialReferences/personnelServiceLaw1397.js';

type Row = { layer: string; id: string; name: string; instrument: string; cabinet: string; issue: string; verified: boolean };

const failures: string[] = [];
let checks = 0;

const normalizeName = (value: string) => value.replace(/\s+/g, '').replace(/[أإآ]/g, 'ا');
// Compare the numbers (decree number, resolution number, Hijri date parts) regardless of formatting.
const numbers = (value: string) => (value.match(/\d+/g) || []).map(Number).sort((a, b) => a - b).join(',');

const officialFiles = [
  BOARD_OF_GRIEVANCES_LAW_1428, BOARD_OF_GRIEVANCES_PROCEDURE_LAW_1435, BOARD_OF_GRIEVANCES_EXECUTION_LAW_1443,
  CIVIL_PROCEDURE_LAW_1435, COMMERCIAL_COURTS_LAW_1441, CRIMINAL_PROCEDURE_LAW_1435, EXECUTION_LAW_1447,
  JUDICIARY_LAW_1428, LAW_PRACTICE_LAW_1422, PERSONNEL_SERVICE_LAW_1397,
];

const rows: Row[] = [
  ...[...OFFICIAL_REFERENCE_INDEX, ...officialFiles].map((system) => ({
    layer: 'official-file', id: system.id, name: system.name, instrument: system.royalDecree,
    cabinet: system.cabinetResolution || '', issue: system.issueDateHijri, verified: system.status === 'verified',
  })),
  ...OFFICIAL_JUDICIAL_REFERENCE_INDEX.map((reference) => ({
    layer: 'judicial-index', id: reference.id, name: reference.systemName, instrument: reference.issueInstrument,
    cabinet: reference.cabinetResolution || '', issue: reference.issueDateHijri, verified: reference.status === 'official-verified',
  })),
  ...LEGAL_REFERENCE_SYSTEMS.map((system) => ({
    layer: 'legacy', id: system.id, name: system.name, instrument: system.royalDecree,
    cabinet: system.cabinetResolution, issue: system.issueDateHijri, verified: system.verificationStatus === 'official',
  })),
];

const byName = new Map<string, Row[]>();
for (const row of rows) byName.set(normalizeName(row.name), [...(byName.get(normalizeName(row.name)) || []), row]);

for (const [, group] of byName) {
  if (group.length < 2) continue;
  const describe = (row: Row) => `${row.layer}:${row.id}`;
  for (const [field, pick] of [
    ['issuance instrument', (row: Row) => numbers(row.instrument)],
    ['cabinet resolution', (row: Row) => numbers(row.cabinet)],
    ['issue date', (row: Row) => numbers(row.issue)],
  ] as const) {
    const values = new Map<string, string[]>();
    for (const row of group) {
      const value = pick(row);
      if (!value) continue;
      values.set(value, [...(values.get(value) || []), describe(row)]);
    }
    checks++;
    if (values.size > 1) {
      failures.push(`${group[0].name}: conflicting ${field} → ${[...values.entries()].map(([v, who]) => `[${v}] ${who.join(', ')}`).join(' | ')}`);
    }
  }
  // A system flagged needs-correction anywhere official cannot be "verified" in another official layer.
  const officialRows = group.filter((row) => row.layer !== 'legacy');
  checks++;
  if (officialRows.some((row) => row.verified) && officialRows.some((row) => !row.verified)) {
    failures.push(`${group[0].name}: verification status disagrees → ${officialRows.map((row) => `${describe(row)}=${row.verified ? 'verified' : 'needs-correction'}`).join(', ')}`);
  }
}

const hijri = /^(1[34]\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|30)$/;
for (const system of LEGAL_REFERENCE_SYSTEMS) {
  checks++;
  if (hijri.test(system.issueDateHijri) && hijri.test(system.effectiveDateHijri) && system.effectiveDateHijri < system.issueDateHijri) {
    failures.push(`${system.name}: effective date ${system.effectiveDateHijri} precedes issue date ${system.issueDateHijri}`);
  }
}

// Saudi government domains only.
const allowedHosts = /(?:^|\.)gov\.sa$/;
const urls = [
  ...officialFiles.flatMap((system) => [...system.sources.map((source) => source.url), ...system.articles.map((article) => article.sourceUrl)]),
  ...OFFICIAL_JUDICIAL_REFERENCE_INDEX.map((reference) => reference.officialSourceUrl),
  ...LEGAL_REFERENCE_SYSTEMS.map((system) => system.officialSourceUrl).filter((url): url is string => Boolean(url)),
];
for (const url of urls) {
  checks++;
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !allowedHosts.test(parsed.host)) failures.push(`non-official source URL: ${url}`);
}

for (const system of officialFiles) {
  const seen = new Set<string>();
  for (const article of system.articles) {
    checks++;
    if (seen.has(article.number)) failures.push(`${system.id}: duplicate article ${article.number}`);
    seen.add(article.number);
  }
}

if (failures.length) {
  console.error(`reference consistency FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checks, systems: byName.size }, null, 2));
