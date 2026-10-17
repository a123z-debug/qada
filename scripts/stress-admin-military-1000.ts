/**
 * اختبار القضاء الإداري — حقوق الأفراد العسكريين: 1000 قضية عن مكافأة الحاسب الآلي (مشغلو النهايات الطرفية)
 * والعلاوة الفنية (المادة 16 من نظام خدمة الأفراد ولائحته)، مع الأدوات التي يستشهد بها أصحاب هذه القضايا:
 * قرار مجلس الوزراء رقم 15 لعام 1413هـ وضوابطه، والمرسوم الملكي م/37 لعام 1432هـ، وقرار مجلس الوزراء رقم 118.
 *
 * يمر كل ملف على وكلاء المنصة الحتمية بنفس ترتيب مسار المحادثة وبوابة الاعتماد والمحكمة الإدارية الافتراضية،
 * ويقيس الثغرات. لا يستدعي أي نموذج ولا يحكم على صحة الأدوات نفسها: يقيس ما تعرفه المنصة وما تفعله بها.
 *
 * التشغيل: npx tsx scripts/stress-admin-military-1000.ts [--out report.json]
 */
import fs from 'node:fs';
import { identifyCourt, isConfidentIdentification, isSourceForeignToCourt, jurisdictionIssuesFor, resolveCourtSystem } from '../src/lib/courtJurisdiction';
import type { CourtLevelId } from '../src/lib/judicialSystem';
import { runLegalSourceAgents, type LegalSourceAgentBundle } from '../src/lib/legalSourceAgents';
import { analyzeLawOfficeRoute } from '../src/lib/lawOfficeExpert';
import { detectCourtProfile } from '../src/lib/courtProfiles';
import { detectCaseStrategyProfile } from '../src/lib/caseStrategyProfiles';
import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard';
import { redactDirectIdentifiers } from '../api/_privacy';
import { buildCourtSourceBundle } from '../api/_courtEngine';
import { buildDeadlinesInstruction } from '../src/lib/litigationDeadlines';

// ---------------------------------------------------------------------------
// أبعاد الملف
// ---------------------------------------------------------------------------
const AGENCIES = [
  { name: 'وزارة الدفاع — القوات البرية', short: 'القوات البرية' },
  { name: 'وزارة الدفاع — القوات الجوية', short: 'القوات الجوية' },
  { name: 'وزارة الدفاع — القوات البحرية', short: 'القوات البحرية' },
  { name: 'وزارة الدفاع — قوات الدفاع الجوي', short: 'الدفاع الجوي' },
  { name: 'وزارة الحرس الوطني', short: 'الحرس الوطني' },
  { name: 'وزارة الداخلية — الأمن العام', short: 'الأمن العام' },
  { name: 'وزارة الداخلية — المديرية العامة للدفاع المدني', short: 'الدفاع المدني' },
  { name: 'وزارة الداخلية — حرس الحدود', short: 'حرس الحدود' },
  { name: 'وزارة الداخلية — المديرية العامة للجوازات', short: 'الجوازات' },
  { name: 'رئاسة أمن الدولة', short: 'أمن الدولة' },
];
const RANKS = ['جندي', 'جندي أول', 'عريف', 'وكيل رقيب', 'رقيب', 'رقيب أول', 'رئيس رقباء'];
const JOBS = ['مشغل نهاية طرفية', 'مشغل نهايات طرفية', 'مشغل حاسب آلي', 'مدخل بيانات على الحاسب', 'فني حاسب آلي', 'فني شبكات', 'مبرمج', 'مشغل أنظمة آلية'];
const CLAIMS = [
  { id: 'computer', phrases: ['مكافأة الحاسب الآلي', 'مكافأة الحاسب', 'بدل الحاسب الآلي', 'مكافاة الحاسب الالي', 'مكافأة مشغلي النهايات الطرفية'] },
  { id: 'technical', phrases: ['العلاوة الفنية', 'العلاوة الفنية المقررة للفرد الفني', 'علاوة فنية'] },
  { id: 'both', phrases: ['مكافأة الحاسب الآلي مع العلاوة الفنية', 'الجمع بين العلاوة الفنية ومكافأة الحاسب'] },
] as const;
const DEFENSES = [
  'لا يوجد قرار تكليف بالعمل على الحاسب',
  'المسمى الوظيفي لا ينطبق',
  'لا توجد اعتمادات مالية',
  'لا يجوز الجمع بين العلاوة الفنية ومكافأة الحاسب لاتحاد الغرض',
  'لم تثبت الممارسة الفعلية للعمل',
  'لم يجتز الدورة المطلوبة',
  'الصرف موقوف بتعميم داخلي',
  'مضى على الحق أكثر من عشر سنوات',
];
type Instrument = 'art16' | 'art16-words' | 'cm15-1413' | 'cm15-1413-indic' | 'm37-1432' | 'm37-1432-compact' | 'cm118' | 'all' | 'art17-19' | 'none';
const INSTRUMENTS: Record<Instrument, string[]> = {
  none: [],
  art16: ['المادة 16 من نظام خدمة الأفراد'],
  'art16-words': ['المادة السادسة عشرة من نظام الأفراد ولائحته التنفيذية'],
  'cm15-1413': ['قرار مجلس الوزراء رقم 15 لعام 1413هـ وضوابطه'],
  'cm15-1413-indic': ['قرار مجلس الوزراء رقم (١٥) وتاريخ ١٤١٣هـ'],
  'm37-1432': ['المرسوم الملكي رقم م/37 وتاريخ 1432هـ'],
  'm37-1432-compact': ['المرسوم الملكي م37 لعام 1432'],
  cm118: ['قرار مجلس الوزراء رقم 118'],
  all: ['المادة 16 من نظام خدمة الأفراد', 'قرار مجلس الوزراء رقم 15 لعام 1413هـ وضوابطه', 'المرسوم الملكي م/37 لعام 1432هـ', 'قرار مجلس الوزراء رقم 118'],
  'art17-19': ['المادتين 17 و19 من نظام خدمة الأفراد'],
};
type Stage = { id: string; level: CourtLevelId; judgment: string; colloquial: string; formal: string; drafting: boolean; expectBlock: boolean };
const STAGES: Stage[] = [
  { id: 'consult', level: 'first', judgment: '', colloquial: 'وش أسوي؟', formal: 'نرجو بيان المسار النظامي.', drafting: false, expectBlock: false },
  { id: 'grievance', level: 'first', judgment: '', colloquial: 'ابي أكتب تظلم للجهة.', formal: 'نرغب في إعداد تظلم إلى الجهة العسكرية.', drafting: false, expectBlock: false },
  { id: 'claim', level: 'first', judgment: '', colloquial: 'اكتب لي لائحة دعوى أمام المحكمة الإدارية.', formal: 'نطلب صياغة لائحة دعوى أمام المحكمة الإدارية.', drafting: true, expectBlock: false },
  { id: 'memo', level: 'first', judgment: '', colloquial: 'الجهة ردت بمذكرة وأبي مذكرة رد.', formal: 'نطلب صياغة مذكرة رد على دفاع الجهة المدعى عليها.', drafting: true, expectBlock: false },
  { id: 'appeal', level: 'appeal', judgment: 'صدر حكم ابتدائي من المحكمة الإدارية برفض الدعوى وتسلمت نسخة الحكم.', colloquial: 'أبي لائحة اعتراض على الحكم أمام محكمة الاستئناف الإدارية.', formal: 'نطلب صياغة لائحة اعتراض بالاستئناف على الحكم الابتدائي.', drafting: true, expectBlock: false },
  { id: 'appeal-on-appeal', level: 'appeal', judgment: 'صدر حكم محكمة الاستئناف الإدارية بتأييد الحكم الابتدائي برفض الدعوى.', colloquial: 'أبي لائحة استئناف على هذا الحكم.', formal: 'نطلب لائحة استئناف على حكم محكمة الاستئناف الإدارية.', drafting: true, expectBlock: true },
  { id: 'cassation', level: 'supreme', judgment: 'صدر حكم محكمة الاستئناف الإدارية بتأييد الحكم الابتدائي برفض الدعوى.', colloquial: 'أبي لائحة طعن بالنقض أمام المحكمة الإدارية العليا.', formal: 'نطلب صياغة لائحة طعن بالنقض أمام المحكمة الإدارية العليا.', drafting: true, expectBlock: false },
  { id: 'cassation-on-first', level: 'first', judgment: 'صدر حكم ابتدائي من المحكمة الإدارية برفض الدعوى.', colloquial: 'أبي طعن بالنقض على الحكم الابتدائي مباشرة.', formal: 'نطلب صياغة طعن بالنقض على الحكم الابتدائي مباشرة.', drafting: true, expectBlock: true },
];
const TIMELINES = [
  { years: 2, grievance: true }, { years: 6, grievance: false }, { years: 9, grievance: true }, { years: 11, grievance: false }, { years: 14, grievance: true },
];

// ---------------------------------------------------------------------------
// توليد 1000 ملف بتوزيع متوازن وبذرة ثابتة (نفس الملفات في كل تشغيل)
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(14131432);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join('');
const toArabicIndic = (value: string) => value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

type CaseFile = {
  id: string; text: string; agency: string; rank: string; job: string; claim: typeof CLAIMS[number]['id'];
  instrument: Instrument; stage: Stage; years: number; grievance: boolean; style: 'colloquial' | 'formal';
  pii: { militaryNumber?: string; nationalId?: string };
};

const instrumentKeys = Object.keys(INSTRUMENTS) as Instrument[];
const cases: CaseFile[] = [];
for (let i = 0; i < 1000; i += 1) {
  const agency = AGENCIES[i % AGENCIES.length];
  const stage = STAGES[i % STAGES.length];
  const claim = CLAIMS[i % CLAIMS.length];
  const instrument = instrumentKeys[Math.floor(i / 10) % instrumentKeys.length];
  const timeline = TIMELINES[Math.floor(i / 3) % TIMELINES.length];
  // الأسلوب يتبدل كل 8 ملفات حتى تجتمع كل مرحلة بالأسلوبين (لو رُبط بـ i % 2 لثبت أسلوب كل مرحلة).
  const style: 'colloquial' | 'formal' = Math.floor(i / STAGES.length) % 2 === 0 ? 'colloquial' : 'formal';
  const rank = pick(RANKS);
  const job = pick(JOBS);
  const defense = pick(DEFENSES);
  const claimPhrase = pick(claim.phrases);
  const cited = INSTRUMENTS[instrument];
  const pii: CaseFile['pii'] = {};
  let piiText = '';
  if (i % 4 === 0) {
    pii.militaryNumber = digits(7);
    pii.nationalId = i % 8 === 0 ? toArabicIndic(`1${digits(9)}`) : `1${digits(9)}`;
    piiText = style === 'colloquial'
      ? ` رقمي العسكري ${pii.militaryNumber} وهويتي ${pii.nationalId}.`
      : ` الرقم العسكري للموكل (${pii.militaryNumber}) وهويته (${pii.nationalId}).`;
  }
  const citedText = cited.length ? (style === 'colloquial' ? ` وأنا أستند على ${cited.join(' و')}` : ` استناداً إلى ${cited.join('، و')}`) : '';
  const grievanceText = timeline.grievance
    ? (style === 'colloquial' ? ' وقدمت تظلم للجهة وما ردوا من شهرين.' : ' وتقدم بتظلم إلى الجهة العسكرية ومضى ستون يوماً دون بت.')
    : (style === 'colloquial' ? ' وما قدمت أي تظلم.' : ' ولم يتقدم بتظلم.');
  const text = style === 'colloquial'
    ? `أنا ${rank} في ${agency.short}، أشتغل ${job} من ${timeline.years} سنين، و${claimPhrase} ما صرفوها لي${citedText}. الجهة تقول ${defense}.${grievanceText}${piiText} ${stage.judgment} ${stage.colloquial}`
    : `موكلي ${rank} بـ${agency.name}، يعمل ${job} منذ ${timeline.years} سنوات، ويطالب بـ${claimPhrase}${citedText}، وقد دفعت الجهة بأن ${defense}.${grievanceText}${piiText} ${stage.judgment} ${stage.formal}`;
  cases.push({ id: `m${String(i + 1).padStart(4, '0')}`, text: text.replace(/\s+/g, ' ').trim(), agency: agency.short, rank, job, claim: claim.id, instrument, stage, years: timeline.years, grievance: timeline.grievance, style, pii });
}

// ---------------------------------------------------------------------------
// أدوات القياس
// ---------------------------------------------------------------------------
// شروط المنع القاطع في api/_draftReleaseGate.ts قبل أي مراجعة بالنموذج — منسوخة حرفياً (الدالة نفسها تستدعي النموذج).
const GATE_HARD_SOURCE_BLOCKER = /ذُكرت مواد|سجل مادة متحقق|غير متحقق|needs-correction|لم يعثر الفهرس على مادة|أداة الإصدار غير مكتملة|م\/37/i;
const GATE_MILITARY = /خدمة\s*الأفراد|فرد\s*عسكري|عسكري|وزارة\s*الدفاع|القوات\s*(?:البرية|الجوية|البحرية)|علاوة\s*فنية|مكافأة\s*الحاسب|مكافاه\s*الحاسب/;
const GATE_ADMIN = /ديوان\s*المظالم|المحكمة\s*الإدارية|المحكمه\s*الاداريه|قرار\s*إداري|قرار\s*اداري|جهة\s*إدارية|جهه\s*اداريه/;

function gatePreDraftBlockers(court: string, task: string, input: string): string[] {
  const profileText = [court, task, input].join('\n').toLowerCase();
  const bundle = runLegalSourceAgents([court, task, input].filter(Boolean).join('\n').slice(0, 30000));
  const military = GATE_MILITARY.test(profileText);
  const administrative = military || GATE_ADMIN.test(profileText) || court.toLowerCase().includes('administrative');
  const personnel = bundle.packets.find((p) => p.agentId === 'src-personnel');
  const bog = bundle.packets.find((p) => p.agentId === 'src-bog');
  const blockers: string[] = [];
  if (bundle.verification.officialSources === 0) blockers.push('no-official-sources');
  if (military && (personnel?.verifiedArticles.length || 0) === 0) blockers.push('military-without-personnel-article');
  if (administrative && (bog?.verifiedArticles.length || 0) === 0) blockers.push('administrative-without-bog-article');
  for (const blocker of bundle.verification.blockers) if (GATE_HARD_SOURCE_BLOCKER.test(blocker)) blockers.push(blocker.includes('م/37') ? 'm37-needs-correction' : 'source-blocker');
  return Array.from(new Set(blockers));
}

const norm = (value: string) => value
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

/** مفهرسة فعلاً: تظهر في مراجع الحزمة الرسمية لا في تنبيه «يذكرها المستخدم». */
function indexedInstrument(bundle: LegalSourceAgentBundle, instrument: 'cm15-1413' | 'm37-1432' | 'cm118'): boolean {
  const references = bundle.packets.flatMap((p) => p.references.flatMap((r) => [r.name, r.issueInstrument || '', r.note])).join('\n');
  return contextHasInstrument(references, instrument);
}

/** متعرَّف عليها: المنصة أصدرت تنبيهاً صريحاً بأنها غير مفهرسة أو بتعارض تاريخها. */
function flaggedInstrument(bundle: LegalSourceAgentBundle, instrument: 'cm15-1413' | 'm37-1432' | 'cm118'): boolean {
  return contextHasInstrument(bundle.verification.blockers.filter((b) => /يذكرها المستخدم|يذكر المستخدم/.test(b)).join('\n'), instrument);
}

function contextHasInstrument(context: string, instrument: 'cm15-1413' | 'm37-1432' | 'cm118'): boolean {
  const value = norm(context);
  if (instrument === 'cm15-1413') return /قرار مجلس الوزراء(?: رقم)?\s*\(?15\)?[^\n]{0,40}1413/.test(value);
  if (instrument === 'm37-1432') return /م\s*\/?\s*37\)?[^\n]{0,40}1432/.test(value);
  return /قرار مجلس الوزراء(?: رقم)?\s*\(?118\)?/.test(value);
}

const pct = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : '—');
const citesAny = (c: CaseFile, ...keys: Instrument[]) => keys.includes(c.instrument) || (c.instrument === 'all');

type Row = {
  id: string; stage: string; claim: string; agency: string; style: string; instrument: Instrument;
  personnel: boolean; personnelAdminWorkspace: boolean; bog: boolean; strategyMilitary: boolean;
  courtAdmin: boolean; courtConfident: boolean; courtSystem: string | null; profile: string;
  articles: string[]; allArticlesDumped: boolean;
  instrumentKnown: Record<string, boolean>; instrumentFlagged: Record<string, boolean>; m37OldRecordShown: boolean;
  gateBlockers: string[]; falseM37Block: boolean;
  routeTask: string; routeBlocking: boolean; routeCorrect: boolean;
  courtroom: { personnel: boolean; deadlinesTenYears: boolean; wrongCourt: string[] };
  chatHasDeadlineRule: boolean; timeBarRisk: boolean;
  militaryNumberRedacted?: boolean; nationalIdRedacted?: boolean;
  ms: number;
};

const rows: Row[] = [];
const guardStats = { cases: 0, introduced118Flagged: 0, crossLawPassed: 0, crossLawTried: 0, legit16Passed: 0, legit16Tried: 0 };

for (const c of cases) {
  const started = performance.now();
  const redacted = redactDirectIdentifiers(c.text).text;

  // مسار المحادثة كما في api/chat.ts — الوضع البسيط بلا اختيار جهة، ومساحة العمل الإدارية باختيار «المحكمة الإدارية».
  const simpleResolution = resolveCourtSystem('الاستشارة القضائية العامة', redacted);
  const simpleBundle: LegalSourceAgentBundle = runLegalSourceAgents(['الاستشارة القضائية العامة', redacted].join('\n'), simpleResolution.systemId ? { courtSystem: simpleResolution.systemId } : {});
  const adminResolution = resolveCourtSystem('المحكمة الإدارية', redacted);
  const adminBundle = runLegalSourceAgents(['المحكمة الإدارية', redacted].join('\n'), adminResolution.systemId ? { courtSystem: adminResolution.systemId } : {});

  const personnelPacket = simpleBundle.packets.find((p) => p.agentId === 'src-personnel');
  const articles = (personnelPacket?.verifiedArticles || []).map((a) => a.article);
  const identification = identifyCourt(redacted);
  const route = analyzeLawOfficeRoute(['الاستشارة القضائية العامة', redacted].join('\n'), Boolean(c.stage.judgment));
  const routeCorrect = c.stage.expectBlock ? route.blocking : !route.blocking;
  // كما في api/chat.ts: مدد الجهة المحسومة تُضاف إلى السياق المتحقق.
  const deadlineLevel: CourtLevelId = route.task === 'cassation' ? 'supreme' : route.task === 'appeal' ? 'appeal' : 'first';
  const chatDeadlines = simpleResolution.systemId ? buildDeadlinesInstruction(simpleResolution.systemId, deadlineLevel, false) : '';
  const chatVerifiedContext = [simpleBundle.context, chatDeadlines].filter(Boolean).join('\n\n');

  // بوابة الاعتماد: موانع قاطعة تُحسب قبل قراءة المسودة نفسها — إن وجدت حُجبت أي مسودة مهما كانت جودتها.
  const gateBlockers = c.stage.drafting ? gatePreDraftBlockers('الاستشارة القضائية العامة', route.task, redacted) : [];
  const citesM37 = citesAny(c, 'm37-1432', 'm37-1432-compact');

  // المحكمة الإدارية الافتراضية (القضاة الإداريون).
  const courtroom = buildCourtSourceBundle({
    stage: 'defense', systemId: 'administrative', levelId: c.stage.level, clientRole: 'claimant', round: 1,
    caseFile: { title: `مطالبة ${c.rank} بحقوق مالية عسكرية`, facts: redacted, requests: 'إلزام الجهة بصرف المستحق عن كامل المدة', documentsText: '' },
  });
  const courtroomWrongCourt = jurisdictionIssuesFor('administrative', identifyCourt(redacted));

  // حارس الاستشهادات على ردود مصطنعة في سياق القضية الفعلي.
  guardStats.cases += 1;
  const context = adminBundle.context;
  if (!citesAny(c, 'cm118')) {
    const r = guardIntroducedLegalCitations(c.text, 'يستحق المدعي الصرف وفق قرار مجلس الوزراء رقم (118).', context);
    if (r.blocked) guardStats.introduced118Flagged += 1;
  }
  if (/الماد[ةه]\s*\(?16/.test(norm(context))) {
    guardStats.legit16Tried += 1;
    if (!guardIntroducedLegalCitations('نص بلا مواد', 'وفق المادة (16) من نظام خدمة الأفراد.', context).blocked) guardStats.legit16Passed += 1;
    guardStats.crossLawTried += 1;
    if (!guardIntroducedLegalCitations('نص بلا مواد', 'وفق المادة (16) من نظام الخدمة المدنية.', context).blocked) guardStats.crossLawPassed += 1;
  }

  const digitsOnly = (value: string) => value.replace(/[^0-9٠-٩]/g, '');
  const row: Row = {
    id: c.id, stage: c.stage.id, claim: c.claim, agency: c.agency, style: c.style, instrument: c.instrument,
    personnel: Boolean(personnelPacket),
    personnelAdminWorkspace: adminBundle.packets.some((p) => p.agentId === 'src-personnel'),
    bog: simpleBundle.packets.some((p) => p.agentId === 'src-bog'),
    strategyMilitary: detectCaseStrategyProfile(redacted).id === 'military-personnel-rights',
    courtAdmin: identification.systemId === 'administrative',
    courtConfident: identification.systemId === 'administrative' && isConfidentIdentification(identification),
    courtSystem: identification.systemId,
    profile: detectCourtProfile(redacted).id,
    articles,
    allArticlesDumped: articles.length >= 20,
    instrumentKnown: {
      'cm15-1413': indexedInstrument(adminBundle, 'cm15-1413'),
      'm37-1432': indexedInstrument(adminBundle, 'm37-1432'),
      cm118: indexedInstrument(adminBundle, 'cm118'),
    },
    instrumentFlagged: {
      'cm15-1413': flaggedInstrument(adminBundle, 'cm15-1413'),
      'm37-1432': flaggedInstrument(adminBundle, 'm37-1432'),
      cm118: flaggedInstrument(adminBundle, 'cm118'),
    },
    m37OldRecordShown: simpleBundle.verification.blockers.some((b) => b.includes('م/37') && b.includes('1430')),
    gateBlockers,
    falseM37Block: gateBlockers.includes('m37-needs-correction') && !citesM37,
    routeTask: route.task, routeBlocking: route.blocking, routeCorrect,
    courtroom: {
      personnel: courtroom.bundle.packets.some((p) => p.agentId === 'src-personnel'),
      deadlinesTenYears: courtroom.context.includes('عشر سنوات'),
      wrongCourt: courtroomWrongCourt,
    },
    chatHasDeadlineRule: /عشر سنوات/.test(chatVerifiedContext) && /التظلم/.test(chatVerifiedContext),
    timeBarRisk: c.years >= 10 && !c.grievance,
    ...(c.pii.militaryNumber ? { militaryNumberRedacted: !redacted.includes(c.pii.militaryNumber) } : {}),
    ...(c.pii.nationalId ? { nationalIdRedacted: !digitsOnly(redacted).includes(digitsOnly(c.pii.nationalId)) } : {}),
    ms: performance.now() - started,
  };
  rows.push(row);
}

// ---------------------------------------------------------------------------
// الملخص
// ---------------------------------------------------------------------------
const count = (key: (r: Row) => string, subset: Row[] = rows) => {
  const groups: Record<string, number> = {};
  for (const r of subset) { const k = key(r); groups[k] = (groups[k] || 0) + 1; }
  return groups;
};
const by = <K extends string>(key: (r: Row) => K, metric: (r: Row) => boolean) => {
  const groups: Record<string, [number, number]> = {};
  for (const r of rows) { const k = key(r); const g = (groups[k] ||= [0, 0]); g[1] += 1; if (metric(r)) g[0] += 1; }
  return Object.fromEntries(Object.entries(groups).map(([k, [a, b]]) => [k, pct(a, b)]));
};
const drafting = rows.filter((r) => STAGES.find((s) => s.id === r.stage)!.drafting);
const technical = rows.filter((r) => r.claim !== 'computer');
const computer = rows.filter((r) => r.claim !== 'technical');
const citing = (keys: Instrument[]) => rows.filter((r) => keys.includes(r.instrument) || r.instrument === 'all');
const piiRows = rows.filter((r) => r.militaryNumberRedacted !== undefined);
const times = rows.map((r) => r.ms).sort((a, b) => a - b);

const summary = {
  cases: rows.length,
  agentActivation: {
    personnelAgentFires: pct(rows.filter((r) => r.personnel).length, rows.length),
    personnelAgentFiresByAgency: by((r) => r.agency, (r) => r.personnel),
    personnelAgentFiresInAdminWorkspace: pct(rows.filter((r) => r.personnelAdminWorkspace).length, rows.length),
    bogAgentFires: pct(rows.filter((r) => r.bog).length, rows.length),
    bogAgentFiresByStyle: by((r) => r.style, (r) => r.bog),
    militaryStrategyProfile: pct(rows.filter((r) => r.strategyMilitary).length, rows.length),
    militaryStrategyByAgency: by((r) => r.agency, (r) => r.strategyMilitary),
    courtIdentifiedAdministrative: pct(rows.filter((r) => r.courtAdmin).length, rows.length),
    courtConfidentAdministrative: pct(rows.filter((r) => r.courtConfident).length, rows.length),
    courtIdentifiedAs: count((r) => r.courtSystem || 'none'),
    courtProfileAdministrative: pct(rows.filter((r) => r.profile.startsWith('administrative')).length, rows.length),
  },
  articles: {
    technicalClaimsGetArticle16: pct(technical.filter((r) => r.articles.includes('16')).length, technical.length),
    computerClaimsGetArticle19Practice: pct(computer.filter((r) => r.articles.includes('19')).length, computer.length),
    combinationClaimsGetArticle17: pct(rows.filter((r) => r.claim === 'both' && r.articles.includes('17')).length, rows.filter((r) => r.claim === 'both').length),
    allPersonnelArticlesDumped: pct(rows.filter((r) => r.allArticlesDumped).length, rows.filter((r) => r.personnel).length),
  },
  instruments: {
    cm15_1413_knownWhenCited: pct(citing(['cm15-1413', 'cm15-1413-indic']).filter((r) => r.instrumentKnown['cm15-1413']).length, citing(['cm15-1413', 'cm15-1413-indic']).length),
    m37_1432_knownWhenCited: pct(citing(['m37-1432', 'm37-1432-compact']).filter((r) => r.instrumentKnown['m37-1432']).length, citing(['m37-1432', 'm37-1432-compact']).length),
    cm118_knownWhenCited: pct(citing(['cm118']).filter((r) => r.instrumentKnown.cm118).length, citing(['cm118']).length),
    cm15_1413_flaggedAsUnindexedWhenCited: pct(citing(['cm15-1413', 'cm15-1413-indic']).filter((r) => r.instrumentFlagged['cm15-1413']).length, citing(['cm15-1413', 'cm15-1413-indic']).length),
    m37_1432_flaggedDateConflictWhenCited: pct(citing(['m37-1432', 'm37-1432-compact']).filter((r) => r.instrumentFlagged['m37-1432']).length, citing(['m37-1432', 'm37-1432-compact']).length),
    cm118_flaggedAsUnindexedWhenCited: pct(citing(['cm118']).filter((r) => r.instrumentFlagged.cm118).length, citing(['cm118']).length),
    m37_1430_recordShownWhenUserCited1432: pct(citing(['m37-1432', 'm37-1432-compact']).filter((r) => r.m37OldRecordShown).length, citing(['m37-1432', 'm37-1432-compact']).length),
  },
  releaseGate: {
    draftingCasesWithPreDraftHardBlock: pct(drafting.filter((r) => r.gateBlockers.length).length, drafting.length),
    hardBlockReasons: count((r) => (r.gateBlockers.length ? r.gateBlockers.join('+') : 'none'), drafting),
    falseM37HardBlock: pct(drafting.filter((r) => r.falseM37Block).length, drafting.filter((r) => !citesAnyRow(r, ['m37-1432', 'm37-1432-compact'])).length),
  },
  route: {
    stageRoutingCorrect: by((r) => `${r.stage}/${r.style}`, (r) => r.routeCorrect),
    taskDetected: count((r) => `${r.stage}→${r.routeTask}`),
  },
  courtroom: {
    personnelAgentInAdminCourt: pct(rows.filter((r) => r.courtroom.personnel).length, rows.length),
    tenYearRuleInJudgesContext: pct(rows.filter((r) => r.courtroom.deadlinesTenYears).length, rows.length),
    falseWrongCourtDeclared: pct(rows.filter((r) => r.courtroom.wrongCourt.length).length, rows.length),
    falseWrongCourtExamples: rows.filter((r) => r.courtroom.wrongCourt.length).slice(0, 5).map((r) => `${r.id}: ${r.courtroom.wrongCourt[0].slice(0, 110)}`),
  },
  deadlines: {
    chatContextHasTenYearGrievanceRule: pct(rows.filter((r) => r.chatHasDeadlineRule).length, rows.length),
    casesWithTimeBarRisk: rows.filter((r) => r.timeBarRisk).length,
  },
  citationGuard: {
    introducedCabinet118Flagged: pct(guardStats.introduced118Flagged, rows.filter((r) => !citesAnyRow(r, ['cm118'])).length),
    legitimateArticle16Passed: pct(guardStats.legit16Passed, guardStats.legit16Tried),
    wrongLawSameNumberPassed: pct(guardStats.crossLawPassed, guardStats.crossLawTried),
  },
  privacy: {
    nationalIdRedacted: pct(piiRows.filter((r) => r.nationalIdRedacted).length, piiRows.length),
    militaryNumberRedacted: pct(piiRows.filter((r) => r.militaryNumberRedacted).length, piiRows.length),
  },
  performance: { medianMs: Number(times[Math.floor(times.length / 2)].toFixed(1)), p95Ms: Number(times[Math.floor(times.length * 0.95)].toFixed(1)) },
};

function citesAnyRow(r: Row, keys: Instrument[]) { return keys.includes(r.instrument) || r.instrument === 'all'; }

console.log(JSON.stringify(summary, null, 2));
const outIndex = process.argv.indexOf('--out');
if (outIndex > 0 && process.argv[outIndex + 1]) fs.writeFileSync(process.argv[outIndex + 1], JSON.stringify({ summary, rows, samples: cases.slice(0, 16).map((c) => ({ id: c.id, text: c.text })) }, null, 2), 'utf8');
