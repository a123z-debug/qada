import { runLegalSourceAgents } from '../src/lib/legalSourceAgents';
import { analyzeLawOfficeRoute } from '../src/lib/lawOfficeExpert';
import { detectHujjaDraftingIntent } from '../src/lib/hujjaBayanAgent';
import { detectCourtProfile } from '../src/lib/courtProfiles';
import { detectCaseStrategyProfile } from '../src/lib/caseStrategyProfiles';

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
  assert(
    detectCaseStrategyProfile('أنا فرد عسكري في وزارة الدفاع أطالب بعلاوة فنية ومكافأة حاسب').id === 'military-personnel-rights',
    'Military dispute must use military-personnel case strategy',
  );
}

// 2) Administrative cassation: must route to supreme administrative profile and cassation.
{
  const text = 'أريد طعن بالنقض أمام المحكمة الإدارية العليا على حكم محكمة الاستئناف الإدارية';
  const route = analyzeLawOfficeRoute(text, true);
  const profile = detectCourtProfile(text);
  assert(route.task === 'cassation', 'Administrative supreme case must route to cassation');
  assert(profile.id === 'administrative-supreme', 'Administrative supreme court profile missing');
  assert(
    detectCaseStrategyProfile('فرد عسكري يطالب بمكافأة حاسب أمام المحكمة الإدارية العليا').id === 'military-personnel-rights',
    'Administrative supreme military case must preserve the military-personnel strategy',
  );
}

// 3) General money claim: no military/BOG leakage.
{
  const bundle = runLegalSourceAgents('سلفت شخص مبلغ بتحويل بنكي ورفض يسدد وأريد دعوى مطالبة مالية أمام المحكمة العامة');
  const ids = new Set(bundle.packets.map((packet) => packet.agentId));
  assert(!ids.has('src-personnel'), 'Civil money claim must not activate personnel-law agent');
  assert(!ids.has('src-bog'), 'Civil money claim must not activate BOG agent without administrative signals');
  assert(detectCourtProfile('المحكمة العامة مطالبة مالية').id === 'general-first', 'General-court profile routing failed');
  assert(
    detectCaseStrategyProfile('سلفت شخص مبلغ بتحويل بنكي ورفض يسدد').id === 'general-money-claim',
    'General money claim strategy routing failed',
  );
}

// 4) Criminal case: no administrative leakage.
{
  const ids = packetIds('قضية جزائية اتهام وتفتيش وتحقيق ومحكمة جزائية');
  assert(!ids.has('src-personnel'), 'Criminal case must not activate personnel-law agent by default');
  assert(!ids.has('src-bog'), 'Criminal case must not activate BOG agent by default');
  assert(detectCourtProfile('المحكمة الجزائية').id === 'criminal-first', 'Criminal court profile routing failed');
  assert(
    detectCaseStrategyProfile('قضية جزائية اتهام وتفتيش وتحقيق').id === 'criminal-defense',
    'Criminal case strategy routing failed',
  );
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


// 8) Administrative annulment: distinguish decision-annulment theory from generic administrative rights.
{
  const profile = detectCaseStrategyProfile('صدر قرار إداري نهائي وأطلب إلغاء القرار بعد التظلم');
  assert(profile.id === 'administrative-annulment', 'Administrative-annulment strategy routing failed');
  assert(
    profile.mandatoryChecks.some((item) => item.includes('timeline')),
    'Administrative-annulment strategy must require a notification/grievance timeline',
  );
}

// 9) Military personnel appeal: court role and case theory are separate dimensions.
{
  const text = 'فرد عسكري في وزارة الدفاع أمام محكمة الاستئناف الإدارية يعترض على رفض بدل ومكافأة';
  assert(detectCourtProfile(text).id === 'administrative-appeal', 'Military appeal must use administrative-appeal court profile');
  assert(detectCaseStrategyProfile(text).id === 'military-personnel-rights', 'Military appeal must keep personnel-rights strategy');
}

// 10) Wrong procedural route: second appeal over an appellate administrative judgment must be blocked.
{
  const route = analyzeLawOfficeRoute(
    'أريد لائحة استئناف على حكم صادر من محكمة الاستئناف الإدارية في قضية إدارية',
    true,
  );
  assert(route.blocking && !route.allowDrafting, 'Second administrative appeal must be blocked before drafting');
}

// 11) Wrong cassation stage: cassation from first-instance judgment must be blocked.
{
  const route = analyzeLawOfficeRoute(
    'أريد طعن بالنقض على حكم ابتدائي صادر من المحكمة الإدارية',
    true,
  );
  assert(route.blocking && !route.allowDrafting, 'Cassation from a first-instance judgment must be blocked');
}

// 12) Administrative compensation has a distinct causation/evidence theory.
{
  const profile = detectCaseStrategyProfile('أطلب تعويضاً من جهة حكومية عن ضرر سببه قرار إداري');
  assert(profile.id === 'administrative-compensation', 'Administrative-compensation strategy routing failed');
  assert(profile.elements.some((item) => item.includes('سببية')), 'Compensation strategy must test causation');
}

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
    'administrative annulment',
    'military personnel appeal matrix',
    'second appeal blocked',
    'wrong cassation stage blocked',
    'administrative compensation causation',
  ],
}, null, 2));
