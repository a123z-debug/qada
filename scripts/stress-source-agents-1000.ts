import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function packet(text: string, id: string) {
  return runLegalSourceAgents(text).packets.find((item) => item.agentId === id);
}

let checks = 0;

for (let i = 0; i < 1000; i += 1) {
  const bundle = runLegalSourceAgents(`نظام ديوان المظالم والمرافعات المادة ${(i % 20) + 1} اختبار ${i}`);
  const ids = new Set(bundle.packets.map((p) => p.agentId));
  for (const id of ['official-source', 'exact-text', 'amendments']) {
    assert(ids.has(id), `${id} missing at base source iteration ${i}`);
    checks++;
  }
  assert(bundle.verification.literalQuotationReady === false, `literal quotation unexpectedly unlocked at ${i}`);
  checks++;
}

for (let i = 0; i < 1000; i += 1) {
  const p = packet(`قرار إداري وتظلم وديوان المظالم وأريد إلغاء القرار رقم ${i}`, 'src-bog');
  assert(Boolean(p), `src-bog missing at ${i}`);
  assert((p?.references.length || 0) > 0, `src-bog has no references at ${i}`);
  assert((p?.verifiedArticles.length || 0) > 0, `src-bog has no verified article index at ${i}`);
  checks += 3;
}

for (let i = 0; i < 1000; i += 1) {
  const p = packet(`فرد عسكري وزارة الدفاع نظام خدمة الأفراد علاوة فنية واستحقاق رقم ${i}`, 'src-personnel');
  assert(Boolean(p), `src-personnel missing at ${i}`);
  assert((p?.references.length || 0) > 0, `src-personnel has no references at ${i}`);
  assert((p?.verifiedArticles.length || 0) > 0, `src-personnel has no verified articles at ${i}`);
  assert((p?.reviewMaterials?.length || 0) > 0, `src-personnel lost review-only transcript at ${i}`);
  checks += 4;
}

for (let i = 0; i < 1000; i += 1) {
  const p = packet(`مرسوم ملكي وقرار مجلس الوزراء وأداة إصدار وتعديل نظام رقم ${i}`, 'src-royal');
  assert(Boolean(p), `src-royal missing at ${i}`);
  assert((p?.references || []).every((ref) => /^https:\/\//.test(ref.sourceUrl)), `src-royal invalid URL at ${i}`);
  checks += 2;
}

for (let i = 0; i < 1000; i += 1) {
  const p = packet(`مبدأ قضائي وحكم سابق من المحكمة العليا رقم ${i}`, 'src-precedents');
  assert(Boolean(p), `src-precedents missing at ${i}`);
  assert(p?.status === 'warning', `precedent corpus must remain warning at ${i}`);
  assert((p?.blockers.length || 0) > 0, `precedent blocker missing at ${i}`);
  checks += 3;
}

console.log(JSON.stringify({
  ok: true,
  iterationsPerSourceAgent: 1000,
  sourceAgentsCovered: ['official-source','exact-text','amendments','src-bog','src-personnel','src-royal','src-precedents'],
  checks,
}, null, 2));
