// Guards against UI text regressions found in the 2026-10-30 platform audit:
// overclaims, Arabic number agreement, mixed digit systems, English-only labels,
// unreadable font sizes and locale-less date formatting.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { arabicCount } from '../src/utils/arabicCount.js';

const failures: string[] = [];
let checks = 0;

function expect(condition: boolean, message: string) {
  checks++;
  if (!condition) failures.push(message);
}

const references = { one: 'مرجع واحد', two: 'مرجعان', plural: 'مراجع', accusative: 'مرجعاً', singular: 'مرجع' };
for (const [count, expected] of [
  [0, '0 مراجع'], [1, 'مرجع واحد'], [2, 'مرجعان'], [3, '3 مراجع'], [10, '10 مراجع'], [11, '11 مرجعاً'],
  [99, '99 مرجعاً'], [100, '100 مرجع'], [103, '103 مراجع'], [111, '111 مرجعاً'], [1000, '1000 مرجع'],
] as const) {
  expect(arabicCount(count, references) === expected, `arabicCount(${count}) = "${arabicCount(count, references)}", expected "${expected}"`);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const uiFiles = walk(path.join(process.cwd(), 'src')).filter((file) => file.endsWith('.tsx'));

const rules: Array<{ id: string; pattern: RegExp; message: string }> = [
  { id: 'overclaim', pattern: /صحيحة ومستوفية[^'"`]*100%|مضمونة القبول(?! أو)|نضمن لك/, message: 'absolute-certainty claim in user-facing copy' },
  { id: 'arabic-indic-digits', pattern: /[٠-٩]/, message: 'Arabic-Indic digits mixed with the Western digits used across the UI' },
  { id: 'tiny-font', pattern: /text-\[(?:[0-9]|10)(?:\.\d+)?px\]/, message: 'font size below 11px' },
  { id: 'emoji', pattern: /[\u{1F300}-\u{1FAFF}\u{2B50}\u{26F6}]/u, message: 'emoji/pictograph used as UI decoration' },
  { id: 'english-label', pattern: />\s*(?:ADMIN|LIVE|SECURE OS|OS v3\.0)\s*<|placeholder="Admin code"|\(LocalStorage\)/, message: 'English-only label in the Arabic interface' },
  { id: 'locale-less-date', pattern: /toLocale(?:Date|Time)?String\(\s*\)/, message: 'date/number formatting without an explicit locale' },
  { id: 'hijri-arabic-digit-locale', pattern: /toLocale(?:Date|Time)?String\('ar-SA'\)/, message: "use 'ar-SA-u-nu-latn' to keep Western digits" },
  { id: 'decorative-check', pattern: / ✓['`<]/, message: 'decorative check mark appended to Arabic copy' },
];

for (const file of uiFiles) {
  const relative = path.relative(process.cwd(), file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const rule of rules) {
      expect(!rule.pattern.test(line), `${relative}:${index + 1} [${rule.id}] ${rule.message}`);
    }
  });
}

const app = readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
const watermark = app.slice(app.indexOf('function SecurityWatermark'), app.indexOf('function SystemAgentBar'));
expect(watermark.includes('aria-hidden="true"'), 'security watermark must be hidden from screen readers');
expect(!/:\s*'ADMIN'/.test(watermark), 'security watermark must not label regular users as ADMIN');

if (failures.length) {
  console.error(`ui text quality FAILED (${failures.length}):\n- ${failures.slice(0, 40).join('\n- ')}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checks, files: uiFiles.length }, null, 2));
