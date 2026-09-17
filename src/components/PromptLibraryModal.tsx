import { useState } from 'react';
import { X, Search, Scale, Check, BookMarked, ArrowRight } from 'lucide-react';
import { PROMPT_TEMPLATES } from '../data/promptTemplates';
import { PromptTemplate, LegalCategory } from '../types';

interface PromptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: PromptTemplate) => void;
}

export function PromptLibraryModal({ isOpen, onClose, onSelect }: PromptLibraryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');

  if (!isOpen) return null;

  const categories = [
    'الكل',
    'فحص المواعيد (مادة 8)',
    'سوابق وبدلات الحاسب',
    'دعاوى الإلغاء وعيوب القرار',
    'تحليل صكوك الأحكام',
    'صياغة المذكرات والدفوع',
  ];

  const filtered = PROMPT_TEMPLATES.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.prompt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'الكل' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        id="prompt-library-modal"
        className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-neutral-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">مكتبة النماذج والاستشارات القضائية</h2>
              <p className="text-xs text-neutral-400">قوالب صياغة الدفوع وتحليل قضايا ديوان المظالم السعودي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="back-library-modal-btn"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="رجوع"
            >
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              <span>رجوع</span>
            </button>
            <button
              id="close-library-btn"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Category filter */}
        <div className="p-4 border-b border-neutral-800 space-y-3 bg-neutral-950/60">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="library-search-input"
              type="text"
              placeholder="ابحث في النماذج (المادة 8، مكافأة الحاسب، عيوب القرار، إلغاء، استئناف)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500 transition-all placeholder:text-neutral-500"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                id={`cat-btn-${cat}`}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:border-neutral-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Templates list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              لم يتم العثور على نماذج قضائية مطابقة لمعايير البحث.
            </div>
          ) : (
            filtered.map((t) => (
              <div
                key={t.id}
                id={`template-item-${t.id}`}
                className="p-4 rounded-xl border border-neutral-800 hover:border-amber-500/40 bg-neutral-900/60 transition-all hover:bg-neutral-900 space-y-2.5 text-right"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-neutral-100">{t.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                        {t.category}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{t.description}</p>
                  </div>
                  <button
                    id={`apply-template-${t.id}`}
                    onClick={() => {
                      onSelect(t);
                      onClose();
                    }}
                    className="shrink-0 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    تطبيق
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 text-xs text-neutral-300 font-mono line-clamp-3 whitespace-pre-wrap leading-relaxed">
                  {t.prompt}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
