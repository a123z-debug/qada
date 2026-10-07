import {
  independentPanelContext,
  type IndependentJudicialPanelResult,
} from '../api/_judicialPanel.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const panel: IndependentJudicialPanelResult = {
  mode: 'two-independent-reviewers-plus-synthesizer',
  completed: 2,
  opinions: [
    {
      role: 'procedure-source',
      label: 'مراجع الإجراءات والمصادر',
      status: 'CLEAR',
      findings: [],
      strongestCounterpoint: '',
      unresolved: [],
      model: 'model-a',
    },
    {
      role: 'evidence-opponent',
      label: 'مراجع الإثبات والخصم',
      status: 'CONCERN',
      findings: ['مستند جوهري يحتاج ربطاً بالواقعة.'],
      strongestCounterpoint: 'الخصم قد يدفع بعدم كفاية الإثبات.',
      unresolved: ['صلة المستند بالطلب النهائي.'],
      model: 'model-b',
    },
  ],
  disagreements: ['اختلاف في مستوى الخطر'],
};

const context = independentPanelContext(panel);
assert(context.includes('استدعاءات مستقلة'), 'panel context must disclose independent calls');
assert(context.includes('غير ملزمة بذاتها'), 'panel opinions must not be treated as deterministic truth');
assert(context.includes('مراجع الإجراءات والمصادر'), 'procedure reviewer missing');
assert(context.includes('مراجع الإثبات والخصم'), 'evidence/opponent reviewer missing');
assert(context.includes('أقوى حجة مضادة'), 'counterparty challenge missing');
assert(context.includes('اختلاف في مستوى الخطر'), 'disagreement must be surfaced');

console.log(JSON.stringify({ ok: true, panelMode: panel.mode, completed: panel.completed }, null, 2));
