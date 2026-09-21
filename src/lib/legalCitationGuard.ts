export type CitationGuardResult = {
  introducedMarkers: string[];
  unsupportedMarkers: string[];
  blocked: boolean;
};

function normalizeArabic(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}\s/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractLegalCitationMarkers(text: string): string[] {
  const values = new Set<string>();
  const patterns = [
    /الماد(?:ة|ه)\s*\(?\s*\d{1,3}(?:\s*\/\s*\d{1,3})?\s*\)?/g,
    /مرسوم\s+ملكي\s*(?:رقم)?\s*\(?\s*[مM]?\/?\d+[\d/\-]*/g,
    /(?:أمر|امر)\s+ملكي\s*(?:رقم)?\s*\(?\s*[أA]?[\/\-]?\d+[\d/\-]*/g,
    /قرار\s+مجلس\s+الوزراء\s*(?:رقم)?\s*\(?\s*\d+[\d/\-]*/g,
    /حكم\s*(?:رقم)?\s*\(?\s*\d+[\d/\-]*/g,
    /قرار\s+(?:رقم)?\s*\(?\s*\d+[\d/\-]*\s*(?:وتاريخ|بتاريخ)?\s*\d{0,4}[\-/]?\d{0,2}[\-/]?\d{0,4}/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const marker = String(match[0] || '').trim();
      if (marker) values.add(marker);
    }
  }

  return Array.from(values).slice(0, 80);
}

export function guardIntroducedLegalCitations(
  originalText: string,
  revisedText: string,
  verifiedContext: string,
): CitationGuardResult {
  const original = normalizeArabic(originalText);
  const verified = normalizeArabic(verifiedContext);
  const revisedMarkers = extractLegalCitationMarkers(revisedText);
  const introducedMarkers = revisedMarkers.filter((marker) => {
    const normalized = normalizeArabic(marker);
    return normalized && !original.includes(normalized);
  });

  const unsupportedMarkers = introducedMarkers.filter((marker) => {
    const normalized = normalizeArabic(marker);
    return normalized && !verified.includes(normalized);
  });

  return {
    introducedMarkers,
    unsupportedMarkers,
    blocked: unsupportedMarkers.length > 0,
  };
}
