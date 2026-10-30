import { useEffect, useId, useMemo, useRef, useState, type ElementType, type KeyboardEvent } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';

export type CommandAction = {
  id: string;
  label: string;
  group: string;
  icon: ElementType;
  hint?: string;
  keywords?: string;
  run: () => void;
};

// Fold the spelling variants people actually type (hamza forms, ta marbuta,
// alef maqsura, diacritics) so "اداري" finds "إداري".
export function normalizeArabic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export function CommandPalette({ open, onClose, actions }: { open: boolean; onClose: () => void; actions: CommandAction[] }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const needle = normalizeArabic(query);
    if (!needle) return actions;
    const terms = needle.split(' ');
    return actions.filter((action) => {
      const haystack = normalizeArabic(`${action.label} ${action.group} ${action.hint || ''} ${action.keywords || ''}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [actions, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const run = (action: CommandAction | undefined) => {
    if (!action) return;
    onClose();
    action.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(results[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div className="qc-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="qc-panel" role="dialog" aria-modal="true" aria-label="البحث والانتقال السريع">
        <div className="qc-search">
          <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="ابحث عن محكمة أو خدمة أو أداة..."
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined}
            aria-label="ابحث عن محكمة أو خدمة أو أداة"
          />
          <kbd className="qc-kbd">Esc</kbd>
        </div>

        <ul ref={listRef} id={listId} role="listbox" className="qc-list" aria-label="النتائج">
          {results.length === 0 && <li className="qc-empty">لا توجد نتيجة مطابقة.</li>}
          {results.map((action, index) => {
            const Icon = action.icon;
            const showGroup = action.group !== lastGroup;
            lastGroup = action.group;
            return (
              <li key={action.id} role="presentation">
                {showGroup && <div className="qc-group" aria-hidden="true">{action.group}</div>}
                <div
                  id={`${listId}-${action.id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-index={index}
                  className="qc-option"
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => run(action)}
                >
                  <span className="qc-option-icon" aria-hidden="true"><Icon className="h-4 w-4" /></span>
                  <span className="qc-option-text">
                    <span className="qc-option-label">{action.label}</span>
                    {action.hint && <span className="qc-option-hint">{action.hint}</span>}
                  </span>
                  {index === activeIndex && <CornerDownLeft className="qc-option-enter h-4 w-4" aria-hidden="true" />}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="qc-foot" aria-hidden="true">
          <span><kbd className="qc-kbd">↑</kbd><kbd className="qc-kbd">↓</kbd> للتنقل</span>
          <span><kbd className="qc-kbd">Enter</kbd> للفتح</span>
          <span><kbd className="qc-kbd">Ctrl</kbd><kbd className="qc-kbd">K</kbd> للإظهار والإخفاء</span>
        </div>
      </div>
    </div>
  );
}
