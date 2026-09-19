import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Eye,
  Trash2,
  Download,
  Gavel,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { Attachment } from '../types';

interface PdfUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAttachments: (newAttachments: Attachment[]) => void;
  onAnalyzeImmediately?: (newAttachments: Attachment[], prompt?: string) => void;
}

export function PdfUploadModal({
  isOpen,
  onClose,
  onAddAttachments,
  onAnalyzeImmediately,
}: PdfUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<'صك حكم' | 'قرار إداري' | 'لائحة دعوى' | 'مستند خدمة عسكرية'>('صك حكم');
  const [customNote, setCustomNote] = useState('');

  if (!isOpen) return null;

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleProcessFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);

    const maxFileSize = 25 * 1024 * 1024; // 25MB
    const newItems: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxFileSize) {
        setUploadError(`الملف "${file.name}" أكبر من الحد الأقصى (25 ميجابايت).`);
        continue;
      }

      const isImage = file.type.startsWith('image/');
      try {
        const base64 = await readFileAsBase64(file);
        newItems.push({
          id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          type: file.type || (isImage ? 'image/jpeg' : 'application/pdf'),
          size: file.size,
          data: base64,
          previewUrl: isImage ? `data:${file.type || 'image/jpeg'};base64,${base64}` : undefined,
          isImage,
        });
      } catch (err) {
        console.error('Failed to read file', err);
        setUploadError(`تعذر قراءة الملف "${file.name}". يرجى المحاولة مرة أخرى.`);
      }
    }

    setSelectedFiles((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleConfirmAndAdd = () => {
    if (selectedFiles.length === 0) return;
    onAddAttachments(selectedFiles);
    onClose();
  };

  const handleConfirmAndAnalyze = () => {
    if (selectedFiles.length === 0) return;
    const promptText = `افحص المستند المرفق فحصاً قانونياً محايداً. تصنيف المستخدم المبدئي: [${documentType}]، لكنه ليس حكماً نهائياً على نوع المستند أو الاختصاص.

نفّذ بالترتيب:
1. حدّد نوع المستند الفعلي، الجهة المصدرة، الأطراف، التواريخ، الأرقام، والمنطوق أو الطلبات كما تظهر في المستند فقط.
2. حدّد الاختصاص المحتمل: إداري / عام / جزائي / تجاري / عمالي / أحوال شخصية، واذكر سبب التصنيف.
3. استخرج الوقائع والطلبات والدفوع والمرفقات والبيانات الناقصة أو الصفحات غير المقروءة.
4. بعد تحديد الموضوع فقط، اربط المستند بالأنظمة واللوائح ذات الصلة. لا تفترض المادة (8)، أو نظام خدمة الأفراد، أو أي مرسوم أو بدل بعينه ما لم يكن المستند متعلقاً به فعلاً.
5. عند ذكر أي مادة أو ميعاد أو مرسوم: اذكر اسم النظام ورقم المادة والمصدر الرسمي إن كان متاحاً. إذا لم يكن المصدر الرسمي متحققاً فقل: "التحقق المرجعي غير مكتمل" ولا تخمّن.
6. افصل بوضوح بين: "نص/بيانات مستخرجة من المستند" و"تحليل قانوني" و"نقاط تحتاج تحققاً رسمياً".
7. لا تقل إن المستند سليم أو جاهز للإيداع إذا تعذر قراءة المرفق أو تعذر التحقق من مراجعه.

${customNote.trim() ? `طلب المستخدم الخاص: ${customNote}` : ''}`;

    if (onAnalyzeImmediately) {
      onAnalyzeImmediately(selectedFiles, promptText);
    } else {
      onAddAttachments(selectedFiles);
    }
    onClose();
  };

  return (
    <div
      id="pdf-upload-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="pdf-upload-modal-container"
        className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden text-right flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-100 font-legal flex items-center gap-2">
                <span>رفع وتدقيق مستندات PDF وصكوك الأحكام</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ديوان المظالم
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                يدعم ملفات PDF، القرارات الإدارية، صكوك الأحكام، ونماذج التكليف (حتى 25MB)
              </p>
            </div>
          </div>
          <button
            id="close-pdf-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Document Type Selector */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-2">
              تصنيف المستند المرفوع:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { label: 'صك حكم قضائي', val: 'صك حكم' },
                { label: 'قرار إداري / تكليف', val: 'قرار إداري' },
                { label: 'لائحة دعوى / اعتراض', val: 'لائحة دعوى' },
                { label: 'سجل خدمة عسكرية', val: 'مستند خدمة عسكرية' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setDocumentType(item.val as any)}
                  className={`py-2 px-2.5 rounded-xl border text-center font-medium transition-colors cursor-pointer ${
                    documentType === item.val
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold'
                      : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drag & Drop Area */}
          <div
            id="pdf-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleProcessFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-amber-400 bg-amber-500/10 scale-[0.99]'
                : 'border-neutral-700 bg-neutral-950/50 hover:border-amber-500/50 hover:bg-neutral-950/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf,image/*,.doc,.docx"
              className="hidden"
              onChange={(e) => handleProcessFiles(e.target.files)}
            />
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
              <FileText className="w-7 h-7 text-amber-400" />
            </div>
            <p className="text-sm font-bold text-neutral-100 mb-1">
              اسحب وأفلت ملف الـ PDF هنا، أو انقر للاختيار من جهازك
            </p>
            <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
              يقرأ المستند أولاً ثم يحدد نوعه واختصاصه وموضوعه قبل اختيار الأنظمة والمواد ذات الصلة
            </p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>معالجة آمنة مشفرة متوافقة مع خصوصية القضايا</span>
            </div>
          </div>

          {/* Error Message */}
          {uploadError && (
            <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
                <span>الملفات الجاهزة للرفع والتحليل ({selectedFiles.length}):</span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-rose-400 hover:underline cursor-pointer"
                >
                  إفراغ القائمة
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-200 truncate">{file.name}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type.includes('pdf') ? 'مستند PDF' : 'صورة / وثيقة'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional Note / Focus */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1.5">
              ملاحظة خاصة أو استفسار محدد حول المستند (اختياري):
            </label>
            <textarea
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="مثال: ركز على تاريخ استلام القرار لمعرفة الميعاد النظامي، أو افحص صفحة التسبيب وبند الجمع بين البدلات..."
              className="w-full px-3 py-2 text-xs text-neutral-100 bg-neutral-950 border border-neutral-800 rounded-xl focus:border-amber-500 focus:outline-hidden resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-neutral-800 bg-neutral-950/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedFiles.length === 0}
              onClick={handleConfirmAndAdd}
              className="px-3.5 py-2 text-xs font-bold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
            >
              إرفاق بالمحادثة فقط
            </button>
            <button
              type="button"
              disabled={selectedFiles.length === 0}
              onClick={handleConfirmAndAnalyze}
              className="px-4 py-2 text-xs font-bold text-neutral-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Gavel className="w-4 h-4" />
              <span>رفع وبدء التدقيق القضائي الفوري</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
