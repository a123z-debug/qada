import { readFileSync } from 'node:fs';
import { normalizeArabic } from '../src/components/CommandPalette.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Common spelling variants must find the canonical labels.
for (const [typed, label] of [
  ['لائحه دعوي', 'لائحة دعوى'],
  ['المحاكم الاداريه', 'المحاكم الإدارية'],
  ['اسال', 'اسأل QADA'],
  ['مُذكّرة دفوع', 'مذكرة دفوع'],
] as const) {
  assert(normalizeArabic(label).includes(normalizeArabic(typed)), `"${typed}" must match "${label}"`);
}

const app = readFileSync('src/App.tsx', 'utf8');
assert(app.includes('<CommandPalette') && app.includes("event.code === 'KeyK'"), 'App must mount the command palette with a layout-independent Ctrl/⌘+K shortcut');
assert(app.includes('aria-label="البحث والانتقال السريع"'), 'Palette must be reachable from a labelled button (mobile and desktop)');

const palette = readFileSync('src/components/CommandPalette.tsx', 'utf8');
for (const token of ['role="combobox"', 'role="listbox"', 'role="option"', 'aria-activedescendant', "event.key === 'Escape'"]) {
  assert(palette.includes(token), `Command palette accessibility contract missing: ${token}`);
}

console.log(JSON.stringify({ ok: true, suite: 'command-palette' }));
