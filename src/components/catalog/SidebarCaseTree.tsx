import React, { useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { CASE_TAXONOMY, TaxonomyNode, countLeaves, pathToHash } from '../../data/caseTaxonomy';

interface SidebarCaseTreeProps {
  /** يفتح نافذة الفهرس؛ الرابط يكون قد ضُبط مسبقاً على صفحة النوع المختار. */
  onOpenCatalog: () => void;
}

const LEVEL_TEXT: Record<number, string> = {
  1: 'text-xs font-bold text-slate-200',
  2: 'text-xs font-semibold text-slate-300',
  3: 'text-[11px] font-semibold text-slate-300',
  4: 'text-[11px] text-slate-400',
};

/**
 * قائمة جانبية بأربعة مستويات: قطاع ← فرع ← تصنيف ← نوع القضية.
 * فرع واحد مفتوح في كل مستوى (فتح عقدة يغلق أخواتها) حتى تبقى القائمة قصيرة.
 */
export function SidebarCaseTree({ onOpenCatalog }: SidebarCaseTreeProps) {
  const [openPath, setOpenPath] = useState<string[]>([]);

  const isOpen = (node: TaxonomyNode) => node.path.every((key, index) => openPath[index] === key);

  const toggle = (node: TaxonomyNode) => {
    setOpenPath(isOpen(node) ? node.path.slice(0, -1) : node.path);
  };

  const openLeaf = (node: TaxonomyNode) => {
    try {
      window.history.pushState(null, '', pathToHash(node.path));
    } catch { /* الفهرس يفتح على الصفحة الرئيسية إن تعذر ضبط الرابط */ }
    onOpenCatalog();
  };

  const renderLevel = (nodes: TaxonomyNode[], nested: boolean) => (
    <ul className={nested ? 'mr-3 border-r border-slate-800 pr-1.5 space-y-0.5' : 'space-y-0.5'}>
      {nodes.map((node) => {
        if (node.level === 4) {
          return (
            <li key={node.key}>
              <button
                type="button"
                onClick={() => openLeaf(node)}
                className={`min-h-11 w-full flex items-center justify-between gap-2 rounded-lg px-2 text-right hover:bg-slate-900 hover:text-white transition-colors ${LEVEL_TEXT[4]}`}
              >
                <span className="min-w-0 truncate">{node.label}</span>
                <ChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
            </li>
          );
        }
        const open = isOpen(node);
        return (
          <li key={node.key}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(node)}
              className={`min-h-11 w-full flex items-center justify-between gap-2 rounded-lg px-2 text-right hover:bg-slate-900 transition-colors ${
                open ? 'bg-slate-900' : ''
              } ${LEVEL_TEXT[node.level]}`}
            >
              <span className="min-w-0 truncate">{node.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="rounded bg-slate-800 px-1 text-[9px] font-mono text-slate-400">{countLeaves(node)}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180 text-amber-400' : ''}`} />
              </span>
            </button>
            {open && renderLevel(node.children, true)}
          </li>
        );
      })}
    </ul>
  );

  return <nav aria-label="فهرس أنواع القضايا">{renderLevel(CASE_TAXONOMY, false)}</nav>;
}
