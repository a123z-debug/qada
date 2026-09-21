export type RedactionResult = { text: string; redactions: number };

const RULES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b[12١٢][0-9٠-٩]{9}\b/g, replacement: '[محجوب: رقم هوية/إقامة]' },
  { pattern: /\bSA[0-9]{22}\b/gi, replacement: '[محجوب: رقم آيبان]' },
  { pattern: /\b(?:\+?966|0)?5[0-9]{8}\b/g, replacement: '[محجوب: رقم جوال]' },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[محجوب: بريد إلكتروني]' },
];

export function redactDirectIdentifiers(value: string): RedactionResult {
  let text = String(value || '');
  let redactions = 0;
  for (const rule of RULES) {
    text = text.replace(rule.pattern, () => {
      redactions += 1;
      return rule.replacement;
    });
  }
  return { text, redactions };
}