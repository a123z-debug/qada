/**
 * اختبارات ثبات لأخطاء كشفها اختبار «المواطن المتضرر» (scripts/stress-aggrieved-citizen-1000.ts).
 * كل فحص هنا يمثّل خللاً حقيقياً كان موجوداً؛ لا تحذفه دون فهم سببه.
 */
import fs from 'node:fs';
import path from 'node:path';
import { redactDirectIdentifiers } from '../api/_privacy';
import { detectLawOfficeTask, analyzeLawOfficeRoute } from '../src/lib/lawOfficeExpert';
import { identifyCourt, isConfidentIdentification } from '../src/lib/courtJurisdiction';
import { assessClaimLiberation } from '../src/lib/claimLiberationGate';
import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents';
import { detectCaseStrategyProfile } from '../src/lib/caseStrategyProfiles';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let checks = 0;
const check = (condition: unknown, message: string) => { assert(condition, message); checks += 1; };

// 1) الخصوصية: الأرقام العربية الهندية والفواصل كانت تمر إلى مزود النموذج دون حجب.
for (const sample of ['هويتي ١٠٨٧٦٥٤٣٢١', 'جوالي ٠٥٥١٢٣٤٥٦٧', 'جوالي 055 123 4567', 'جوالي 055-123-4567', '00966 55 123 4567', '+966551234567', 'SA03 8000 0000 6080 1016 7519', 'هويتي 1087654321']) {
  check(redactDirectIdentifiers(sample).redactions === 1, `identifier must be redacted: ${sample}`);
}
for (const sample of ['المبلغ 15000 ريال', 'بتاريخ ١٤٤٥/٨/١٢', 'المادة 77 من نظام العمل', 'رقم القضية 4450123', 'الصك رقم 3100120045678']) {
  check(redactDirectIdentifiers(sample).redactions === 0, `non-identifier must stay readable: ${sample}`);
}

// 2) «ى»: الوكلاء يطبّعون ى→ي قبل المطابقة، فكانت أنماط «على/دعوى/ابغى» لا تتطابق أبداً.
check(detectLawOfficeTask('ابي تكتب لي لائحة دعوى') === 'claim', 'claim drafting must be detected');
check(detectLawOfficeTask('اكتب لي دعوى على الشركة') === 'claim', 'claim drafting (اكتب دعوى) must be detected');
check(detectLawOfficeTask('ابي اعترض على الحكم') === 'appeal', 'appeal request must be detected');
check(detectLawOfficeTask('ابغى استئناف الحكم') === 'appeal', 'appeal with ابغى must be detected');
check(detectLawOfficeTask('رد على مذكرة الخصم') === 'reply', 'reply must be detected');
check(analyzeLawOfficeRoute('طلع الحكم ضدي. أبي أعترض على الحكم', false).blocking, 'appeal without the judgment must block drafting');
check(identifyCourt('عندي اعتراض على الحكم').levelId === 'appeal', 'appeal level must be detected');
check(assessClaimLiberation({ draft: 'نص', sourceInputText: 'اكتب لي لائحة دعوى' }).applicable, 'claim liberation gate must apply to claim drafting');

const roots = ['src', 'api'];
const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'data') walk(full); }
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
};
roots.forEach(walk);
const deadPatterns: string[] = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (!/replace\(\/ى\/g,\s*['"]ي['"]\)/.test(source)) continue;
  source.split('\n').forEach((line, index) => {
    if (/replace\(\/ى\/g/.test(line)) return;
    // طول محدود للمطابقة: بلا حد يتراجع النمط تراجعاً تربيعياً على الأسطر الطويلة (بعضها 4000 حرف).
    const literals = line.match(/\/(?![/*])(?:\\.|[^/\n]){1,600}\/[gimsuy]*(?=\s*(?:\.test|\.exec|,|\)|;|\]))/g) || [];
    for (const literal of literals) if (literal.includes('ى')) deadPatterns.push(`${file}:${index + 1}`);
  });
}
check(deadPatterns.length === 0, `regex with «ى» in a file that normalizes ى→ي can never match: ${deadPatterns.join(', ')}`);

// 3) حارس الاستشهادات: الأرقام العربية الهندية والكلمات وتشابه البادئة كانت تمر.
const context = 'نظام العمل — المادة (77) والمادة 80 — الفقرة (3) من المادة السادسة عشرة';
const blocked = (reply: string) => guardIntroducedLegalCitations('نص بلا مواد', reply, context).blocked;
check(blocked('وفق المادة ٩١٣'), 'fabricated Arabic-Indic article must be flagged');
check(blocked('وفق المادة الحادية والتسعين بعد التسعمئة'), 'fabricated word article must be flagged');
check(blocked('وفق المادة 7'), 'article 7 must not pass because the context has 77');
check(!blocked('وفق المادة (٧٧)'), 'Arabic-Indic article present in context must pass');
check(!blocked('وفق المادة السادسة عشرة'), 'word article present in context must pass');
check(!blocked('وفق المادة الثمانين'), 'word article matching a numeric context article must pass');
check(!blocked('كما في المادة المذكورة أعلاه'), 'non-numeric article reference is not a citation');

// 4) تحديد المحكمة: الكلام المنقول والنفي لا يحسمان الجهة، والكلمات الكاملة فقط.
const hearsay = identifyCourt('الشركة ما عطتني راتب خمس شهور وقالوا لي روح المحكمة العامة');
check(hearsay.systemId !== 'general' || !isConfidentIdentification(hearsay), 'hearsay court mention must not confidently route');
check(identifyCourt('عندي حكم وما نفذ وقالوا لي روح المحكمة التجارية').systemId !== 'commercial', 'hearsay commercial mention must not route to commercial');
check(identifyCourt('القضية مو المحكمة العامة').scores.general === 0, 'negated court mention must not count');
check(identifyCourt('سافرت المدينة المنورة').scores.general === 0, '«دين» inside «المدينة» must not count');
check(identifyCourt('فصلوني من الشغل بدون سبب وراتبي ما نزل').systemId === 'labor', 'colloquial dismissal must reach labor');
check(identifyCourt('طليقي أخذ عيالي ورافض يرجعهم').systemId === 'personal-status', 'colloquial custody must reach personal status');
check(identifyCourt('واحد نصب علي واخذ فلوسي واختفى').systemId === 'criminal', 'colloquial fraud must reach criminal');

// 5) التشغيل المحلي: .env يُحمَّل قبل ملفات api/* التي تقرأ إعداداتها عند التحميل.
const server = fs.readFileSync('server.ts', 'utf8');
const firstImport = server.split('\n').find((line) => line.startsWith('import '));
check(firstImport === "import 'dotenv/config';", 'dotenv must be the first import in server.ts');

// 6) مسار المحادثة يستخدم تمييز الجهة ويقيّد المصادر بها متى حُسمت.
const chat = fs.readFileSync('api/chat.ts', 'utf8');
check(chat.includes('resolveCourtSystem(body.targetCourt, sourceQuery)') && chat.includes('courtSystem: courtResolution.systemId') && chat.includes('courtFrameInstruction,'),
  'chat must resolve the court and scope legal sources to it');

// 7) بوابة الدعوى بعد تفعيلها: أسئلة الاستيضاح ليست مسودة، والمسودة الناقصة تُخبر صاحب الشأن بما ينقص بالتحديد.
const releaseGate = fs.readFileSync('api/_draftReleaseGate.ts', 'utf8');
check(releaseGate.includes('const clarificationTurn = claimAssessment.applicable') && releaseGate.includes('claimAssessment.missingPillars.length === 4'),
  'a clarification turn (questions, no claim sections) must not be blocked as an incomplete claim');
check(chat.includes('CLAIM_PILLAR_REQUESTS[pillar]') && chat.includes('حتى أكتب لك اللائحة كاملة أحتاج منك'),
  'an incomplete claim must tell the user exactly which pillars are missing');

// 8) القضاء الإداري — حقوق الأفراد العسكريين (scripts/stress-admin-military-1000.ts).
const personnelOf = (query: string) => runLegalSourceAgents(query).packets.find((packet) => packet.agentId === 'src-personnel');
const m37Blocked = (query: string) => runLegalSourceAgents(query).verification.blockers.some((blocker) => blocker.includes('م/37'));
check(!m37Blocked('فرد عسكري يطالب بمكافأة الحاسب الآلي استناداً إلى المادة 16 من نظام خدمة الأفراد، نطلب صياغة لائحة'),
  'the M/37 needs-correction blocker must not appear when the user never cited M/37 (it hard-blocks every draft)');
check(m37Blocked('فرد عسكري يستند إلى المرسوم الملكي م/37 لعام 1430هـ في العلاوة الفنية'), 'citing M/37 must keep its verification blocker');
const m37Notes = runLegalSourceAgents('فرد عسكري يستند إلى المرسوم الملكي رقم م/37 وتاريخ 1432هـ').verification.blockers;
check(m37Notes.some((note) => note.includes('مؤرخ بغير ذلك')), 'M/37 dated 1432 must be flagged as conflicting with the indexed 1430 record');
for (const query of ['عسكري يستند إلى قرار مجلس الوزراء رقم 15 لعام 1413 وضوابطه', 'عسكري يستند إلى قرار مجلس الوزراء رقم (١١٨)']) {
  check(runLegalSourceAgents(query).verification.blockers.some((note) => note.includes('لم تُفهرس في المنصة')), `unindexed instrument must be flagged: ${query}`);
}
check(!runLegalSourceAgents('فرد عسكري يستند إلى المرسوم الملكي م/9 في العلاوة الفنية').verification.blockers.some((note) => note.includes('يذكرها المستخدم')),
  'an indexed instrument (M/9) must not be flagged as unindexed');
check(Boolean(personnelOf('عريف في الأمن العام مشغل نهايات طرفية وما صرفوا لي بدل الحاسب')), 'Interior personnel claiming a computer allowance must activate the personnel agent');
check(Boolean(personnelOf('رقيب في الحرس الوطني يطالب بالعلاوة الفنية')), 'National Guard personnel must activate the personnel agent');
check(!personnelOf('بلغت الأمن العام عن سرقة سيارتي'), 'a security agency mentioned without an entitlement must not activate the personnel agent');
check(personnelOf('فرد عسكري في وزارة الدفاع يطالب بالعلاوة الفنية')!.verifiedArticles.map((a) => a.article).join(',') === '2,16,17,19',
  'an allowance dispute must get the controlling articles (2, 16, 17, 19), not all 21');
check(detectCaseStrategyProfile('أنا رقيب في الحرس الوطني ومكافأة الحاسب ما صرفوها لي').id === 'military-personnel-rights', 'National Guard rank must use the military-personnel strategy');
check(detectCaseStrategyProfile('جندي في الأمن العام والعلاوة الفنية موقوفة').id === 'military-personnel-rights', 'Public Security rank must use the military-personnel strategy');
check(!analyzeLawOfficeRoute('صدر حكم ابتدائي من المحكمة الإدارية برفض الدعوى. أبي لائحة اعتراض على الحكم أمام محكمة الاستئناف الإدارية.', true).blocking,
  'an ordinary appeal addressed TO the appeal court must not be treated as a second appeal');
check(analyzeLawOfficeRoute('صدر حكم محكمة الاستئناف الإدارية بتأييد الحكم الابتدائي. أبي لائحة استئناف على هذا الحكم.', true).blocking,
  'a second appeal against an appellate judgment must still be blocked');
check(identifyCourt('أنا عريف في القوات الجوية ومكافأة الحاسب ما صرفوها لي وما قدمت تظلم').confidence !== 'low', 'military computer-allowance claims must be confidently administrative');
check(redactDirectIdentifiers('رقمي العسكري 4458123').text.includes('[محجوب: رقم عسكري]'), 'military numbers must be redacted');
check(chat.includes('buildDeadlinesInstruction(courtResolution.systemId') && chat.includes('verifiedSourceContext'), 'chat must carry the verified deadlines of the resolved court');

// 9) من الاختبار الحي: ادعاء «استقرار القضاء» بلا سند، وبوابة الاعتماد مع لوائح الاعتراض والمدد.
check(blocked('يستقر القضاء الإداري في ديوان المظالم على أن الممارسة الفعلية هي العبرة.'), 'an unsupported «settled jurisprudence» claim must be flagged');
check(blocked('وفقاً لمبادئ القضاء الإداري في إعمال العبرة بالواقع الفعلي.'), 'an unsupported appeal to «administrative-law principles» must be flagged');
check(blocked('جرى القضاء على أن العبرة بالممارسة.') && blocked('جري قضاء ديوان المظالم على ذلك.'), '«جرى/جري القضاء» (both spellings) must be flagged');
check(!guardIntroducedLegalCitations('استقر القضاء على ذلك', 'استقر القضاء على ذلك.', context).blocked, 'a precedent claim made by the user is not introduced by the model');
check(!blocked('لا يوجد مبدأ قضائي متحقق في الحزمة.'), 'saying no verified principle exists is not a precedent claim');
check(releaseGate.includes('const draftRoute = analyzeLawOfficeRoute') && /const route = analyzeLawOfficeRoute\(\s*\[args\.court \|\| '', args\.documentTitle \|\| '', args\.sourceInputText \|\| ''\]\.join/.test(releaseGate),
  'the release gate must read the judgment stage from the user materials, not from the appeal draft that addresses the appeal court');
check(releaseGate.includes('verifiedContext?: string') && chat.includes('verifiedContext: verifiedSourceContext'),
  'the release gate must check citations against the same verified context the drafter received (deadlines included)');
const engine = fs.readFileSync('api/_courtEngine.ts', 'utf8');
check(engine.includes("brief.strongestAttack = tag(brief.strongestAttack)") && engine.includes('reasoning: tag(opinion.reasoning)'),
  'prosecution and bench outputs must pass the citation guard like the defense');
check(detectCaseStrategyProfile('فرد عسكري يطالب بمكافأة الحاسب').forbiddenShortcuts.some((rule) => rule.includes('مكافأة الحاسب الآلي')),
  'the military strategy must forbid mapping technical-allowance conditions onto the computer allowance');
check(blocked('استقرار القضاء الإداري على أن المزاولة ترتب استحقاقاً.') && blocked('استقر الفقه القضائي الإداري على ذلك.'),
  'noun and «فقه» forms of a settled-jurisprudence claim must be flagged');
const bogArticles = (query: string) => (runLegalSourceAgents(query).packets.find((p) => p.agentId === 'src-bog')?.verifiedArticles || []).map((a) => `${a.system}|${a.article}`);
const art16Case = bogArticles('نطلب صياغة لائحة دعوى أمام المحكمة الإدارية: فرد عسكري يطالب بمكافأة الحاسب الآلي استناداً إلى المادة 16 من نظام خدمة الأفراد');
check(!art16Case.some((key) => key.endsWith('|16')) && art16Case.length <= 4,
  '«المادة 16 من نظام خدمة الأفراد» must not pull article 16 of the Board of Grievances laws, nor dump all of them');
check(art16Case.includes('نظام ديوان المظالم|13') && art16Case.includes('نظام المرافعات أمام ديوان المظالم|8'),
  'military rights claims must get Board of Grievances jurisdiction (13) and the grievance rule (procedure 8)');
check(!bogArticles('التظلم وفق المادة 8 من نظام المرافعات أمام ديوان المظالم في العلاوة الفنية').includes('نظام ديوان المظالم|8'),
  'an article attributed to the procedure law must not pull the same number from the Board of Grievances law');

console.log(JSON.stringify({ ok: true, checks }, null, 2));
