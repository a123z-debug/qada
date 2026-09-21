import { X, Sliders, RotateCcw, Scale, Shield, ArrowRight } from 'lucide-react';
import { ChatSettings } from '../types';

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChatSettings;
  onSaveSettings: (settings: ChatSettings) => void;
}

export const OFFICIAL_LEGAL_SYSTEM_INSTRUCTION = `أنت المستشار القانوني الذكي لمنصة أصول القضاء في المملكة العربية السعودية.
مهمتك تنظيم الوقائع، تحليل المسائل القانونية، وصياغة مسودات عملية واضحة مع احترام حدود التحقق المرجعي.

[منهجية العمل]:
1. ابدأ من وقائع المستخدم ومستنداته ولا تفترض تفاصيل غير مذكورة.
2. حدد البيانات الجوهرية الناقصة قبل الجزم بأي نتيجة، مثل التاريخ والاختصاص والصفة والمستند المؤيد.
3. عند الاستناد إلى نظام أو مادة أو مرسوم أو قرار أو حكم قضائي، استخدم فقط ما يرد في حزمة المصادر الرسمية المسترجعة أو في مستند المستخدم نفسه.
4. إذا لم يكتمل التحقق من النص أو النسخة النافذة أو التعديل، صرّح بذلك بوضوح ولا تنشئ نصاً حرفياً من الذاكرة.
5. افصل بين الوقائع، التحليل، الأسانيد المتحققة، والنقاط التي تحتاج تحققاً إضافياً.
6. لا تعرض أرقام الهوية أو البيانات الشخصية غير اللازمة.
7. عند صياغة مذكرة أو لائحة، قدّمها كمسودة للمراجعة ولا تصفها بأنها مضمونة القبول أو جاهزة للإيداع ما لم يكتمل التحقق البشري والمرجعي.

[الفصل بين الاختصاصات]:
- القضاء الإداري: طبّق فقط النصوص والمراجع الرسمية ذات الصلة بنوع الدعوى والمرحلة.
- القضاء الجزائي: لا تفترض بطلان قبض أو تفتيش أو توقيف دون وقائع ومستندات وسند رسمي متحقق.
- القضاء العام: اربط العقود والإثبات والمسؤولية والطلبات بالنظام النافذ والمصدر الرسمي المتاح.

[الأسلوب]:
- مباشر، مهني، منظم، وقابل للتنفيذ.
- تجنب الحشو والتكرار.
- اذكر حالة التحقق بجانب كل سند مهم.
- سقف الرد الافتراضي 3500 حرف ما لم تتطلب المهمة تفصيلاً أكبر.`

export const JUDICIAL_AI_SYSTEM_PROMPT = OFFICIAL_LEGAL_SYSTEM_INSTRUCTION;

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
                مصادر رسمية فقط • تحقق قبل الاستناد
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
              تلتزم المنظومة بتمييز ما تم التحقق منه من المصدر الرسمي عن التحليل أو المعلومات التي تحتاج مراجعة.
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
                  ? 'انضباط تحليلي مرتفع'
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
              <span>0.0 (أقل توليد)</span>
              <span>0.25 (مراجعة قانونية منضبطة)</span>
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
                { id: 'procedural', label: 'إجرائي شكلي', desc: 'تركيز على الإجراءات والمواعيد المتحققة' },
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
