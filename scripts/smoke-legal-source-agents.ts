import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function packetIds(query: string) {
  return new Set(runLegalSourceAgents(query).packets.map((packet) => packet.agentId));
}

const administrative = runLegalSourceAgents('ديوان المظالم المادة 60 من نظام المرافعات أمام ديوان المظالم');
const administrativeIds = new Set(administrative.packets.map((packet) => packet.agentId));
assert(administrativeIds.has('official-source'), 'official-source agent missing');
assert(administrativeIds.has('src-bog'), 'BOG source agent must run for administrative query');
assert(administrativeIds.has('exact-text'), 'exact-text agent missing');
assert(administrative.verification.officialSources > 0, 'administrative query should retrieve official sources');
assert(administrative.verification.literalQuotationReady === false, 'literal quotation must remain gated');

const military = runLegalSourceAgents('حقوق عسكري في نظام خدمة الأفراد وبدل الترحيل');
const militaryIds = new Set(military.packets.map((packet) => packet.agentId));
assert(militaryIds.has('src-personnel'), 'personnel source agent must run for military query');
const personnel = military.packets.find((packet) => packet.agentId === 'src-personnel');
assert(personnel?.status === 'warning', 'personnel agent should preserve current verification warning');
assert((personnel?.references.length || 0) > 0, 'personnel agent should expose verified right/source records');

const royal = runLegalSourceAgents('مرسوم ملكي وقرار مجلس الوزراء وتعديل نظام');
const royalIds = new Set(royal.packets.map((packet) => packet.agentId));
assert(royalIds.has('src-royal'), 'royal/orders source agent must run for royal instrument query');
assert(royalIds.has('amendments'), 'amendment/currentness agent missing');
assert(royalIds.has('official-source'), 'official source aggregator missing from royal query');

const precedent = runLegalSourceAgents('هل يوجد مبدأ قضائي أو حكم رقم سابق من المحكمة العليا');
const precedentIds = packetIds('هل يوجد مبدأ قضائي أو حكم رقم سابق من المحكمة العليا');
assert(precedentIds.has('src-precedents'), 'precedent agent must run for precedent query');
const precedentPacket = precedent.packets.find((packet) => packet.agentId === 'src-precedents');
assert(precedentPacket?.status === 'warning', 'precedent corpus must not be represented as complete');
assert((precedentPacket?.blockers.length || 0) > 0, 'precedent agent must expose blockers');

for (const bundle of [administrative, military, royal, precedent]) {
  for (const packet of bundle.packets) {
    for (const reference of packet.references) {
      assert(Boolean(reference.sourceUrl), `missing official URL in ${packet.agentId}`);
    }
  }
}

console.log(JSON.stringify({
  ok: true,
  administrativeAgents: Array.from(administrativeIds),
  militaryAgents: Array.from(militaryIds),
  royalAgents: Array.from(royalIds),
  precedentAgents: Array.from(precedentIds),
}, null, 2));
