import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { Copy, Check, Scale, User, ShieldCheck, FileText, Image as ImageIcon, ExternalLink, X, Gavel, Printer, ChevronDown, ShieldAlert, BookOpen, Fingerprint } from 'lucide-react';
import { Message, Attachment, JudgeCourtCategory } from '../types';
import { CassationJudgesPanel } from './CassationJudgesPanel';
import { printLegalMemo } from '../utils/printMemo';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onApplyRemedy?: (remedyText: string) => void;
  onRequestAudit?: (message: Message, court?: 'الكل' | JudgeCourtCategory) => void;
  isAuditing?: boolean;
  activeNationalId?: string;
  activePersonName?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function maskNationalId(value?: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  const tail = digits.slice(-4);
  return `••••••${tail}`;
}

export function ChatMessage({
  message,
  isStreaming = false,
  onApplyRemedy,
  onRequestAudit,
  isAuditing = false,
  activeNationalId,
  activePersonName,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCourtDropdown, setShowCourtDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isUser = message.role === 'user';
  const charCount = message.content.length;
  const attachments = message.attachments || [];
  const maskedNationalId = maskNationalId(activeNationalId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCourtDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`group w-full py-6 px-4 md:px-8 transition-colors border-b ${
        isUser
          ? 'bg-neutral-900/50 border-neutral-800/80'
          : 'bg-neutral-950/80 border-neutral-800'
      }`}
    >
      <div className="max-w-4xl mx-auto flex gap-4 md:gap-5 items-start">
        {/* Avatar */}
        <div
          className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm border ${
            isUser
              ? 'bg-neutral-800 border-neutral-700 text-neutral-300'
              : 'bg-gradient-to-br from-amber-600/90 to-amber-800/90 border-amber-500/30 text-amber-100 shadow-amber-950/30'
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold text-neutral-200">
                {isUser ? 'المستشار / المحامي' : 'منظومة الذكاء القضائي الإداري'}
              </span>

              {!isUser && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  QADA • مساعد قانوني آلي
                </span>
              )}

              <span className="text-[11px] text-neutral-500">
                {new Date(message.timestamp).toLocaleTimeString('ar-SA', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>

              {/* National ID Tag for Transaction Owner */}
              {activeNationalId && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold"
                  title="رقم قيد المعاملة للشخص الممشى له"
                >
                  <Fingerprint className="w-3 h-3 text-amber-400" />
                  <span>الهوية: {maskedNationalId}</span>
                </span>
              )}

              {/* Character limit verification indicator */}
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                  charCount > 3500
                    ? 'text-rose-400 bg-rose-950/40 border border-rose-800/50'
                    : 'text-neutral-500 bg-neutral-900 border border-neutral-800'
                }`}
                title="الحد الأقصى للرسالة لضمان الاستقرار النظامي (3500 حرف)"
              >
                {charCount.toLocaleString('ar-SA')} / ٣,٥٠٠ حرف
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Trigger Cassation Judges Audit button with court selection */}
              {onRequestAudit && !isStreaming && (
                <div className="relative" ref={dropdownRef}>
                  <div className="inline-flex rounded-lg shadow-xs">
                    <button
                      id={`audit-btn-${message.id}`}
                      onClick={() => onRequestAudit(message, 'الكل')}
                      disabled={isAuditing}
                      title="تشغيل ستة مراجعين آليين متخصصين لفحص المرفوع وإبراز مواطن الخلل المحتملة"
                      className="px-2.5 py-1 text-xs font-bold text-amber-300 hover:text-white bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/40 rounded-r-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Gavel className={`w-3.5 h-3.5 text-amber-400 ${isAuditing ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">
                        {message.cassationAudit ? 'إعادة المراجعة الآلية' : 'مراجعة آلية (٦)'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={isAuditing}
                      onClick={() => setShowCourtDropdown(!showCourtDropdown)}
                      title="اختر المحكمة لفحص القضية (إدارية، جزائية، عامة)"
                      className="px-1.5 py-1 text-xs text-amber-400 bg-amber-950/60 hover:bg-amber-900/70 border-y border-l border-amber-500/40 rounded-l-lg hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {showCourtDropdown && (
                    <div className="absolute left-0 bottom-full mb-1 w-52 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1.5 z-50 text-right animate-in fade-in slide-in-from-bottom-2">
                      <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 border-b border-neutral-800">
                        اختر اختصاص المحكمة للفحص:
                      </div>
                      <button
                        onClick={() => {
                          setShowCourtDropdown(false);
                          onRequestAudit(message, 'الكل');
                        }}
                        className="w-full px-3 py-1.5 text-xs text-right text-amber-300 hover:bg-amber-500/15 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span className="font-semibold">جميع المراجعين الآليين (٦)</span>
                        <Scale className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                      <button
                        onClick={() => {
                          setShowCourtDropdown(false);
                          onRequestAudit(message, 'المحكمة الإدارية');
                        }}
                        className="w-full px-3 py-1.5 text-xs text-right text-sky-300 hover:bg-sky-500/15 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <p className="font-semibold">المحكمة الإدارية (ديوان المظالم)</p>
                          <span className="text-[10px] text-neutral-400">مواعيد، قرارات، تظلمات</span>
                        </div>
                        <Scale className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      </button>
                      <button
                        onClick={() => {
                          setShowCourtDropdown(false);
                          onRequestAudit(message, 'المحكمة الجزائية');
                        }}
                        className="w-full px-3 py-1.5 text-xs text-right text-rose-300 hover:bg-rose-500/15 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <p className="font-semibold">المحكمة الجزائية</p>
                          <span className="text-[10px] text-neutral-400">بطلان قبض وتفتيش وشبهات</span>
                        </div>
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      </button>
                      <button
                        onClick={() => {
                          setShowCourtDropdown(false);
                          onRequestAudit(message, 'المحكمة العامة');
                        }}
                        className="w-full px-3 py-1.5 text-xs text-right text-emerald-300 hover:bg-emerald-500/15 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <p className="font-semibold">المحكمة العامة</p>
                          <span className="text-[10px] text-neutral-400">مسؤولية تقصيرية وتعويض</span>
                        </div>
                        <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                id={`copy-btn-${message.id}`}
                onClick={handleCopy}
                title="نسخ النص"
                className="opacity-80 group-hover:opacity-100 focus:opacity-100 transition-all px-2 py-1 text-neutral-400 hover:text-amber-300 rounded-lg hover:bg-neutral-800 flex items-center gap-1.5 text-xs bg-neutral-900/60 border border-neutral-800 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 text-[11px]">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px]">نسخ</span>
                  </>
                )}
              </button>

              <button
                id={`print-memo-btn-${message.id}`}
                onClick={() =>
                  printLegalMemo(
                    message.content,
                    isUser
                      ? 'طلب المستخدم - أصول القضاء'
                      : 'مسودة قانونية للمراجعة - أصول القضاء'
                  )
                }
                title="طباعة المذكرة"
                className="opacity-80 group-hover:opacity-100 focus:opacity-100 transition-all px-2 py-1 text-neutral-400 hover:text-amber-300 rounded-lg hover:bg-neutral-800 flex items-center gap-1.5 text-xs bg-neutral-900/60 border border-neutral-800 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px]">طباعة المذكرة</span>
              </button>
            </div>
          </div>

          {/* Render Attached Files & Images if present */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2.5 pt-1 pb-2">
              {attachments.map((att) => {
                const isImg = att.isImage || att.type.startsWith('image/');
                const dataUri = att.previewUrl || `data:${att.type};base64,${att.data}`;

                if (isImg) {
                  return (
                    <div
                      key={att.id}
                      onClick={() => setSelectedImage(dataUri)}
                      className="group/img relative rounded-xl overflow-hidden border border-neutral-700 bg-neutral-950 hover:border-amber-500/60 transition-all cursor-pointer max-w-[200px]"
                      title="انقر لتكبير الصورة"
                    >
                      <img
                        src={dataUri}
                        alt={att.name}
                        className="w-full h-28 object-cover group-hover/img:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent flex items-end p-2 opacity-90">
                        <span className="text-[10px] text-neutral-200 truncate font-mono">
                          {att.name}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={att.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-xs text-neutral-200 max-w-sm"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate text-neutral-200">{att.name}</p>
                      <p className="text-[10px] text-neutral-400 font-mono">
                        {formatFileSize(att.size)} • {att.type.includes('pdf') ? 'مستند PDF' : 'ملف نظامي'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isUser ? (
            <div className="text-neutral-200 whitespace-pre-wrap leading-relaxed text-[15px] font-normal break-words">
              {message.content}
            </div>
          ) : (
            <div className="prose prose-invert max-w-none text-[15px] leading-relaxed text-neutral-200 break-words font-legal">
              <div className="markdown-body [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:bg-neutral-900 [&_pre]:border [&_pre]:border-neutral-800 [&_pre]:text-amber-200 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-xs [&_p]:mb-3 [&_p]:leading-loose [&_ul]:list-disc [&_ul]:pr-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pr-5 [&_ol]:mb-3 [&_li]:mb-1.5 [&_blockquote]:border-r-4 [&_blockquote]:border-amber-500 [&_blockquote]:pr-4 [&_blockquote]:pl-0 [&_blockquote]:text-amber-100/90 [&_blockquote]:bg-amber-950/20 [&_blockquote]:py-2 [&_blockquote]:my-3 [&_blockquote]:rounded-l-lg [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:border [&_th]:border-neutral-700 [&_th]:bg-neutral-900 [&_th]:p-2.5 [&_th]:text-amber-300 [&_th]:text-sm [&_td]:border [&_td]:border-neutral-800 [&_td]:p-2.5 [&_td]:text-xs [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-amber-400 [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-amber-300 [&_h2]:mb-2.5 [&_h2]:border-b [&_h2]:border-neutral-800 [&_h2]:pb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-neutral-100 [&_h3]:mb-2 [&_strong]:text-amber-200 [&_strong]:font-bold">
                <Markdown>{message.content}</Markdown>
                {isStreaming && (
                  <span className="inline-block w-2.5 h-4.5 mr-1.5 bg-amber-400 animate-pulse align-middle rounded-xs" />
                )}
              </div>
            </div>
          )}
          {/* Render Cassation Judges Audit Report if present */}
          {message.cassationAudit && (
            <CassationJudgesPanel
              report={message.cassationAudit}
              onApplyRemedy={onApplyRemedy}
            />
          )}

          {/* Mandatory Transaction Binding Notice for Every Reply */}
          {!isUser && activeNationalId && (
            <div className="mt-3.5 pt-2.5 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
              <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>ملف المعاملة مرتبط بالسجل المشفر:</span>
                <span className="font-mono font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">
                  {maskedNationalId}
                </span>
                {activePersonName && <span className="text-neutral-300">({activePersonName})</span>}
              </div>
              <span className="text-[10px] text-neutral-500 font-mono">
                QADA • حفظ خاص
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Full Image Preview Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 left-0 p-2 text-neutral-300 hover:text-white rounded-full bg-neutral-800/80 cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedImage}
              alt="مستند مرفق"
              className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl border border-neutral-800"
              onClick={(e) => e.stopPropagation()}
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
