export type CitationGuardResult = {
  introducedMarkers: string[];
  unsupportedMarkers: string[];
  blocked: boolean;
};

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)));
}

function normalizeArabic(value: string): string {
  return toLatinDigits(value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}\s/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// أرقام المواد المكتوبة بالكلمات («المادة الثامنة»، «المادة السادسة والعشرون بعد المائة»).
// الكتابة القانونية السعودية تستخدمها كثيراً، فلا يكفي التقاط الأرقام وحدها.
// المفاتيح على النص بعد normalizeArabic (ة→ه، ى→ي، أ/إ/آ→ا).
// ---------------------------------------------------------------------------
const ORDINAL_UNITS: Record<string, number> = {
  الاول: 1, الاولي: 1, الحادي: 1, الحاديه: 1,
  الثاني: 2, الثانيه: 2, الثالث: 3, الثالثه: 3, الرابع: 4, الرابعه: 4, الخامس: 5, الخامسه: 5,
  السادس: 6, السادسه: 6, السابع: 7, السابعه: 7, الثامن: 8, الثامنه: 8, التاسع: 9, التاسعه: 9,
  العاشر: 10, العاشره: 10,
};
const ORDINAL_TENS: Record<string, number> = {
  العشرون: 20, العشرين: 20, الثلاثون: 30, الثلاثين: 30, الاربعون: 40, الاربعين: 40, الخمسون: 50, الخمسين: 50,
  الستون: 60, الستين: 60, السبعون: 70, السبعين: 70, الثمانون: 80, الثمانين: 80, التسعون: 90, التسعين: 90,
};
const ORDINAL_HUNDREDS: Record<string, number> = {
  المائه: 100, المئه: 100, المايه: 100,
  المائتين: 200, المئتين: 200, المائتان: 200, المئتان: 200,
  الثلاثمائه: 300, الثلاثمئه: 300, الاربعمائه: 400, الاربعمئه: 400, الخمسمائه: 500, الخمسمئه: 500,
  الستمائه: 600, الستمئه: 600, السبعمائه: 700, السبعمئه: 700, الثمانمائه: 800, الثمانمئه: 800,
  التسعمائه: 900, التسعمئه: 900,
};

/** يحلّل كلمات العدد الترتيبي بعد «المادة». يُرجع القيمة وعدد الكلمات المستهلكة، أو null إن لم تكن عدداً. */
function parseOrdinalWords(tokens: string[]): { value: number; consumed: number } | null {
  let units = 0;
  let teen = 0;
  let tens = 0;
  let hundreds = 0;
  let matched = false;
  let expectHundreds = false;
  let consumed = 0;
  for (const raw of tokens) {
    const token = raw.replace(/^و(?=ال)/, '');
    if (expectHundreds) {
      if (!ORDINAL_HUNDREDS[token]) break;
      hundreds = ORDINAL_HUNDREDS[token];
      expectHundreds = false;
      consumed += 1;
      continue;
    }
    if (ORDINAL_UNITS[token] && !units && !tens && !teen && !hundreds) { units = ORDINAL_UNITS[token]; matched = true; consumed += 1; continue; }
    if ((token === 'عشره' || token === 'عشر') && units > 0 && units < 10 && !teen && !tens) { teen = 10; consumed += 1; continue; }
    if (ORDINAL_TENS[token] && !tens && !hundreds) { tens = ORDINAL_TENS[token]; matched = true; consumed += 1; continue; }
    if (token === 'بعد' && matched && !hundreds) { expectHundreds = true; consumed += 1; continue; }
    if (ORDINAL_HUNDREDS[token] && !matched) { hundreds = ORDINAL_HUNDREDS[token]; matched = true; consumed += 1; continue; }
    break;
  }
  if (expectHundreds) consumed -= 1; // «بعد» بلا مئات بعدها ليست جزءاً من العدد
  if (!matched) return null;
  return { value: units + teen + tens + hundreds, consumed };
}

/** رقم المادة في علامة استشهاد واحدة (أرقام غربية أو عربية هندية أو كلمات)، أو null إن لم تكن علامة مادة. */
function articleNumberOf(marker: string): number | null {
  const value = normalizeArabic(marker);
  const digits = /^الماده\s*(\d{1,3})(?!\d)/.exec(value);
  if (digits) return Number(digits[1]);
  const words = /^الماده\s+(.+)$/.exec(value);
  if (!words) return null;
  return parseOrdinalWords(words[1].split(' '))?.value ?? null;
}

/** كل أرقام المواد الواردة في نص مطبَّع، بأي صيغة. */
function articleNumbersIn(normalized: string): Set<number> {
  const numbers = new Set<number>();
  for (const match of normalized.matchAll(/الماده\s*(\d{1,3})(?!\d)/g)) numbers.add(Number(match[1]));
  // نظرة للأمام بلا استهلاك: حتى لا تبتلع مادةٌ الكلماتِ التي تبدأ بها المادة التالية.
  for (const match of normalized.matchAll(/الماده(?=((?:\s+\S+){1,6}))/g)) {
    const parsed = parseOrdinalWords(match[1].trim().split(' '));
    if (parsed) numbers.add(parsed.value);
  }
  return numbers;
}

// حزمة المصادر نفسها تُمرَّر مع كل مقطع بث؛ نحتفظ بآخر نتيجة حتى لا نعيد تحليلها في كل مقطع.
let cachedContext: { text: string; normalized: string; articles: Set<number> } | null = null;

function analyzedContext(text: string): { normalized: string; articles: Set<number> } {
  if (cachedContext && cachedContext.text === text) return cachedContext;
  const normalized = normalizeArabic(text);
  cachedContext = { text, normalized, articles: articleNumbersIn(normalized) };
  return cachedContext;
}

const DIGIT = '[0-9٠-٩]';
const ARABIC_WORD = '[\\u0621-\\u064A\\u064B-\\u0652\\u0640]+';
/** عبارات ادعاء سوابق مستقرة (لا تشمل «مبدأ قضائي» وحدها لأنها ترد في تحذيرات حزمة المصادر نفسها). */
// يُطبَّق على النص الخام، فيقبل «على» بالألف المقصورة أو بالياء (\u0649 أو \u064A) كما يكتبها الناس.
const PRECEDENT_CLAIM = /(?:استقرار|استقر|يستقر|استقرت|تستقر|جر[\u0649\u064A]|يجري|درج)\s+(?:عليه\s+|عل[\u0649\u064A]\s+ذلك\s+)?(?:ال)?(?:قضاء|فقه)(?:\s+(?:ال)?قضائي)?(?:\s+(?:الإداري|الاداري|ديوان\s+المظالم))?|المستقر\s+عليه\s+(?:في\s+)?(?:ال)?قضاء|المستقر\s+قضاء(?:ً|ا)?|استقرت\s+(?:عليه\s+)?(?:ال)?(?:أحكام|احكام)|المبادئ\s+(?:القضائية\s+)?المستقرة|مبادئ\s+القضاء\s+(?:الإداري|الاداري)/g;
const ORDINAL_TOKEN = `(?:و?ال${ARABIC_WORD}|عشر[ةه]?|بعد)`;

export function extractLegalCitationMarkers(text: string): string[] {
  const values = new Set<string>();
  const patterns = [
    new RegExp(`الماد(?:ة|ه)\\s*\\(?\\s*${DIGIT}{1,3}(?:\\s*\\/\\s*${DIGIT}{1,3})?\\s*\\)?`, 'g'),
    new RegExp(`مرسوم\\s+ملكي\\s*(?:رقم)?\\s*\\(?\\s*[مM]?\\/?${DIGIT}+[${'0-9٠-٩'}/\\-]*`, 'g'),
    new RegExp(`(?:أمر|امر)\\s+ملكي\\s*(?:رقم)?\\s*\\(?\\s*[أA]?[\\/\\-]?${DIGIT}+[${'0-9٠-٩'}/\\-]*`, 'g'),
    new RegExp(`قرار\\s+مجلس\\s+الوزراء\\s*(?:رقم)?\\s*\\(?\\s*${DIGIT}+[${'0-9٠-٩'}/\\-]*`, 'g'),
    new RegExp(`حكم\\s*(?:رقم)?\\s*\\(?\\s*${DIGIT}+[${'0-9٠-٩'}/\\-]*`, 'g'),
    new RegExp(`قرار\\s+(?:رقم)?\\s*\\(?\\s*${DIGIT}+[${'0-9٠-٩'}/\\-]*\\s*(?:وتاريخ|بتاريخ)?\\s*${DIGIT}{0,4}[\\-/]?${DIGIT}{0,2}[\\-/]?${DIGIT}{0,4}`, 'g'),
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const marker = String(match[0] || '').trim();
      if (marker) values.add(marker);
    }
  }

  // ادعاء «استقرار القضاء» إسناد إلى سوابق: لا يُقبل إلا إن ورد في كلام صاحب الشأن أو في مصدر قضائي متحقق.
  // قاعدة السوابق في المنصة غير جاهزة، فكان النموذج يكتب «استقر القضاء الإداري على…» بلا أي سند.
  for (const match of text.matchAll(PRECEDENT_CLAIM)) {
    const marker = String(match[0] || '').trim();
    if (marker) values.add(marker);
  }

  // المواد المكتوبة بالكلمات: تُحفظ العلامة بالكلمات العددية فقط دون ما بعدها.
  const wordArticle = new RegExp(`الماد(?:ة|ه)\\s+(${ORDINAL_TOKEN}(?:\\s+${ORDINAL_TOKEN}){0,5})`, 'g');
  for (const match of text.matchAll(wordArticle)) {
    const rawTokens = match[1].split(/\s+/);
    const parsed = parseOrdinalWords(rawTokens.map((token) => normalizeArabic(token)));
    if (!parsed || parsed.consumed === 0) continue;
    const head = match[0].slice(0, match[0].indexOf(match[1]));
    values.add(`${head}${rawTokens.slice(0, parsed.consumed).join(' ')}`.trim());
  }

  return Array.from(values).slice(0, 80);
}

export function guardIntroducedLegalCitations(
  originalText: string,
  revisedText: string,
  verifiedContext: string,
): CitationGuardResult {
  const original = normalizeArabic(originalText);
  const originalArticles = articleNumbersIn(original);
  const verified = analyzedContext(verifiedContext);
  const revisedMarkers = extractLegalCitationMarkers(revisedText);

  // علامات المواد تُقارن برقم المادة لا بنص جزئي: فلا تمر «المادة 7» لأن السياق فيه «المادة 77».
  const introducedMarkers = revisedMarkers.filter((marker) => {
    const article = articleNumberOf(marker);
    if (article !== null) return !originalArticles.has(article);
    const normalized = normalizeArabic(marker);
    return normalized && !original.includes(normalized);
  });

  const unsupportedMarkers = introducedMarkers.filter((marker) => {
    const article = articleNumberOf(marker);
    if (article !== null) return !verified.articles.has(article);
    const normalized = normalizeArabic(marker);
    return normalized && !verified.normalized.includes(normalized);
  });

  return {
    introducedMarkers,
    unsupportedMarkers,
    blocked: unsupportedMarkers.length > 0,
  };
}
