// Arabic number–noun agreement for UI counters.
// 1 and 2 use the dedicated singular/dual phrase, 3–10 take the plural,
// 11–99 take the accusative singular (tamyiz), and round hundreds/thousands
// take the genitive singular.
export type ArabicNounForms = {
  one: string; // "مرجع واحد"
  two: string; // "مرجعان"
  plural: string; // "مراجع"
  accusative: string; // "مرجعاً"
  singular: string; // "مرجع"
};

export function arabicCount(count: number, forms: ArabicNounForms): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n === 0) return `0 ${forms.plural}`;
  const lastTwo = n % 100;
  if (lastTwo >= 3 && lastTwo <= 10) return `${n} ${forms.plural}`;
  if (lastTwo >= 11) return `${n} ${forms.accusative}`;
  return `${n} ${forms.singular}`;
}
