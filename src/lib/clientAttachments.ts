import type { Attachment } from '../types';

export const INLINE_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;

export function isSupportedInlineAttachment(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf'
    || name.endsWith('.pdf')
    || file.type.startsWith('image/');
}

export async function readFileAsAttachment(file: File): Promise<Attachment> {
  if (!isSupportedInlineAttachment(file)) {
    throw new Error('الملف غير مدعوم هنا. استخدم PDF أو صورة فقط.');
  }
  if (file.size > INLINE_ATTACHMENT_MAX_BYTES) {
    throw new Error('حجم الملف يتجاوز 3 ميجابايت؛ حلله على دفعات أو استخدم ملفاً أصغر.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));
    reader.readAsDataURL(file);
  });

  const comma = dataUrl.indexOf(',');
  const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const isImage = file.type.startsWith('image/');
  const type = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    ? 'application/pdf'
    : (file.type || 'image/jpeg');

  return {
    id: 'inline-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    name: file.name,
    type,
    size: file.size,
    data,
    previewUrl: isImage ? dataUrl : undefined,
    isImage,
  };
}