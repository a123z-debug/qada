export type RedactionResult = { text: string; redactions: number };

// الأرقام قد تُكتب غربية (0-9) أو عربية هندية (٠-٩)، وكثير من المستخدمين يكتبون بالثانية من لوحة المفاتيح العربية.
// لا نعتمد على \b لأنها لا تعرف الأرقام العربية الهندية حدوداً للكلمة؛ نستخدم «لا رقم قبله ولا بعده» بدلاً منها.
const DIGIT = '[0-9٠-٩]';
const NO_DIGIT_BEFORE = '(?<![0-9٠-٩])';
const NO_DIGIT_AFTER = '(?![0-9٠-٩])';
// فاصل اختياري واحد بين الخانات: مسافة أو شرطة (مثل 055 123 4567 أو SA03 8000 ...).
const SEP = '[ \\t-]?';

const RULES: Array<{ pattern: RegExp; replacement: string | ((match: string, ...groups: string[]) => string) }> = [
  // الرقم العسكري يعرّف صاحبه في جهته: يُحجب الرقم وتبقى العبارة الدالة عليه.
  {
    pattern: new RegExp(`((?:الرقم|رقمي|رقمه|رقم)\\s+(?:ال)?عسكري(?:\\s+(?:للموكل|للمدعي|الخاص بي))?\\s*[:：]?\\s*\\(?\\s*)${DIGIT}{4,12}${NO_DIGIT_AFTER}`, 'g'),
    replacement: (_match, prefix) => `${prefix}[محجوب: رقم عسكري]`,
  },
  { pattern: new RegExp(`${NO_DIGIT_BEFORE}[12١٢]${DIGIT}{9}${NO_DIGIT_AFTER}`, 'g'), replacement: '[محجوب: رقم هوية/إقامة]' },
  { pattern: new RegExp(`\\bSA${SEP}(?:${DIGIT}${SEP}){21}${DIGIT}${NO_DIGIT_AFTER}`, 'gi'), replacement: '[محجوب: رقم آيبان]' },
  {
    pattern: new RegExp(`${NO_DIGIT_BEFORE}(?:(?:\\+|00)(?:966|٩٦٦)${SEP}|[0٠])?[5٥](?:${SEP}${DIGIT}){8}${NO_DIGIT_AFTER}`, 'g'),
    replacement: '[محجوب: رقم جوال]',
  },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[محجوب: بريد إلكتروني]' },
];

export function redactDirectIdentifiers(value: string): RedactionResult {
  let text = String(value || '');
  let redactions = 0;
  for (const rule of RULES) {
    text = text.replace(rule.pattern, (match: string, ...groups: string[]) => {
      redactions += 1;
      return typeof rule.replacement === 'function' ? rule.replacement(match, ...groups) : rule.replacement;
    });
  }
  return { text, redactions };
}
