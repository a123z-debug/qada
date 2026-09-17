import { X, Sliders, RotateCcw, Scale, Shield, ArrowRight } from 'lucide-react';
import { ChatSettings } from '../types';

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChatSettings;
  onSaveSettings: (settings: ChatSettings) => void;
}

export const OFFICIAL_LEGAL_SYSTEM_INSTRUCTION = `أنت "المستشار القضائي الإداري الصارم" أمام ديوان المظالم والمحاكم السعودية.
مهمتك: تقديم صياغات قضائية، دفوع نظامية، ولوائح دعوى قطعية بدون فلسفة نظرية أو حشو أو تهرب أو خلط بين الأنظمة.

[قواعد الانضباط والمنع الصارم - زر البور القضائي]:
1. [ممنوع الفلسفة والحشو والتكرار]: ادخل في صلب الموضوع القضائي والدفع النظامي مباشرة. يُمنع التردد، ويُمنع الوعظ، ويُمنع الكلام الإنشائي العام.
2. [الالتزام التام بالأوامر الملكية والمراسيم الصادرة]:
   - المرسوم الملكي رقم (م/37) وتاريخ 30/06/1430هـ: عدّل صراحة المادة (17/ب) من نظام خدمة الأفراد وأجاز الجمع بين علاوتين؛ وهو تشريع أعلى وأحدث ينسف أي حظر جمع سابق أو استناد إلى الأمر (12997).
   - قرار مجلس الوزراء رقم (118) وتاريخ 12/04/1425هـ: صدر بنصه لتقديم مزايا مالية إضافية واستيعاب الكليات التقنية بالفقرتين (س) و(ع) باللائحة 28-2؛ وتعديل مسمى (كاتب وطابع آلة) يخص علاوة الفنيين للرتبة والمؤهل عقب تشغيل الآلات الإلكترونية، ولا يمنع بدل الحاسب (15%) المقرر لطبيعة العمل والممارسة الفعلية للشبكات، وهو منسوخ حكماً بالمرسوم (م/37).
   - قرار مجلس الوزراء رقم (15) وتاريخ 27/01/1413هـ (المادة 6/ب): استثنى العلاوة الفنية صراحة من سقف البدلات.
   - المادة (8 / الفقرة 6) من نظام المرافعات أمام ديوان المظالم: حددت مهلة سماع دعاوى التعويض والعقود والمنازعات المالية بـ (10 سنوات)، فلا تخلط بينها وبين مهلة الـ (60) يوماً المخصصة للطعن في القرارات الإدارية الفردية المجردة.
3. [الفصل التام بين الاختصاصات القضائية]:
   - القضاء الإداري (ديوان المظالم): عيوب القرار، المادة 8، الخطأ المرفقي، الحقوق والبدلات، العقود الإدارية.
   - القضاء الجزائي: نظام الإجراءات الجزائية، بطلان القبض والتفتيش والتوقيف (المادتين 35 و43)، انعدام حالة التلبس، درء الشبهات.
   - القضاء العام: نظام المعاملات المدنية، نظام المرافعات الشرعية، نظام الإثبات، أركان المسؤولية التقصيرية والتعويض.
4. [جاهز للإيداع المباشر (Moeen-Ready)]: صياغة مذكرات ولوائح احترافية تبدأ بالبسملة وتنتهي بـ "مقدمه"، تتضمن الوقائع والدفوع والطلبات بشكل مرتب ومفصل.

سقف الرد لا يتجاوز 3500 حرف لضمان استقرار الإرسال القضائي.`;

export function ChatSettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: ChatSettingsModalProps) {
  if (!isOpen) return null;

  const handleReset = () => {
    onSaveSettings({
      systemInstruction: OFFICIAL_LEGAL_SYSTEM_INSTRUCTION,
      temperature: 0.25,
      maxCharacters: 3500,
      enhanceStyle: 'legal',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        id="chat-settings-modal"
        className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col text-neutral-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">إعدادات المنظومة القضائية والنموذج</h2>
              <p className="text-xs text-neutral-400">توجيهات ديوان المظالم ومعايير التحليل النظامي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="back-settings-modal-btn"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="رجوع"
            >
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              <span>رجوع</span>
            </button>
            <button
              id="close-settings-btn"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh] text-right">
          {/* Strict system instruction */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="system-instruction-input"
                className="text-xs font-bold text-neutral-200 flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>التعليمات السيادية للمنظومة (الموجه القضائي)</span>
              </label>
              <span className="text-[10px] text-amber-400/90 font-medium">
                ديوان المظالم - المادة 8 وسوابق البدلات
              </span>
            </div>
            <textarea
              id="system-instruction-input"
              rows={6}
              value={settings.systemInstruction}
              onChange={(e) =>
                onSaveSettings({ ...settings, systemInstruction: e.target.value })
              }
              className="w-full p-3 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500 transition-all font-mono leading-relaxed resize-y"
            />
            <p className="text-[11px] text-neutral-400 leading-normal">
              تلتزم المنظومة بعدم طلب JSON، والحفاظ على عزل الجلسات، وعدم تجاوز سقف 3500 حرف، والتقيد الصارم بالخماسية القضائية.
            </p>
          </div>

          {/* Temperature */}
          <div className="space-y-2 p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800">
            <div className="flex items-center justify-between">
              <label htmlFor="temp-slider" className="text-xs font-bold text-neutral-200">
                درجة الانضباط والحرية التحليلية ({settings.temperature.toFixed(2)})
              </label>
              <span className="text-[11px] text-amber-400 font-medium">
                {settings.temperature <= 0.3
                  ? 'انضباط قضائي فائق (الأمثل للترافع وسوابق البدلات)'
                  : settings.temperature <= 0.7
                  ? 'تحليل قانوني متوازن'
                  : 'توليد أفكار دفاعية استكشافية'}
              </span>
            </div>
            <input
              id="temp-slider"
              type="range"
              min="0"
              max="1.0"
              step="0.05"
              value={settings.temperature}
              onChange={(e) =>
                onSaveSettings({ ...settings, temperature: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500">
              <span>0.0 (دقة قطعية للنصوص والمواعيد)</span>
              <span>0.25 (الموصى به لديوان المظالم)</span>
              <span>1.0 (استكشافي)</span>
            </div>
          </div>

          {/* Prompt Enhancer Presets */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-200 block">
              نمط المطور القضائي التلقائي (Enhance Prompt)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'legal', label: 'قضائي شامل', desc: 'تكييف كامل + الهيكلية الخماسية' },
                { id: 'procedural', label: 'إجرائي شكلي', desc: 'تركيز على المادة 8 والمواعيد' },
                { id: 'substantive', label: 'موضوعي وعيوب القرار', desc: 'مشروعية القرار وأركانه' },
                { id: 'defense', label: 'مذكرة جوابية', desc: 'دفوع داحضة وطلبات جازمة' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  id={`preset-${preset.id}`}
                  type="button"
                  onClick={() =>
                    onSaveSettings({
                      ...settings,
                      enhanceStyle: preset.id as ChatSettings['enhanceStyle'],
                    })
                  }
                  className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                    settings.enhanceStyle === preset.id
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300 ring-1 ring-amber-500'
                      : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700 text-neutral-300'
                  }`}
                >
                  <div className="text-xs font-bold">{preset.label}</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-950/80">
          <button
            id="reset-settings-btn"
            onClick={handleReset}
            className="text-xs font-medium text-neutral-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            استعادة التوجيه النظامي الأصلي
          </button>
          <button
            id="done-settings-btn"
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            حفظ وتأكيد
          </button>
        </div>
      </div>
    </div>
  );
}
