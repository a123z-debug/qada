import { isHujjaDraftingRequest } from './hujjaBayanAgent.js';

export type ConversationStateMessage = {
  role?: string;
  content?: string;
};

function isAssistant(message: ConversationStateMessage): boolean {
  return message.role === 'assistant' || message.role === 'model';
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function latestUserTurnText(messages: ConversationStateMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (isAssistant(messages[i])) continue;
    const value = clean(messages[i].content);
    if (value) return value;
  }
  return '';
}

export function previousAssistantTurnText(messages: ConversationStateMessage[]): string {
  let latestUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (!isAssistant(messages[i]) && clean(messages[i].content)) {
      latestUserIndex = i;
      break;
    }
  }
  if (latestUserIndex < 0) return '';
  for (let i = latestUserIndex - 1; i >= 0; i -= 1) {
    if (!isAssistant(messages[i])) continue;
    const value = clean(messages[i].content);
    if (value) return value;
  }
  return '';
}

function priorUserTexts(messages: ConversationStateMessage[]): string[] {
  const latest = latestUserTurnText(messages);
  let skippedLatest = false;
  const values: string[] = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (isAssistant(messages[i])) continue;
    const value = clean(messages[i].content);
    if (!value) continue;
    if (!skippedLatest && value === latest) {
      skippedLatest = true;
      continue;
    }
    values.push(value);
  }
  return values;
}

const CONTINUE_DRAFTING = /^(?:كمل|كمّل|كملها|كمّلها|ابدأ|ابدا|صغها|اكتبها|جهزها|جهّزها|اعتمدها|اكمل الصياغة|أكمل الصياغة|كمل الصياغة)(?:\s|$)/i;

export function shouldActivateDrafting(messages: ConversationStateMessage[]): boolean {
  const current = latestUserTurnText(messages);
  if (!current) return false;
  if (isHujjaDraftingRequest(current)) return true;
  if (!CONTINUE_DRAFTING.test(current)) return false;
  return priorUserTexts(messages).some((text) => isHujjaDraftingRequest(text));
}

export function isLikelyContinuationAnswer(messages: ConversationStateMessage[]): boolean {
  const current = latestUserTurnText(messages);
  const previousAssistant = previousAssistantTurnText(messages);
  if (!current || !previousAssistant) return false;
  if (current.length > 220) return false;
  if (isHujjaDraftingRequest(current) || CONTINUE_DRAFTING.test(current)) return false;
  if (/[؟?]$/.test(current)) return false;

  const assistantAskedForInput =
    /[؟?]|(?:أرسل|ارفق|أرفق|اذكر|حدد|اكتب|أكمل|اكمل|ما\s+اسم|وش\s+اسم|المعلومة\s+المطلوبة|الناقص|الناقصة|المحكمة|تاريخ|المبلغ|الخصم|الجهة|النتيجة|المستند)/i
      .test(previousAssistant);

  return assistantAskedForInput;
}

export function buildConversationStateInstruction(messages: ConversationStateMessage[]): string {
  if (!isLikelyContinuationAnswer(messages)) return '';
  return [
    '[حالة المحادثة الحالية]',
    'رسالة المستخدم الأخيرة هي إجابة استكمال لسؤال سابق وليست طلباً قانونياً جديداً.',
    'سجّل المعلومة الجديدة ضمن سياق القضية ولا تعِد تصنيف القضية من الصفر بسبب هذه الإجابة القصيرة.',
    'ممنوع تشغيل الصياغة النهائية أو بوابة اعتماد المسودة لمجرد وصول معلومة استكمال.',
    'ممنوع اختراع تكييف أو مادة أو سبب قانوني جديد من هذه الإجابة وحدها.',
    'أكمل من آخر نقطة في المحادثة، واطلب معلومة ناقصة واحدة فقط إذا بقي نقص فعلي.',
    'إذا كانت المعلومة كافية للانتقال، أكد تسجيلها بجملة قصيرة ثم انتقل للخطوة التالية.',
  ].join('\n');
}
