import { useState, useMemo } from 'react';
import {
  Scale,
  Search,
  Plus,
  Gavel,
  Shield,
  FileText,
  User,
  Building,
  Calendar,
  ChevronRight,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import {
  JudgmentRecord,
  CourtType,
  CaseStageRecord,
  CaseStageLevel,
  PartyDialogue,
  UserSession,
} from '../types';

interface JudgmentRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: JudgmentRecord[];
  currentUser?: UserSession | null;
  onSaveRecord: (record: JudgmentRecord) => void;
  onDeleteRecord: (recordId: string) => void;
  onOpenPleadingStudio: (record: JudgmentRecord) => void;
  onSendToChatPrompt: (promptText: string) => void;
}

export function JudgmentRepositoryModal({
  isOpen,
  onClose,
  records,
  currentUser,
  onSaveRecord,
  onDeleteRecord,
  onOpenPleadingStudio,
  onSendToChatPrompt,
}: JudgmentRepositoryModalProps) {
  const isAdminView = currentUser?.role === 'admin';

  // Sanitize records based on role - strictly hide admin record from citizens
  const authorizedRecords = useMemo(() => {
    if (isAdminView) {
      return records;
    }
    return records.filter(
      (rec) => rec.nationalId !== 'الهوية الوطنية' && rec.id !== '<rec-3751></rec-3751>-military'
    );
  }, [records, isAdminView]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourtFilter, setSelectedCourtFilter] = useState<string>('all');
  const [selectedRecordId, setSelectedRecordId] = useState<string>(
    authorizedRecords[0]?.id || ''
  );
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'chronology' | 'dialogues' | 'precedents'>('overview');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Record Form State
  const [newPersonName, setNewPersonName] = useState('');
  const [newNationalId, setNewNationalId] = useState('');
  const [newAgencyName, setNewAgencyName] = useState('');
  const [newCourtType, setNewCourtType] = useState<CourtType>('المحكمة الإدارية');
  const [newCircuitName, setNewCircuitName] = useState('الدائرة الإدارية الأولى');
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [newJudgmentNumber, setNewJudgmentNumber] = useState('');
  const [newJudgmentDate, setNewJudgmentDate] = useState('');
  const [newJudgmentType, setNewJudgmentType] = useState<JudgmentRecord['judgmentType']>('إلغاء قرار إداري');
  const [newFacts, setNewFacts] = useState('');
  const [newRulingReasons, setNewRulingReasons] = useState('');
  const [newRulingOperative, setNewRulingOperative] = useState('');
  const [newRegulationsInput, setNewRegulationsInput] = useState('');
  const [newFatalFlawsInput, setNewFatalFlawsInput] = useState('');
  const [newRebuttalsInput, setNewRebuttalsInput] = useState('');

  // Chronology sub-stage form state for the selected record
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageLevel, setNewStageLevel] = useState<CaseStageLevel>('محكمة الاستئناف الإدارية');
  const [newStageCourt, setNewStageCourt] = useState<CourtType>('محكمة الاستئناف الإدارية');
  const [newStageRuling, setNewStageRuling] = useState('');
  const [newStageReasons, setNewStageReasons] = useState('');
  const [newStageFacts, setNewStageFacts] = useState('');
  const [newStageDate, setNewStageDate] = useState('');

  // Filtered records
  const filteredRecords = useMemo(() => {
    return authorizedRecords.filter((rec) => {
      const matchesSearch =
        rec.personName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.nationalId.includes(searchQuery) ||
        rec.agencyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.caseNumber.includes(searchQuery) ||
        rec.judgmentNumber.includes(searchQuery);

      const matchesCourt =
        selectedCourtFilter === 'all' || rec.courtType === selectedCourtFilter;

      return matchesSearch && matchesCourt;
    });
  }, [authorizedRecords, searchQuery, selectedCourtFilter]);

  const activeRecord =
    authorizedRecords.find((r) => r.id === selectedRecordId) || filteredRecords[0] || authorizedRecords[0];

  if (!isOpen) return null;

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim() || !newNationalId.trim()) {
      alert('يرجى كتابة اسم الشخص ورقم هويته الوطنية لحفظ السجل.');
      return;
    }

    const regulations = newRegulationsInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const fatalFlaws = newFatalFlawsInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const rebuttals = newRebuttalsInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const newRecord: JudgmentRecord = {
      id: `rec-${newNationalId.replace(/\s+/g, '')}-${Date.now()}`,
      personName: newPersonName.trim(),
      nationalId: newNationalId.trim(),
      agencyName: newAgencyName.trim() || 'الجهة الإدارية المدعى عليها',
      courtType: newCourtType,
      circuitName: newCircuitName.trim() || 'الدائرة القضائية المختصة',
      caseNumber: newCaseNumber.trim() || 'قيد الإيداع',
      judgmentNumber: newJudgmentNumber.trim() || 'ص/٠١',
      judgmentDate: newJudgmentDate.trim() || '١٤٤٥ هـ',
      judgmentType: newJudgmentType,
      facts: newFacts.trim() || 'وقائع الدعوى وفق صحيفة الدعوى ومذكرات الأطراف.',
      rulingReasons: newRulingReasons.trim() || 'أسباب ومنطوق الحكم.',
      rulingOperative: newRulingOperative.trim() || 'منطوق الحكم الصادر في النزاع.',
      dialoguesAndExchanges: [
        {
          id: 'dlg-1',
          speaker: 'المدعي (صاحب الشأن)',
          statement: newFacts.trim().slice(0, 150) || 'طرح الدعوى والمطالبة بإلغاء القرار والتعويض.',
          legalFlawIdentified: 'ضرورة توثيق تاريخ العلم اليقيني لضمان سلامة الميعاد الشكلي.',
          rebuttalArg: 'الاستناد لنصوص المواد والقرارات التنظيمية الآمرة الصادرة لصالح الموظف.',
        },
        {
          id: 'dlg-2',
          speaker: 'المدعى عليه (ممثل الجهة الحكومية)',
          statement: 'تتمسك الجهة بسلطتها التقديرية وتنظيم الصرف وفق اللائحة والاعتمادات المالية.',
          legalFlawIdentified: 'تمترس باطل بالسلطة التقديرية يخالف النصوص الملزمة للمشروعية.',
          rebuttalArg: 'سلطة الإدارة مقيدة بعدم المساس بالحقوق والامتناع مشوب بعيب السبب والانحراف بالسلطة.',
        },
        {
          id: 'dlg-3',
          speaker: 'القاضي / ناظر القضية',
          statement: 'سؤال الأطراف عن استيفاء ميعاد التظلم وما إذا كان القرار قد تحصن.',
          legalFlawIdentified: 'فحص ميعاد المادة 8 بدقة تفادياً للسقوط.',
          rebuttalArg: 'تقديم ما يثبت قيد التظلم ورفع الدعوى داخل الآجال المقررة نظاماً.',
        },
      ],
      applicableRegulations: regulations.length > 0 ? regulations : [
        'نظام المرافعات أمام ديوان المظالم (المادتان 8 و43)',
        'نظام ديوان المظالم الصادر بالمرسوم الملكي (م/78)',
        'قواعد الخدمة المدنية واللائحة التنفيذية للموارد البشرية',
      ],
      courtPrecedents: [
        'المبادئ القضائية المستقرة للمحكمة الإدارية العليا في تقييد سلطة الإدارة التقديرية بمبدأ المشروعية.',
      ],
      fatalFlawsFound: fatalFlaws.length > 0 ? fatalFlaws : [
        'تمسك الإدارة بسلطة تقديرية غير منضبطة في مواجهة نصوص ملزمة.',
        'إغفال مناقشة المستندات الدالة على قيام سبب الاستحقاق الفعلي.',
      ],
      strongestRebuttals: rebuttals.length > 0 ? rebuttals : [
        'الدفع بثبوت مناط الاستحقاق الفعلي ومخالفة الجهة للمشروعية وعيب السبب.',
      ],
      caseChronology: [
        {
          id: `stage-init-${Date.now()}`,
          stageLevel: 'بداية المعاملة والتظلم الوجوبي (مادة 8)',
          courtName: 'الجهة الإدارية (التظلم الإداري)',
          filingDate: newJudgmentDate.trim() || '١٤٤٥ هـ',
          rulingSummary: 'إيداع التظلم الإداري استيفاءً للقيد الشكلي للمادة (8).',
          rulingReasons: 'التظلم المباشر للوزير أو رئيس الجهة.',
          status: 'مكتمل',
          deadlinesNote: 'مهلة الـ 60 يوماً للتظلم والـ 60 يوماً لرفع الدعوى.',
        },
        {
          id: `stage-court-${Date.now()}`,
          stageLevel:
            newCourtType === 'المحكمة الإدارية'
              ? 'المحكمة الإدارية (الدرجة الأولى)'
              : newCourtType === 'محكمة الاستئناف الإدارية'
              ? 'محكمة الاستئناف الإدارية'
              : 'المحكمة الإدارية العليا (النقض)',
          courtName: newCourtType,
          circuitNumber: newCircuitName,
          caseNumber: newCaseNumber,
          rulingDate: newJudgmentDate,
          rulingSummary: newRulingOperative || 'منطوق الحكم',
          rulingReasons: newRulingReasons || 'أسباب الحكم',
          factsSummary: newFacts || 'وقائع النزاع',
          status: 'قيد النظر',
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onSaveRecord(newRecord);
    setSelectedRecordId(newRecord.id);
    setIsAddingNew(false);

    // Reset Form
    setNewPersonName('');
    setNewNationalId('');
    setNewAgencyName('');
    setNewCaseNumber('');
    setNewJudgmentNumber('');
    setNewJudgmentDate('');
    setNewFacts('');
    setNewRulingReasons('');
    setNewRulingOperative('');
    setNewRegulationsInput('');
    setNewFatalFlawsInput('');
    setNewRebuttalsInput('');
  };

  const handleAddChronologyStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecord) return;

    const newStage: CaseStageRecord = {
      id: `stage-${Date.now()}`,
      stageLevel: newStageLevel,
      courtName: newStageCourt,
      rulingDate: newStageDate || '١٤٤٥ هـ',
      rulingSummary: newStageRuling.trim() || 'حكم صادر في هذه المرحلة القضائية.',
      rulingReasons: newStageReasons.trim() || 'أسباب ومنطوق الحكم.',
      factsSummary: newStageFacts.trim() || 'وقائع المرحلة القضائية.',
      status: 'مكتمل',
      deadlinesNote: 'التحقق من مواعيد الطعن (30 يوماً للاستئناف والنقض).',
    };

    const updatedRecord: JudgmentRecord = {
      ...activeRecord,
      caseChronology: [...activeRecord.caseChronology, newStage],
      updatedAt: Date.now(),
    };

    onSaveRecord(updatedRecord);
    setIsAddingStage(false);
    setNewStageRuling('');
    setNewStageReasons('');
    setNewStageFacts('');
    setNewStageDate('');
  };

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div
        id="judgment-repository-modal"
        className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-7xl w-full shadow-2xl overflow-hidden flex flex-col text-neutral-100 max-h-[94vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base md:text-lg text-amber-200">
                  سجل الأحكام القضائية والتدرج القضائي برقم الهوية
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {authorizedRecords.length} صكوك محفوظة
                </span>
                {isAdminView && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    عرض كل مرفوعات المستخدمين
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                {isAdminView
                  ? 'وضع المسؤول: عرض جميع مرفوعات المستخدمين، مع متابعة تسلسل المعاملات والأخطاء والحجج لكل قضية.'
                  : 'حفظ تفاصيل الحكم بالهوية، تسلسل المعاملة عبر المحاكم الثلاث، رصد الأخطاء، وحجج الوكيل الصاعقة'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddingNew(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة صك حكم جديد</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Layout: Master-Detail */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: List of People & Records (4 cols) */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-l border-neutral-800 flex flex-col bg-neutral-950/60 max-h-[35vh] lg:max-h-none overflow-hidden">
            {/* Search and Filters */}
            <div className="p-3 border-b border-neutral-800/80 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="ابحث برقم الهوية (مثلاً 1082...) أو اسم الشخص أو الجهة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-9 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                <button
                  onClick={() => setSelectedCourtFilter('all')}
                  className={`px-2 py-1 rounded-lg border whitespace-nowrap ${
                    selectedCourtFilter === 'all'
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 font-bold'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                >
                  الكل ({authorizedRecords.length})
                </button>
                <button
                  onClick={() => setSelectedCourtFilter('المحكمة الإدارية')}
                  className={`px-2 py-1 rounded-lg border whitespace-nowrap ${
                    selectedCourtFilter === 'المحكمة الإدارية'
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 font-bold'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                >
                  الابتدائية
                </button>
                <button
                  onClick={() => setSelectedCourtFilter('محكمة الاستئناف الإدارية')}
                  className={`px-2 py-1 rounded-lg border whitespace-nowrap ${
                    selectedCourtFilter === 'محكمة الاستئناف الإدارية'
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 font-bold'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                >
                  الاستئناف
                </button>
                <button
                  onClick={() => setSelectedCourtFilter('المحكمة الإدارية العليا')}
                  className={`px-2 py-1 rounded-lg border whitespace-nowrap ${
                    selectedCourtFilter === 'المحكمة الإدارية العليا'
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 font-bold'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                >
                  الإدارية العليا
                </button>
              </div>
            </div>

            {/* List */}
            <div className={`flex-1 overflow-y-auto p-2 ${isAdminView ? 'grid grid-cols-1 xl:grid-cols-2 gap-2' : 'space-y-2'}`}>
              {filteredRecords.length === 0 ? (
                <div className="text-center py-10 text-neutral-500 text-xs">
                  لا توجد صكوك مطابقة لبحثك.
                </div>
              ) : (
                filteredRecords.map((rec) => {
                  const isSelected = rec.id === activeRecord?.id;
                  return (
                    <div
                      key={rec.id}
                      onClick={() => {
                        setSelectedRecordId(rec.id);
                        setIsAddingNew(false);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                          : 'bg-neutral-900/60 border-neutral-800/80 hover:bg-neutral-850 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <div className="font-bold text-neutral-100 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{rec.personName}</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded-sm font-mono text-[10px] bg-neutral-800 text-amber-400 border border-neutral-700">
                          {rec.nationalId}
                        </span>
                      </div>

                      <div className="text-[11px] text-neutral-400 flex items-center gap-1 mb-1.5 truncate">
                        <Building className="w-3 h-3 text-neutral-500 shrink-0" />
                        <span className="truncate">{rec.agencyName}</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px]">
                        <span
                          className={`px-2 py-0.5 rounded-md font-medium ${
                            rec.courtType === 'المحكمة الإدارية العليا'
                              ? 'bg-purple-950/40 text-purple-300 border border-purple-800/40'
                              : rec.courtType === 'محكمة الاستئناف الإدارية'
                              ? 'bg-blue-950/40 text-blue-300 border border-blue-800/40'
                              : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                          }`}
                        >
                          {rec.courtType}
                        </span>
                        <span className="text-neutral-500 font-mono">
                          {rec.judgmentDate}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed View / New Form (8 cols) */}
          <div className="lg:col-span-8 flex flex-col overflow-y-auto bg-neutral-900/40 p-4 md:p-6">
            {isAddingNew ? (
              /* Add New Judgment Form */
              <form onSubmit={handleCreateRecord} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-amber-400" />
                    <h4 className="font-bold text-sm text-neutral-100">
                      إدراج صك حكم ومعاملة جديدة مقيدة برقم الهوية
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      اسم الشخص (صاحب الشأن / الموكل)*
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="مثال: فلان بن فلان الفلاني"
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      رقم الهوية الوطنية / الإقامة*
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="مثال: 1082918231"
                      value={newNationalId}
                      onChange={(e) => setNewNationalId(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 focus:outline-hidden focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      نوع المحكمة الصادر منها الحكم*
                    </label>
                    <select
                      value={newCourtType}
                      onChange={(e) => setNewCourtType(e.target.value as CourtType)}
                      className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="المحكمة الإدارية">المحكمة الإدارية (الدرجة الأولى)</option>
                      <option value="محكمة الاستئناف الإدارية">محكمة الاستئناف الإدارية</option>
                      <option value="المحكمة الإدارية العليا">المحكمة الإدارية العليا (النقض)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      اسم الجهة الحكومية المدعى عليها*
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: وزارة التعليم / أمانة منطقة الرياض"
                      value={newAgencyName}
                      onChange={(e) => setNewAgencyName(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      رقم القضية ورقم صك الحكم
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="رقم القضية: ٤٤١٠/ق"
                        value={newCaseNumber}
                        onChange={(e) => setNewCaseNumber(e.target.value)}
                        className="w-full p-2 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 font-mono"
                      />
                      <input
                        type="text"
                        placeholder="صك الحكم: ص/٨٩/٤٤"
                        value={newJudgmentNumber}
                        onChange={(e) => setNewJudgmentNumber(e.target.value)}
                        className="w-full p-2 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      تاريخ صدور الحكم
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: ١٤٤٥/٠٤/١٨ هـ"
                      value={newJudgmentDate}
                      onChange={(e) => setNewJudgmentDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100"
                    />
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      وقائع القضية (الأحداث التي جرت)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="اكتب وقائع القضية والقرار الصادر ضد الموظف وموقف الجهة..."
                      value={newFacts}
                      onChange={(e) => setNewFacts(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      مسببات الحكم وحيثيات الدائرة
                    </label>
                    <textarea
                      rows={3}
                      placeholder="الأسباب التي بنت عليها المحكمة حكمها..."
                      value={newRulingReasons}
                      onChange={(e) => setNewRulingReasons(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1 font-medium">
                      منطوق الحكم الحاسم
                    </label>
                    <textarea
                      rows={2}
                      placeholder="ما حكمت به المحكمة نصاً (إلغاء القرار / إلزام بالصرف / رفض / نقض)..."
                      value={newRulingOperative}
                      onChange={(e) => setNewRulingOperative(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-neutral-400 mb-1 font-medium">
                        المواد والأنظمة المستند عليها (سطر لكل مادة)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="المادة 8 من نظام المرافعات&#10;نظام الخدمة المدنية"
                        value={newRegulationsInput}
                        onChange={(e) => setNewRegulationsInput(e.target.value)}
                        className="w-full p-2 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1 font-medium">
                        الأخطاء المرصودة في قرار الخصم أو الحكم
                      </label>
                      <textarea
                        rows={3}
                        placeholder="عيب السبب وانعدام المبرر&#10;مخالفة الميعاد الشكلي"
                        value={newFatalFlawsInput}
                        onChange={(e) => setNewFatalFlawsInput(e.target.value)}
                        className="w-full p-2 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1 font-medium">
                        أقوى الحجج والبراهين للرد والترافع
                      </label>
                      <textarea
                        rows={3}
                        placeholder="الدفع بمبدأ المشروعية&#10;تقييد السلطة التقديرية"
                        value={newRebuttalsInput}
                        onChange={(e) => setNewRebuttalsInput(e.target.value)}
                        className="w-full p-2 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white text-xs"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md"
                  >
                    حفظ السجل القضائي
                  </button>
                </div>
              </form>
            ) : activeRecord ? (
              /* Display Active Record */
              <div className="space-y-5">
                {/* Person Header Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-neutral-950 to-neutral-900 border border-neutral-800 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                        <h4 className="font-extrabold text-base md:text-lg text-amber-200">
                          {activeRecord.personName}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          هوية: {activeRecord.nationalId}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                        <span>المدعى عليها: <strong className="text-neutral-200">{activeRecord.agencyName}</strong></span>
                        <span>•</span>
                        <span>نوع الدعوى: <strong className="text-amber-400/90">{activeRecord.judgmentType}</strong></span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onOpenPleadingStudio(activeRecord)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                        title="توليد لوائح الترافع (استئناف، نقض، دعوى، التماس) مجهزة بأقوى المواد"
                      >
                        <FileText className="w-4 h-4" />
                        <span>استوديو الترافع وصياغة اللوائح</span>
                      </button>

                      <button
                        onClick={() => {
                          const p = `أنا الوكيل الشرعي عن الموكل ${activeRecord.personName} (سجل مدني: ${activeRecord.nationalId}) في مواجهة ${activeRecord.agencyName}.\nنوع المحكمة: ${activeRecord.courtType}.\nالوقائع: ${activeRecord.facts}\nالردود والأخطاء: ${activeRecord.fatalFlawsFound.join('، ')}.\nالمطلوب: توليد رد قاطع ومحكم يفحم ممثل الجهة ويظهر للمحكمة تمكني التام من القضية والمواد النظامية.`;
                          onSendToChatPrompt(p);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>محاكاة مرافعة حازمة</span>
                      </button>

                      <button
                        onClick={() => onDeleteRecord(activeRecord.id)}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 rounded-lg hover:bg-neutral-800 transition-colors"
                        title="حذف هذا الصك من السجل"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-neutral-800/80 text-[11px]">
                    <div className="bg-neutral-900/60 p-2 rounded-xl border border-neutral-800">
                      <span className="text-neutral-500 block">المحكمة المصدرة</span>
                      <span className="font-bold text-amber-300">{activeRecord.courtType}</span>
                    </div>
                    <div className="bg-neutral-900/60 p-2 rounded-xl border border-neutral-800">
                      <span className="text-neutral-500 block">رقم وتاريخ الحكم</span>
                      <span className="font-mono text-neutral-200">{activeRecord.judgmentNumber} ({activeRecord.judgmentDate})</span>
                    </div>
                    <div className="bg-neutral-900/60 p-2 rounded-xl border border-neutral-800">
                      <span className="text-neutral-500 block">الدائرة والقضية</span>
                      <span className="text-neutral-200">{activeRecord.circuitName} ({activeRecord.caseNumber})</span>
                    </div>
                    <div className="bg-neutral-900/60 p-2 rounded-xl border border-neutral-800">
                      <span className="text-neutral-500 block">مراحل المعاملة المسجلة</span>
                      <span className="font-bold text-emerald-400">{activeRecord.caseChronology.length} مراحل قضائية</span>
                    </div>
                  </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs font-medium">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-3 py-1.5 rounded-xl transition-colors ${
                      activeTab === 'overview'
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    تفاصيل الصك والوقائع والمسببات
                  </button>
                  <button
                    onClick={() => setActiveTab('chronology')}
                    className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
                      activeTab === 'chronology'
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>تدرج المعاملة عبر المحاكم (المسار الكامل)</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-800 text-amber-300">
                      {activeRecord.caseChronology.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('dialogues')}
                    className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
                      activeTab === 'dialogues'
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>الردود والمناظرة بين الشخص والجهة والقاضي</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('precedents')}
                    className={`px-3 py-1.5 rounded-xl transition-colors ${
                      activeTab === 'precedents'
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    الأنظمة والسوابق والأوامر الملكية
                  </button>
                </div>

                {/* Tab 1: Overview */}
                {activeTab === 'overview' && (
                  <div className="space-y-4 text-xs">
                    {/* Operative Ruling Box */}
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <div className="flex items-center justify-between mb-1.5 font-bold text-amber-300">
                        <span className="flex items-center gap-1.5">
                          <Gavel className="w-4 h-4" />
                          منطوق الحكم الحاسم الصادر في النزاع:
                        </span>
                        <button
                          onClick={() => copyText(activeRecord.rulingOperative, 'operative')}
                          className="text-neutral-400 hover:text-white flex items-center gap-1 text-[11px]"
                        >
                          {copiedId === 'operative' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>نسخ المنطوق</span>
                        </button>
                      </div>
                      <p className="text-neutral-100 font-medium leading-relaxed whitespace-pre-wrap">
                        {activeRecord.rulingOperative}
                      </p>
                    </div>

                    {/* Facts & Ruling Reasons */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800">
                        <div className="font-bold text-neutral-300 mb-2 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-neutral-400" />
                          <span>وقائع القضية (الأحداث ومسار النزاع):</span>
                        </div>
                        <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap">
                          {activeRecord.facts}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800">
                        <div className="font-bold text-neutral-300 mb-2 flex items-center gap-1.5">
                          <Scale className="w-4 h-4 text-amber-400" />
                          <span>مسببات الحكم وحيثيات الدائرة:</span>
                        </div>
                        <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap">
                          {activeRecord.rulingReasons}
                        </p>
                      </div>
                    </div>

                    {/* Flaws and Rebuttals */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40">
                        <div className="font-bold text-rose-300 mb-2 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span>الأخطاء والعوار المرصود في موقف الجهة / الحكم:</span>
                        </div>
                        <ul className="space-y-1.5 text-neutral-300 list-disc list-inside">
                          {activeRecord.fatalFlawsFound.map((flaw, i) => (
                            <li key={i} className="leading-relaxed">
                              {flaw}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
                        <div className="font-bold text-emerald-300 mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>أقوى الحجج والبراهين الرادعة لدعم الوكيل:</span>
                        </div>
                        <ul className="space-y-1.5 text-neutral-300 list-disc list-inside">
                          {activeRecord.strongestRebuttals.map((reb, i) => (
                            <li key={i} className="leading-relaxed">
                              {reb}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Chronology (تدرج المعاملة من بدايتها ثم الإدارية ثم الاستئناف...) */}
                {activeTab === 'chronology' && (
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="text-neutral-400">
                        تتبع المعاملة القضائية خطوة بخطوة من التظلم الإداري الأولي حتى المحكمة الإدارية العليا:
                      </p>
                      <button
                        onClick={() => setIsAddingStage(!isAddingStage)}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة مرحلة قضائية تالية</span>
                      </button>
                    </div>

                    {/* New Stage Form */}
                    {isAddingStage && (
                      <form onSubmit={handleAddChronologyStage} className="p-4 rounded-xl bg-neutral-950 border border-neutral-700 space-y-3">
                        <h5 className="font-bold text-amber-300 text-xs">
                          إدراج مرحلة جديدة في مسار المعاملة:
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-neutral-400 mb-1">المرحلة القضائية</label>
                            <select
                              value={newStageLevel}
                              onChange={(e) => setNewStageLevel(e.target.value as CaseStageLevel)}
                              className="w-full p-2 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100"
                            >
                              <option value="بداية المعاملة والتظلم الوجوبي (مادة 8)">بداية المعاملة والتظلم الوجوبي (مادة 8)</option>
                              <option value="المحكمة الإدارية (الدرجة الأولى)">المحكمة الإدارية (الدرجة الأولى)</option>
                              <option value="محكمة الاستئناف الإدارية">محكمة الاستئناف الإدارية</option>
                              <option value="المحكمة الإدارية العليا (النقض)">المحكمة الإدارية العليا (النقض)</option>
                              <option value="التماس إعادة النظر">التماس إعادة النظر</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-neutral-400 mb-1">اسم المحكمة أو الجهة</label>
                            <select
                              value={newStageCourt}
                              onChange={(e) => setNewStageCourt(e.target.value as CourtType)}
                              className="w-full p-2 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100"
                            >
                              <option value="المحكمة الإدارية">المحكمة الإدارية</option>
                              <option value="محكمة الاستئناف الإدارية">محكمة الاستئناف الإدارية</option>
                              <option value="المحكمة الإدارية العليا">المحكمة الإدارية العليا</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-neutral-400 mb-1">التاريخ</label>
                            <input
                              type="text"
                              placeholder="١٤٤٥ هـ"
                              value={newStageDate}
                              onChange={(e) => setNewStageDate(e.target.value)}
                              className="w-full p-2 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-neutral-400 mb-1">منطوق أو نتيجة المرحلة</label>
                          <input
                            type="text"
                            placeholder="مثال: نقض حكم أول درجة / رفض الدعوى / تأييد الحكم..."
                            value={newStageRuling}
                            onChange={(e) => setNewStageRuling(e.target.value)}
                            className="w-full p-2 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100"
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingStage(false)}
                            className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300"
                          >
                            إلغاء
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 rounded-lg bg-amber-500 text-neutral-950 font-bold"
                          >
                            حفظ المرحلة
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Timeline representation */}
                    <div className="relative pl-2 pr-4 border-r-2 border-amber-500/40 space-y-6">
                      {activeRecord.caseChronology.map((stage, idx) => (
                        <div key={stage.id} className="relative group">
                          {/* Dot marker */}
                          <div className="absolute -right-[23px] top-1.5 w-4 h-4 rounded-full bg-amber-500 border-4 border-neutral-900 group-hover:scale-125 transition-transform" />

                          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md font-bold text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                  المرحلة {idx + 1}: {stage.stageLevel}
                                </span>
                                <span className="text-neutral-400 font-semibold">
                                  {stage.courtName} {stage.circuitNumber ? `• ${stage.circuitNumber}` : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px]">
                                {stage.rulingDate && (
                                  <span className="font-mono text-neutral-400 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                                    {stage.rulingDate}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-emerald-400">
                                  {stage.status}
                                </span>
                              </div>
                            </div>

                            {stage.rulingSummary && (
                              <div>
                                <span className="text-neutral-500 block text-[11px] mb-0.5">منطوق أو نتيجة المرحلة:</span>
                                <p className="font-bold text-neutral-100 leading-relaxed">{stage.rulingSummary}</p>
                              </div>
                            )}

                            {stage.rulingReasons && (
                              <div className="text-neutral-300 leading-relaxed bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-850">
                                <span className="text-amber-400/80 block text-[10px] font-bold mb-0.5">حيثيات ومسببات الحكم في هذه المحكمة:</span>
                                {stage.rulingReasons}
                              </div>
                            )}

                            {stage.deadlinesNote && (
                              <div className="text-[11px] text-amber-300/90 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>{stage.deadlinesNote}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 3: Dialogues and Exchanges between Person, Agency, Judge */}
                {activeTab === 'dialogues' && (
                  <div className="space-y-4 text-xs">
                    <p className="text-neutral-400 leading-relaxed">
                      رصد الردود الدقيقة والمناظرة بين الموكل وممثل الجهة الحكومية وناظر القضية، مع كشف مواطن الخلل القانوني والرد الصاعق المجهز:
                    </p>

                    <div className="space-y-3">
                      {activeRecord.dialoguesAndExchanges.map((dialogue) => (
                        <div
                          key={dialogue.id}
                          className={`p-4 rounded-xl border ${
                            dialogue.speaker.includes('المدعي')
                              ? 'bg-amber-950/15 border-amber-500/30'
                              : dialogue.speaker.includes('المدعى عليه')
                              ? 'bg-rose-950/15 border-rose-800/40'
                              : 'bg-neutral-950 border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`font-bold px-2 py-0.5 rounded-md ${
                                dialogue.speaker.includes('المدعي')
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : dialogue.speaker.includes('المدعى عليه')
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-neutral-800 text-neutral-200'
                              }`}
                            >
                              {dialogue.speaker}
                            </span>
                          </div>

                          <div className="mb-2.5 p-2 rounded-lg bg-neutral-900/80 text-neutral-200 italic border border-neutral-800">
                            "{dialogue.statement}"
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-2 border-t border-neutral-800/80">
                            {dialogue.legalFlawIdentified && (
                              <div className="text-rose-300 flex items-start gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                <span>
                                  <strong>الخلل القانوني المرصود:</strong> {dialogue.legalFlawIdentified}
                                </span>
                              </div>
                            )}

                            {dialogue.rebuttalArg && (
                              <div className="text-emerald-300 flex items-start gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                <span>
                                  <strong>الرد الصاعق والحجة المقيدة:</strong> {dialogue.rebuttalArg}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 4: Precedents & Regulations */}
                {activeTab === 'precedents' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
                      <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Scale className="w-4 h-4" />
                        <span>الأنظمة والمواد المقيدة المستند عليها في هذا الحكم:</span>
                      </div>
                      <ul className="space-y-1.5 text-neutral-200 list-disc list-inside">
                        {activeRecord.applicableRegulations.map((reg, i) => (
                          <li key={i} className="leading-relaxed">
                            {reg}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
                      <div className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Gavel className="w-4 h-4 text-purple-400" />
                        <span>مبادئ وسوابق المحكمة الإدارية العليا الملزمة لدوائر الموضوع:</span>
                      </div>
                      <ul className="space-y-1.5 text-neutral-200 list-disc list-inside">
                        {activeRecord.courtPrecedents.map((prec, i) => (
                          <li key={i} className="leading-relaxed font-serif">
                            {prec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between text-xs text-neutral-400">
          <span>
            سجل قضائي إداري مقيد برقم الهوية • ديوان المظالم • المحاكم الإدارية والاستئناف والإدارية العليا
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
