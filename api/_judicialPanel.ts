import { GoogleGenAI } from '@google/genai';
import { withTimeout } from './_async.js';
import {
  USER_AI_MODELS,
  isModelCoolingDown,
  isQuotaError,
  markModelQuotaError,
} from './_aiRuntime.js';

export type IndependentJudicialPanelRole = 'procedure-source' | 'evidence-opponent';

export type IndependentJudicialPanelOpinion = {
  role: IndependentJudicialPanelRole;
  label: string;
  status: 'CLEAR' | 'CONCERN' | 'BLOCK' | 'UNAVAILABLE';
  findings: string[];
  strongestCounterpoint: string;
  unresolved: string[];
  model?: string;
};

export type IndependentJudicialPanelResult = {
  mode: 'two-independent-reviewers-plus-synthesizer';
  completed: number;
  opinions: IndependentJudicialPanelOpinion[];
  disagreements: string[];
};

const ROLE_PROMPTS: Record<IndependentJudicialPanelRole, string> = {
  'procedure-source': [
    '[مراجع مستقل 1 — الإجراءات والمصدر]',
    'افحص فقط: المحكمة والمرحلة وطريق الاعتراض، المواعيد، السريان الزمني، مرتبة المصدر، والاستثناءات النظامية.',
    'لا تتبنَّ نظرية صاحب المذكرة. لا تعيد الصياغة. لا تستنتج نصاً غير موجود في حزمة المصادر.',
    'إذا كان النقص متعلقاً بنص أو تاريخ غير متحقق فاذكره كـ unresolved، ولا تملأ الفراغ من الذاكرة.',
  ].join('\n'),
  'evidence-opponent': [
    '[مراجع مستقل 2 — الإثبات والخصم]',
    'افحص فقط: هل كل واقعة جوهرية لها دليل؟ ما أقوى حجة للطرف المقابل؟ هل الطلب ينتج من الأسباب؟ وهل توجد قفزة أو تناقض؟',
    'عامل بلاغة المذكرة كشيء محايد. لا تفترض صحة الواقعة لأنها كُتبت بصيغة جازمة.',
    'لا تعيد الصياغة ولا تضف سنداً قانونياً جديداً.',
  ].join('\n'),
};

function safeStrings(value: unknown, limit = 12, max = 900): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().slice(0, max))
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function parseJson(raw: string): Record<string, unknown> | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const candidates = [
    text,
    text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(),
  ];
  const object = text.match(/\{[\s\S]*\}/);
  if (object) candidates.push(object[0]);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {}
  }
  return null;
}

function normalizeStatus(value: unknown): IndependentJudicialPanelOpinion['status'] {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'CLEAR' || status === 'CONCERN' || status === 'BLOCK') return status;
  return 'CONCERN';
}

async function runOne(args: {
  role: IndependentJudicialPanelRole;
  clients: GoogleGenAI[];
  neutralSystemInstruction: string;
  userContent: string;
  offset: number;
}): Promise<IndependentJudicialPanelOpinion> {
  const { role, clients, neutralSystemInstruction, userContent, offset } = args;
  const label = role === 'procedure-source'
    ? 'مراجع الإجراءات والمصادر'
    : 'مراجع الإثبات والخصم';

  if (clients.length === 0) {
    return { role, label, status: 'UNAVAILABLE', findings: [], strongestCounterpoint: '', unresolved: ['لا يوجد مزود AI متاح للمراجع المستقل.'] };
  }

  const roleInstruction = [
    neutralSystemInstruction,
    ROLE_PROMPTS[role],
    '',
    'أعد JSON فقط بهذا الشكل:',
    '{',
    '  "status": "CLEAR|CONCERN|BLOCK",',
    '  "findings": [],',
    '  "strongestCounterpoint": "",',
    '  "unresolved": []',
    '}',
  ].join('\n');

  const models = [
    ...USER_AI_MODELS.slice(offset),
    ...USER_AI_MODELS.slice(0, offset),
  ];

  let lastError: unknown;
  let attempts = 0;
  for (const model of models) {
    if (isModelCoolingDown(model)) continue;
    for (let i = 0; i < clients.length && attempts < Math.max(2, clients.length * 2); i += 1) {
      attempts += 1;
      const client = clients[(i + offset) % clients.length];
      try {
        const response = await withTimeout(client.models.generateContent({
          model,
          contents: userContent,
          config: {
            systemInstruction: roleInstruction,
            temperature: 0.02,
            responseMimeType: 'application/json',
            maxOutputTokens: 1800,
          },
        }), 18_000, 'INDEPENDENT_JUDICIAL_REVIEW_TIMEOUT');

        const parsed = parseJson(response.text || '');
        if (!parsed) throw new Error('INDEPENDENT_JUDICIAL_REVIEW_INVALID_JSON');

        return {
          role,
          label,
          status: normalizeStatus(parsed.status),
          findings: safeStrings(parsed.findings),
          strongestCounterpoint: typeof parsed.strongestCounterpoint === 'string'
            ? parsed.strongestCounterpoint.trim().slice(0, 1600)
            : '',
          unresolved: safeStrings(parsed.unresolved),
          model,
        };
      } catch (error) {
        lastError = error;
        if (isQuotaError(error)) {
          markModelQuotaError(model, error);
          break;
        }
      }
    }
  }

  return {
    role,
    label,
    status: 'UNAVAILABLE',
    findings: [],
    strongestCounterpoint: '',
    unresolved: [lastError instanceof Error ? lastError.message.slice(0, 500) : 'تعذر تشغيل المراجع المستقل.'],
  };
}

function disagreementSummary(opinions: IndependentJudicialPanelOpinion[]): string[] {
  const available = opinions.filter((item) => item.status !== 'UNAVAILABLE');
  if (available.length < 2) return [];
  const statuses = new Set(available.map((item) => item.status));
  const disagreements: string[] = [];
  if (statuses.size > 1) {
    disagreements.push(
      `اختلاف في مستوى الخطر: ${available.map((item) => `${item.label}=${item.status}`).join('، ')}`,
    );
  }
  const unresolvedCounts = available.map((item) => item.unresolved.length);
  if (Math.max(...unresolvedCounts) > 0 && Math.min(...unresolvedCounts) === 0) {
    disagreements.push('أحد المراجعين رصد نقاطاً غير محسومة بينما لم يرصدها المراجع الآخر؛ يلزم أن يحسم المراجع النهائي سبب الاختلاف.');
  }
  return disagreements;
}

export async function runIndependentJudicialPanel(args: {
  clients: GoogleGenAI[];
  neutralSystemInstruction: string;
  userContent: string;
}): Promise<IndependentJudicialPanelResult> {
  const roles: IndependentJudicialPanelRole[] = ['procedure-source', 'evidence-opponent'];
  const opinions = await Promise.all(
    roles.map((role, index) => runOne({
      role,
      clients: args.clients,
      neutralSystemInstruction: args.neutralSystemInstruction,
      userContent: args.userContent,
      offset: index,
    })),
  );

  return {
    mode: 'two-independent-reviewers-plus-synthesizer',
    completed: opinions.filter((item) => item.status !== 'UNAVAILABLE').length,
    opinions,
    disagreements: disagreementSummary(opinions),
  };
}

export function independentPanelContext(panel: IndependentJudicialPanelResult): string {
  return [
    '[آراء مجلس المراجعين المستقلين — غير ملزمة بذاتها]',
    'هذه الآراء ناتجة عن استدعاءات مستقلة ولم يرَ أي مراجع رأي الآخر. يجب على المراجع النهائي اختبارها مقابل الملف والمصادر، لا تبنيها آلياً.',
    ...panel.opinions.map((opinion) => [
      `المراجع: ${opinion.label}`,
      `الحالة: ${opinion.status}`,
      opinion.findings.length ? `الملاحظات:\n- ${opinion.findings.join('\n- ')}` : 'الملاحظات: لا توجد ملاحظات مسجلة.',
      opinion.strongestCounterpoint ? `أقوى حجة مضادة: ${opinion.strongestCounterpoint}` : '',
      opinion.unresolved.length ? `غير محسوم:\n- ${opinion.unresolved.join('\n- ')}` : '',
    ].filter(Boolean).join('\n')),
    panel.disagreements.length ? `مواضع اختلاف:\n- ${panel.disagreements.join('\n- ')}` : 'مواضع اختلاف: لا يوجد اختلاف صريح مسجل.',
  ].join('\n\n');
}
