import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, X, AlertCircle, FileCheck, Trash2, ShieldCheck } from 'lucide-react';
import { Attachment } from '../types';

interface PdfUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAttachments: (newAttachments: Attachment[]) => void;
  onAnalyzeImmediately?: (newAttachments: Attachment[], prompt?: string) => void;
}

export function PdfUploadModal({ isOpen, onClose, onAddAttachments, onAnalyzeImmediately }: PdfUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<'صك حكم' | 'قرار إداري' | 'لائحة دعوى' | 'مستند خدمة عسكرية'>('صك حكم');
  const [customNote, setCustomNote] = useState('');

  if (!isOpen) return null;

  const readFileAsBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleProcessFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const maxFileSize = 2.5 * 1024 * 1024;
    const newItems: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > maxFileSize) {
        setUploadError(`الملف "${file.name}" أكبر من الحد الآمن للإرسال المباشر (2.5 ميجابايت). استخدم ملفاً أصغر أو قسّمه قبل التحليل.`);
        continue;
      }
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isImage && !isPdf) {
        setUploadError(`الملف "${file.name}" غير مدعوم. ارفع PDF أو صورة فقط.`);
        continue;
      }
      try {
        const base64 = await readFileAsBase64(file);
        newItems.push({
          id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          type: isPdf ? 'application/pdf' : (file.type || 'image/jpeg'),
          size: file.size,
          data: base64,
          previewUrl: isImage ? `data:${file.type || 'image/jpeg'};base64,${base64}` : undefined,
          isImage,
        });
      } catch {
        setUploadError(`تعذر قراءة الملف "${file.name}". يرجى المحاولة مرة أخرى.`);
      }
    }
    setSelectedFiles(prev => {
      const combined = [...prev, ...newItems];
      const totalBytes = combined.reduce((sum, item) => sum + item.size, 0);
      if (totalBytes > 2.5 * 1024 * 1024) {
        setUploadError('إجمالي الملفات تجاوز 2.5 ميجابايت. احذف بعض الملفات أو حللها على دفعات.');
        return prev;
      }
      return combined;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmAndAdd = () => {
    if (!selectedFiles.length) return;
    onAddAttachments(selectedFiles);
    onClose();
  };

  const handleConfirmAndAnalyze = () => {
    if (!selectedFiles.length) return;
    const promptText = `افحص المستند المرفق فحصاً قانونياً محايداً. تصنيف المستخدم المبدئي: [${documentType}]، لكنه ليس حكماً نهائياً على نوع المستند أو الاختصاص.\n\nحدّد نوع المستند والجهة والأطراف والتواريخ والطلبات من المستند فقط، ثم اربطه بالمصادر الرسمية ذات الصلة. افصل بين النص المستخرج والتحليل القانوني وما يحتاج تحققاً رسمياً، ولا تخمّن مادة أو مرسوماً غير متحقق منه.${customNote.trim() ? `\nطلب المستخدم الخاص: ${customNote}` : ''}`;
    if (onAnalyzeImmediately) onAnalyzeImmediately(selectedFiles, promptText);
    else onAddAttachments(selectedFiles);
    onClose();
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden text-right flex flex-col max-h-[90vh]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <div><h2 className="text-lg font-bold text-neutral-100">رفع وتدقيق المستندات</h2><p className="text-xs text-neutral-400">PDF والصور فقط — حتى 2.5MB إجمالاً لكل طلب</p></div>
        <button onClick={onClose} className="p-2 text-neutral-400"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-6 overflow-y-auto space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">{[
          ['صك حكم قضائي','صك حكم'],['قرار إداري / تكليف','قرار إداري'],['لائحة دعوى / اعتراض','لائحة دعوى'],['سجل خدمة عسكرية','مستند خدمة عسكرية']
        ].map(([label,val]) => <button key={val} type="button" onClick={() => setDocumentType(val as typeof documentType)} className={`py-2 px-2 rounded-xl border ${documentType === val ? 'border-amber-500 text-amber-300' : 'border-neutral-800 text-neutral-400'}`}>{label}</button>)}</div>
        <div onDragOver={e => {e.preventDefault(); setIsDragging(true);}} onDragLeave={() => setIsDragging(false)} onDrop={e => {e.preventDefault(); setIsDragging(false); handleProcessFiles(e.dataTransfer.files);}} onClick={() => fileInputRef.current?.click()} className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer ${isDragging ? 'border-amber-400' : 'border-neutral-700'}`}>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,application/pdf,image/*" className="hidden" onChange={e => handleProcessFiles(e.target.files)} />
          <UploadCloud className="w-8 h-8 mx-auto mb-3 text-amber-400"/><p className="text-sm font-bold text-neutral-100">اسحب PDF أو صورة هنا، أو انقر للاختيار</p>
        </div>
        {uploadError && <div className="p-3 bg-rose-950 border border-rose-800 rounded-xl text-rose-200 text-xs flex gap-2"><AlertCircle className="w-4 h-4"/>{uploadError}</div>}
        {selectedFiles.map(file => <div key={file.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800"><div className="flex gap-3"><FileCheck className="w-5 h-5 text-amber-400"/><div><p className="text-xs font-bold text-neutral-200">{file.name}</p><p className="text-[10px] text-neutral-400">{(file.size/(1024*1024)).toFixed(2)} MB</p></div></div><button onClick={() => setSelectedFiles(prev => prev.filter(f => f.id !== file.id))}><Trash2 className="w-4 h-4 text-rose-400"/></button></div>)}
        <textarea value={customNote} onChange={e => setCustomNote(e.target.value)} placeholder="ملاحظة اختيارية للتحليل" className="w-full min-h-20 p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm" />
        <div className="flex items-center gap-2 text-xs text-neutral-400"><ShieldCheck className="w-4 h-4 text-amber-400"/>تُرسل الملفات إلى مزود الذكاء المهيأ للمنصة عند اختيار التحليل؛ لا ترفع بيانات غير لازمة للقضية.</div>
      </div>
      <div className="p-4 border-t border-neutral-800 flex gap-3 justify-end"><button onClick={handleConfirmAndAdd} disabled={!selectedFiles.length} className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-200 disabled:opacity-40">إضافة</button><button onClick={handleConfirmAndAnalyze} disabled={!selectedFiles.length} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold disabled:opacity-40">إضافة وتحليل</button></div>
    </div>
  </div>;
}
