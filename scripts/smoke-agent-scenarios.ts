import { runLegalSourceAgents } from '../src/lib/legalSourceAgents';
import { analyzeLawOfficeRoute } from '../src/lib/lawOfficeExpert';
import { detectHujjaDraftingIntent } from '../src/lib/hujjaBayanAgent';
import { detectCourtProfile } from '../src/lib/courtProfiles';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function packetIds(query: string) {
  return new Set(runLegalSourceAgents(query).packets.map((packet) => packet.agentId));
}

// 1) Military personnel dispute: ordinary client language must activate personnel + BOG sources.
{
  const ids = packetIds('أنا فرد عسكري في وزارة الدفاع أطالب بعلاوة فنية ومكافأة حاسب وصدر رفض وأبغى أعترض');
  assert(ids.has('src-personnel'), 'Military dispute must activate personnel source agent');
  assert(ids.has('src-bog'), 'Military service dispute must activate Board of Grievances source agent');
}

// 2) Administrative cassation: must route to supreme administrative profile and cassation.
{
  const text = 'أريد طعن بالنقض أمام المحكمة الإدارية العليا على حكم محكمة الاستئناف الإدارية';
  const route = analyzeLawOfficeRoute(text, true);
  const profile = detectCourtProfile(text);
  assert(route.task === 'cassation', 'Administrative supreme case must route to cassation');
  assert(profile.id === 'administrative-supreme', 'Administrative supreme court profile missing');
}

// 3) General money claim: no military/BOG leakage.
{
  const bundle = runLegalSourceAgents('سلفت شخص مبلغ بتحويل بنكي ورفض يسدد وأريد دعوى مطالبة مالية أمام المحكمة العامة');
  const ids = new Set(bundle.packets.map((packet) => packet.agentId));
  assert(!ids.has('src-personnel'), 'Civil money claim must not activate personnel-law agent');
  assert(!ids.has('src-bog'), 'Civil money claim must not activate BOG agent without administrative signals');
  assert(detectCourtProfile('المحكمة العامة مطالبة مالية').id === 'general-first', 'General-court profile routing failed');
}

// 4) Criminal case: no administrative leakage.
{
  const ids = packetIds('قضية جزائية اتهام وتفتيش وتحقيق ومحكمة جزائية');
  assert(!ids.has('src-personnel'), 'Criminal case must not activate personnel-law agent by default');
  assert(!ids.has('src-bog'), 'Criminal case must not activate BOG agent by default');
  assert(detectCourtProfile('المحكمة الجزائية').id === 'criminal-first', 'Criminal court profile routing failed');
}

// 5) Royal/cabinet instruments must activate the instrument source agent.
{
  const ids = packetIds('قرار مجلس الوزراء رقم 15 ومرسوم ملكي وتعديل نظام');
  assert(ids.has('src-royal'), 'Royal/Cabinet instrument query must activate source agent');
}

// 6) Precedent query must activate precedent agent but remain fail-closed if corpus is incomplete.
{
  const bundle = runLegalSourceAgents('مبدأ قضائي حكم المحكمة الإدارية العليا نقض');
  const packet = bundle.packets.find((item) => item.agentId === 'src-precedents');
  assert(packet, 'Precedent query must activate precedent source agent');
  assert(packet.status === 'warning', 'Incomplete precedent corpus must stay warning/fail-closed');
}

// 7) Drafting intents must be unambiguous.
assert(detectHujjaDraftingIntent('اكتب لي صحيفة دعوى') === 'claim', 'Hujja claim intent failed');
assert(detectHujjaDraftingIntent('أريد طعن بالنقض أمام المحكمة الإدارية العليا') === 'cassation', 'Hujja cassation intent failed');
assert(detectHujjaDraftingIntent('جهز رد على مذكرة الخصم') === 'reply', 'Hujja reply intent failed');

console.log(JSON.stringify({
  ok: true,
  scenarios: [
    'military-personnel + BOG',
    'administrative-supreme cassation',
    'general money claim',
    'criminal isolation',
    'royal/cabinet instruments',
    'precedent fail-closed',
    'Hujja drafting intents',
  ],
}, null, 2));
