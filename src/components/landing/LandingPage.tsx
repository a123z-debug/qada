import type { ReactNode } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  FileCheck,
  FileText,
  FolderOpen,
  Gavel,
  Landmark,
  Library,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { OFFICIAL_JUDICIAL_REFERENCE_INDEX } from '../../data/officialJudicialReferenceIndex';
import { OFFICIAL_JUDICIAL_REGULATIONS } from '../../data/officialJudicialRegulations';
import { AgentFlowDiagram } from '../AgentFlowDiagram';
import { arabicCountNoun } from '../../utils/arabicCount';

export type LandingIntent =
  | { kind: 'dashboard' }
  | { kind: 'repository' }
  | { kind: 'dossier' }
  | { kind: 'assistant'; prefill?: string };

// Counts come from the indexed data so the page never advertises more than
// the platform actually holds.
const VERIFIED_SYSTEMS = OFFICIAL_JUDICIAL_REFERENCE_INDEX.filter((reference) => reference.status === 'official-verified').length;
const VERIFIED_REGULATIONS = OFFICIAL_JUDICIAL_REGULATIONS.filter((regulation) => regulation.status === 'official-verified').length;

const QUICK_STARTS: Array<{ icon: typeof Bot; title: string; text: string; intent: LandingIntent }> = [
  { icon: Bot, title: 'عندي مشكلة قانونية', text: 'احكِ ما حدث بطريقتك، ونرتب لك الخطوة التالية.', intent: { kind: 'assistant', prefill: 'عندي مشكلة قانونية وأبغى أعرف وش أسوي. اسألني فقط عن المعلومات الناقصة وابدأ من الوقائع.' } },
  { icon: FileCheck, title: 'عندي حكم أو قرار', text: 'ارفعه أو اشرحه، واعرف طريق الاعتراض وما يلزمك.', intent: { kind: 'dossier' } },
  { icon: FileText, title: 'أبغى دعوى أو مذكرة', text: 'نجمع البيانات خطوة بخطوة ثم نبني مسودة للمراجعة.', intent: { kind: 'assistant', prefill: 'أبغى أجهز دعوى أو مذكرة. اجمع مني البيانات خطوة بخطوة وحدد لي المطلوب والمستندات قبل الصياغة.' } },
  { icon: Library, title: 'أبي أعرف حقي', text: 'ابحث في الأنظمة والمراجع الرسمية بلغة واضحة.', intent: { kind: 'repository' } },
];

function BentoTile({ icon, title, text, className = '', children }: { icon: ReactNode; title: string; text: string; className?: string; children?: ReactNode }) {
  return (
    <article className={`ql-tile ${className}`}>
      <span className="ql-tile-icon" aria-hidden="true">{icon}</span>
      <h3 className="ql-tile-title">{title}</h3>
      <p className="ql-tile-text">{text}</p>
      {children}
    </article>
  );
}

export function LandingPage({ onEnterApp }: { onEnterApp: (intent?: LandingIntent) => void }) {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div id="home" className="qada-saudi-landing ql-page" dir="rtl">
      <header className="ql-nav">
        <div className="ql-container ql-nav-inner">
          <button type="button" className="ql-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="أصول القضاء — أعلى الصفحة">
            <span className="ql-brand-mark" aria-hidden="true"><Scale className="h-5 w-5" strokeWidth={1.8} /></span>
            <span className="ql-brand-text">
              <span className="ql-brand-name">أصول القضاء</span>
              <span className="ql-brand-sub">QADA</span>
            </span>
          </button>

          <nav className="ql-nav-links" aria-label="أقسام الصفحة">
            <button type="button" onClick={() => scrollTo('platform')}>المنصة</button>
            <button type="button" onClick={() => scrollTo('how')}>كيف تعمل</button>
            <button type="button" onClick={() => scrollTo('trust')}>الثقة والخصوصية</button>
          </nav>

          <button type="button" className="ql-btn ql-btn-gold ql-btn-sm" onClick={() => onEnterApp({ kind: 'dashboard' })}>
            دخول المنصة
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main>
        <section className="ql-hero" aria-labelledby="ql-hero-title">
          <div className="ql-hero-grid" aria-hidden="true" />
          <div className="ql-container ql-hero-inner">
            <div className="ql-hero-copy">
              <span className="ql-eyebrow">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                منصة التقاضي الذكي السعودية
              </span>
              <h1 id="ql-hero-title" className="ql-hero-title">
                قضيتك، مرتّبة
                <span className="ql-hero-accent">ومسنودة بالمصادر الرسمية.</span>
              </h1>
              <p className="ql-hero-lead">
                احكِ ما حدث بلغتك وارفع مستنداتك. QADA يرتب الوقائع، ويحدد المحكمة والمسار، ويبني المذكرة مع مصادرها، ثم يتركك تراجع قبل أي تقديم.
              </p>
              <div className="ql-hero-actions">
                <button type="button" className="ql-btn ql-btn-gold" onClick={() => onEnterApp({ kind: 'dashboard' })}>
                  ابدأ قضيتك
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="ql-btn ql-btn-glass"
                  onClick={() => onEnterApp({ kind: 'assistant', prefill: 'عندي حكم أو قرار وأبغى أعرف وش أقدر أسوي عليه. ابدأ بالسؤال عن نوع القرار وتاريخه وما الذي أريده.' })}
                >
                  <Gavel className="h-4 w-4" aria-hidden="true" />
                  عندي حكم أو قرار
                </button>
              </div>
              <ul className="ql-hero-proof">
                <li><CheckCircle2 className="h-4 w-4" aria-hidden="true" />مصادر رسمية فقط</li>
                <li><CheckCircle2 className="h-4 w-4" aria-hidden="true" />تحقق قبل كل جواب</li>
                <li><CheckCircle2 className="h-4 w-4" aria-hidden="true" />مساحتك مشفرة ومعزولة</li>
              </ul>
            </div>

            <figure className="ql-preview" aria-label="مثال توضيحي لملف قضية داخل المنصة">
              <div className="ql-preview-bar" aria-hidden="true">
                <span /><span /><span />
                <em>ملف القضية</em>
              </div>
              <div className="ql-preview-body">
                <div className="ql-preview-head">
                  <span className="ql-preview-icon" aria-hidden="true"><Landmark className="h-4 w-4" /></span>
                  <div>
                    <div className="ql-preview-title">قرار نقل وظيفي</div>
                    <div className="ql-preview-meta">مثال توضيحي</div>
                  </div>
                  <span className="ql-chip ql-chip-green">المسار محدد</span>
                </div>
                <dl className="ql-preview-facts">
                  <div><dt>المحكمة</dt><dd>المحكمة الإدارية</dd></div>
                  <div><dt>المرحلة</dt><dd>قبل التظلم</dd></div>
                  <div><dt>الناقص</dt><dd>تاريخ التبليغ</dd></div>
                </dl>
                <ol className="ql-preview-steps">
                  <li data-state="done">ترتيب الوقائع</li>
                  <li data-state="done">تحديد الاختصاص</li>
                  <li data-state="active">التحقق من المصادر</li>
                  <li>صياغة التظلم</li>
                </ol>
                <div className="ql-preview-source">
                  <BookOpenCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>نظام ديوان المظالم — المادة 13</span>
                  <span className="ql-chip">هيئة الخبراء</span>
                </div>
              </div>
            </figure>
          </div>
        </section>

        <section className="ql-section ql-quick" aria-labelledby="ql-quick-title">
          <div className="ql-container">
            <h2 id="ql-quick-title" className="ql-kicker">ابدأ من حيث أنت</h2>
            <div className="ql-quick-grid">
              {QUICK_STARTS.map(({ icon: Icon, title, text, intent }) => (
                <button key={title} type="button" className="ql-quick-card" onClick={() => onEnterApp(intent)}>
                  <span className="ql-quick-icon" aria-hidden="true"><Icon className="h-5 w-5" strokeWidth={1.8} /></span>
                  <span className="ql-quick-title">{title}</span>
                  <span className="ql-quick-text">{text}</span>
                  <ArrowLeft className="ql-quick-arrow h-4 w-4" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="platform" className="ql-section" aria-labelledby="ql-platform-title">
          <div className="ql-container">
            <div className="ql-section-head">
              <span className="ql-kicker">المنصة</span>
              <h2 id="ql-platform-title" className="ql-section-title">كل ما تحتاجه القضية، في مكان واحد.</h2>
              <p className="ql-section-lead">من أول سطر في القصة إلى مسودة جاهزة للمراجعة، بمنهج واحد: لا نتيجة بلا سند، ولا سند بلا مصدر رسمي.</p>
            </div>

            <div className="ql-bento">
              <BentoTile className="ql-tile-hero" icon={<Scale className="h-5 w-5" />} title="ثلاثة مسارات قضائية" text="لكل محكمة مساحة عمل بخدماتها ونماذجها ومتطلباتها.">
                <ul className="ql-courts">
                  <li><span>المحاكم الإدارية</span><em>دعوى · اعتراض · مذكرة دفوع</em></li>
                  <li><span>المحاكم العامة</span><em>لائحة حقوقية · استئناف · مذكرة جوابية</em></li>
                  <li><span>المحاكم الجزائية</span><em>مذكرة دفاع · اعتراض · سلامة الإجراءات</em></li>
                </ul>
              </BentoTile>
              <BentoTile icon={<BookOpenCheck className="h-5 w-5" />} title="مصادر رسمية فقط" text="الإحالات ترجع إلى هيئة الخبراء وجريدة أم القرى، وما لم يُتحقق منه يُعلَّم بوضوح." />
              <BentoTile icon={<ShieldCheck className="h-5 w-5" />} title="بوابة تحقق قبل كل جواب" text="فحص المصدر والسريان والتعديلات، ثم القاضي الافتراضي قبل الاعتماد." />
              <BentoTile icon={<Gavel className="h-5 w-5" />} title="صياغة بحُجّة وبيان" text="دعوى أو اعتراض أو مذكرة، مبنية على الوقائع والسند، وتبقى مسودة لمراجعتك." />
              <BentoTile icon={<FolderOpen className="h-5 w-5" />} title="ملف قضية موحّد" text="الأحكام والمرفقات والمراحل في تسلسل زمني واحد." />
            </div>
          </div>
        </section>

        <section id="how" className="ql-section ql-how" aria-label="كيف تعمل المنصة">
          <div className="ql-container ql-how-inner">
            <AgentFlowDiagram />
          </div>
        </section>

        <section id="trust" className="ql-section" aria-labelledby="ql-trust-title">
          <div className="ql-container">
            <div className="ql-section-head">
              <span className="ql-kicker">الثقة والخصوصية</span>
              <h2 id="ql-trust-title" className="ql-section-title">مبنية لتُراجَع، لا لتُصدَّق على عجل.</h2>
            </div>
            <div className="ql-stats">
              <div className="ql-stat">
                <span className="ql-stat-value">{VERIFIED_SYSTEMS}</span>
                <span className="ql-stat-label">{arabicCountNoun(VERIFIED_SYSTEMS, { one: 'نظام رسمي مفهرس', two: 'نظامان رسميان مفهرسان', plural: 'أنظمة رسمية مفهرسة', accusative: 'نظاماً رسمياً مفهرساً', singular: 'نظام رسمي مفهرس' })}</span>
              </div>
              <div className="ql-stat">
                <span className="ql-stat-value">{VERIFIED_REGULATIONS}</span>
                <span className="ql-stat-label">{arabicCountNoun(VERIFIED_REGULATIONS, { one: 'لائحة موثقة', two: 'لائحتان موثقتان', plural: 'لوائح موثقة', accusative: 'لائحة موثقة', singular: 'لائحة موثقة' })}</span>
              </div>
              <div className="ql-stat">
                <span className="ql-stat-value">3</span>
                <span className="ql-stat-label">مسارات قضائية</span>
              </div>
            </div>
            <ul className="ql-trust-list">
              <li><LockKeyhole className="h-4 w-4" aria-hidden="true" />القضايا والحسابات مشفرة على الخادم، وكل مستخدم في مساحة معزولة.</li>
              <li><ShieldCheck className="h-4 w-4" aria-hidden="true" />لا اقتباس حرفياً لمادة قبل مطابقتها بالمصدر الرسمي.</li>
              <li><CheckCircle2 className="h-4 w-4" aria-hidden="true" />كل مخرج مسودة لمراجعتك، وليس فتوى ولا حكماً نهائياً.</li>
            </ul>
          </div>
        </section>

        <section className="ql-section" aria-labelledby="ql-cta-title">
          <div className="ql-container">
            <div className="ql-cta">
              <div>
                <h2 id="ql-cta-title" className="ql-cta-title">جاهز تبدأ قضيتك؟</h2>
                <p className="ql-cta-text">ابدأ بالقصة كما هي، ونسألك فقط عن الناقص.</p>
              </div>
              <button type="button" className="ql-btn ql-btn-gold" onClick={() => onEnterApp({ kind: 'dashboard' })}>
                ابدأ الآن
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="ql-footer">
        <div className="ql-container ql-footer-inner">
          <span className="ql-brand-name">أصول القضاء</span>
          <p>QADA يساعدك في فهم القضية وترتيبها والبحث والصياغة. قبل أي تقديم رسمي، راجع المخرج النهائي والمستندات المرتبطة به.</p>
        </div>
      </footer>
    </div>
  );
}
