import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.js';
import { analyzeLawOfficeRoute } from '../src/lib/lawOfficeExpert.js';
import { detectCourtProfile } from '../src/lib/courtProfiles.js';
import { detectCaseStrategyProfile } from '../src/lib/caseStrategyProfiles.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function ids(text: string) {
  return new Set(runLegalSourceAgents(text).packets.map((p) => p.agentId));
}

let scenarios = 0;
let assertions = 0;

for (let i = 0; i < 250; i += 1) {
  const text = `فرد عسكري في وزارة الدفاع يطالب بعلاوة فنية وبدل وصدر رفض وأريد مطالبة أمام ديوان المظالم حالة ${i}`;
  const set = ids(text);
  assert(set.has('src-personnel'), 'military query lost personnel agent'); assertions++;
  assert(set.has('src-bog'), 'military dispute lost BOG agent'); assertions++;
  assert(detectCaseStrategyProfile(text).id === 'military-personnel-rights', 'military strategy drift'); assertions++;
  scenarios++;
}

for (let i = 0; i < 200; i += 1) {
  const text = `سلفت شخص مبلغ بتحويل بنكي ورفض السداد وأريد مطالبة مالية أمام المحكمة العامة رقم ${i}`;
  const set = ids(text);
  assert(!set.has('src-personnel'), 'money claim leaked personnel agent'); assertions++;
  assert(!set.has('src-bog'), 'money claim leaked BOG agent'); assertions++;
  assert(detectCaseStrategyProfile(text).id === 'general-money-claim', 'money claim strategy drift'); assertions++;
  assert(detectCourtProfile(text).id === 'general-first', 'money claim court drift'); assertions++;
  scenarios++;
}

for (let i = 0; i < 150; i += 1) {
  const text = `قضية جزائية اتهام وقبض وتفتيش أمام المحكمة الجزائية رقم ${i}`;
  const set = ids(text);
  assert(!set.has('src-personnel'), 'criminal query leaked personnel agent'); assertions++;
  assert(!set.has('src-bog'), 'criminal query leaked BOG agent'); assertions++;
  assert(detectCaseStrategyProfile(text).id === 'criminal-defense', 'criminal strategy drift'); assertions++;
  assert(detectCourtProfile(text).id === 'criminal-first', 'criminal court drift'); assertions++;
  scenarios++;
}

for (let i = 0; i < 100; i += 1) {
  const text = `صدر قرار إداري نهائي وأطلب إلغاء القرار بعد التظلم أمام ديوان المظالم رقم ${i}`;
  assert(ids(text).has('src-bog'), 'annulment query lost BOG agent'); assertions++;
  assert(detectCaseStrategyProfile(text).id === 'administrative-annulment', 'annulment strategy drift'); assertions++;
  scenarios++;
}

for (let i = 0; i < 100; i += 1) {
  const text = `أطلب تعويضاً من جهة حكومية عن ضرر سببه قرار إداري رقم ${i}`;
  assert(detectCaseStrategyProfile(text).id === 'administrative-compensation', 'administrative compensation drift'); assertions++;
  scenarios++;
}

for (let i = 0; i < 75; i += 1) {
  const text = `مرسوم ملكي وقرار مجلس الوزراء وتعديل نظام رقم ${i}`;
  assert(ids(text).has('src-royal'), 'royal instrument query lost source agent'); assertions++;
  scenarios++;
}

for (let i = 0; i < 75; i += 1) {
  const text = `مبدأ قضائي وحكم المحكمة الإدارية العليا ونقض رقم ${i}`;
  const packet = runLegalSourceAgents(text).packets.find((p) => p.agentId === 'src-precedents');
  assert(Boolean(packet), 'precedent query lost precedent agent'); assertions++;
  assert(packet?.status === 'warning', 'precedent corpus must stay fail-closed'); assertions++;
  scenarios++;
}

for (let i = 0; i < 25; i += 1) {
  const route = analyzeLawOfficeRoute(
    `أريد لائحة استئناف على حكم صادر من محكمة الاستئناف الإدارية في قضية إدارية رقم ${i}`,
    true,
  );
  assert(route.blocking && !route.allowDrafting, 'second appeal not blocked'); assertions++;
  scenarios++;
}

for (let i = 0; i < 25; i += 1) {
  const route = analyzeLawOfficeRoute(
    `أريد طعن بالنقض على حكم ابتدائي صادر من المحكمة الإدارية رقم ${i}`,
    true,
  );
  assert(route.blocking && !route.allowDrafting, 'cassation from first instance not blocked'); assertions++;
  scenarios++;
}

assert(scenarios === 1000, `expected 1000 workflow scenarios, got ${scenarios}`);

console.log(JSON.stringify({
  ok: true,
  scenarios,
  assertions,
  families: 9,
}, null, 2));
