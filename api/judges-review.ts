import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.js';
import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard.js';
import { readActiveSession } from './session.js';
import { enforceRateLimit } from './_rateLimit.js';
import { redactDirectIdentifiers } from './_privacy.js';
import { withTimeout } from './_async.js';
import { USER_AI_MODELS, isQuotaError, isModelCoolingDown, markModelQuotaError } from './_aiRuntime.js';
import { analyzeLawOfficeRoute, buildLawOfficeInstruction } from '../src/lib/lawOfficeExpert.js';
import { buildCourtProfileInstruction } from '../src/lib/courtProfiles.js';
import { buildCaseStrategyInstruction } from '../src/lib/caseStrategyProfiles.js';
import { buildAgentContractInstruction } from '../src/lib/agentContracts.js';

type IncomingAttachment = {
  name?: string;
  type?: string;
  data?: string;
};

function normalizeAttachment(att: IncomingAttachment): { inlineData: { mimeType: string; data: string } } | null {
  const data = typeof att?.data === 'string' ? att.data.trim() : '';
  if (!data) return null;

  const name = String(att?.name || '').toLowerCase();
  let mimeType = String(att?.type || '').trim().toLowerCase();
  if (mimeType === 'application/octet-stream' || !mimeType.includes('/')) {
    if (name.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (name.endsWith('.png')) mimeType = 'image/png';
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (name.endsWith('.webp')) mimeType = 'image/webp';
  }

  if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) return null;
  const base64 = data.startsWith('data:') && data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
  return { inlineData: { mimeType, data: base64 } };
}

function getGeminiClients(): GoogleGenAI[] {
  const keys = [1, 2, 3, 4]
    .map((index) => process.env[`GEMINI_API_KEY${index === 1 ? '' : `_${index}`}`]?.trim())
    .filter((key): key is string => Boolean(key));
  return keys.map((apiKey) => new GoogleGenAI({ apiKey }));
}

function getGatewayToken(): string {
  return process.env.AI_GATEWAY_API_KEY?.trim()
    || process.env.VERCEL_OIDC_TOKEN?.trim()
    || '';
}

async function generateReviewViaGateway(prompt: string): Promise<string> {
  const token = getGatewayToken();
  if (!token) return '';

  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(25_000),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.5-flash',
      models: ['google/gemini-3.5-flash-lite', 'google/gemini-3.1-flash-lite', 'google/gemini-3.6-flash'],
      messages: [
        { role: 'system', content: 'أعد JSON صالحاً فقط دون أي نص خارج JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 7000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AI Gateway ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload: any = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const session = await readActiveSession(req.headers?.cookie);
  if (!session) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }

  try {
    const limit = await enforceRateLimit('judges-review', session.id, 20, 10 * 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }
  } catch (error) {
    console.error('Judges-review rate limit unavailable:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'RATE_LIMIT_STORE_UNAVAILABLE' });
  }

  const body = (req.body ?? {}) as {
    text?: string;
    court?: string;
    documentTitle?: string;
    clientName?: string;
    attachmentsText?: string;
    uploadedFileName?: string;
    attachments?: IncomingAttachment[];
  };

  if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
    return res.status(400).json({ error: 'نص المذكرة القضائية مطلوب.' });
  }

  const safeText = redactDirectIdentifiers(body.text).text;
  const safeAttachmentsText = redactDirectIdentifiers(String(body.attachmentsText || '')).text;

  const attachmentParts = (Array.isArray(body.attachments) ? body.attachments : [])
    .map(normalizeAttachment)
    .filter((part): part is { inlineData: { mimeType: string; data: string } } => Boolean(part));

  const sourceBundle = runLegalSourceAgents(
    `${body.court || ''}\n${body.documentTitle || ''}\n${safeText.slice(0, 16000)}`,
  );
  const routeAudit = analyzeLawOfficeRoute(
    [body.court || '', body.documentTitle || '', safeText, safeAttachmentsText].join('\n'),
    attachmentParts.length > 0 || Boolean(safeAttachmentsText.trim()),
  );
  const lawOfficeInstruction = buildLawOfficeInstruction(routeAudit, sourceBundle);
  const reviewProfileInput = [body.court || '', body.documentTitle || '', safeText, safeAttachmentsText].join('\n');
  const courtProfileInstruction = buildCourtProfileInstruction(reviewProfileInput);
  const caseStrategyInstruction = buildCaseStrategyInstruction(reviewProfileInput);
  const virtualJudgeContract = buildAgentContractInstruction('virtual-judge');

  const legalReferenceContext = [
    sourceBundle.context,
    `المصادر الرسمية الفريدة: ${sourceBundle.verification.officialSources}`,
    `المواد المفهرسة المتحقق من وجودها: ${sourceBundle.verification.verifiedArticles}`,
    'النص الحرفي الكامل غير معتمد من المستودع؛ أي اقتباس حرفي يحتاج مطابقة المصدر الرسمي.',
    'قاعدة السوابق القضائية الرسمية الكاملة غير جاهزة؛ لا تنسب رقماً أو مبدأً إلى حكم غير موجود صراحة في حزمة المصدر.',
  ].join('\n\n');

  const prompt = `${virtualJudgeContract}

${courtProfileInstruction}

${caseStrategyInstruction}

${lawOfficeInstruction}

أنت فريق مراجعة قانونية آلي داخل مكتب محاماة رقمي. لديك ثلاثة أدوار تحليلية، لكن لا تفترض أن كل محرر استئناف أو نقض.
المهمة التي حددتها بوابة المكتب: ${routeAudit.task}.
مرحلة الحكم التي حددتها البوابة: ${routeAudit.stage}.

قواعد توزيع المراجعة:
- إذا كانت المهمة دعوى أو مذكرة أو رد أو مراجعة مستند: لا تخترع أخطاء نقض أو استئناف؛ اجعل cassationErrors فارغة ما لم يكن النص نفسه طعناً.
- إذا كانت المهمة استئنافاً: افحص الحكم الابتدائي وأسباب الاستئناف والمرفقات، ولا تعامل الاستئناف كنقض.
- إذا كانت المهمة نقضاً: افحص أولاً قابلية الطريق ودرجة الحكم، ثم ركز على الأخطاء القانونية والإجرائية والتسبيبية القابلة للبحث؛ لا تعيد وزن الوقائع كأنك محكمة موضوع.
- إذا تعارض عنوان المحرر مع مرحلة الحكم، اعتبر تعارض المسار هو الخلل الأول ولا تعيد كتابة محرر من نوع خاطئ.
- لا تخترع خطأ لمجرد ملء قسم من التقرير. القسم غير المنطبق يجب أن تكون عناصره [].

نفّذ المراجعة القضائية بهذا الترتيب الإلزامي:
A. JURISDICTION_AND_STAGE
- تحقق من نوع الدعوى ومرحلة الحكم وطريق الاعتراض المختار.
- في النقض: لا تعيد وزن الأدلة كمحكمة موضوع؛ ميّز بين إعادة الوزن وبين الخطأ في التكييف، إغفال مستند جوهري، فساد الاستدلال، أو قصور التسبيب.

B. TIMELINE_AND_TEMPORAL_LAW
- ابنِ خطاً زمنياً موجزاً للقرار أو الواقعة والحكم والتبليغ والتظلم والتعديلات النظامية ذات الصلة.
- لا تطبق نصاً حالياً على واقعة سابقة دون التحقق من نفاذه زمنياً.

C. SOURCE_HIERARCHY
- اختبر مرتبة كل مصدر: نظام، لائحة، قرار، أمر، مبدأ أو حكم.
- قدّم النص الخاص والاستثناء الصريح على العموم، ولا تعتبر تشابه الوقائع بديلاً عن النص.

D. ELEMENT_TEST
- لكل حق أو استحقاق أو سبب نقض، أنشئ عناصر مستقلة:
  REQUIREMENT → FACT → EVIDENCE → SOURCE → SATISFIED / NOT_SATISFIED / UNVERIFIED.
- لا تسمح بانتقال النتيجة من قاعدة عامة إلى استحقاق فردي دون اكتمال العناصر.

E. EXCEPTION_TEST
- لكل قاعدة أو حد مالي أو منع جمع أو شرط قبول: ابحث عن الاستثناءات والقيود والموانع.
- إذا استند الخصم إلى قاعدة عامة وكان في النص استثناء خاص مؤثر، يجب إبرازه كمسألة مستقلة.

F. OPPOSING_PARTY_RED_TEAM
- استخرج أقوى دفع جوهري للطرف المقابل أو الجهة الإدارية، لا أضعف دفع.
- افحص هل أجابت المذكرة عنه واقعياً ونظامياً، وهل يوجد تناقض بين دفع الخصم والنتيجة التي تبناها الحكم.

G. CASSATION_BOUNDARY
- إذا كانت المهمة نقضاً، افصل بين:
  1) مجادلة تقدير الدليل الممنوعة على محكمة النقض،
  2) الخطأ في تكييف الواقعة،
  3) إغفال مستند حاسم،
  4) قصور أو تناقض الأسباب،
  5) الخطأ في تطبيق النص أو الاستثناء.
- لا تسمح بصياغة سبب نقض على أنه مجرد إعادة مناقشة للوقائع.

H. PRECEDENT_TEST
- لا تنسب حكماً أو مبدأ غير موجود في حزمة المصدر.
- صنف أي سابقة موجودة: DIRECT / ANALOGOUS / DISTINGUISHABLE / IRRELEVANT.

I. REMEDY_TEST
- اختبر هل الأسباب التي بنيت عليها المذكرة تنتج فعلاً الطلب النهائي المطلوب: إلغاء، نقض، إحالة، تعويض، إلزام أو غيره.
- افصل بين طلب النقض وبين إعادة الحكم في الموضوع إذا كان الطريق النظامي لا يسمح بذلك مباشرة.

J. CONTRADICTION_TEST
- ابحث عن التناقض بين الوقائع والمستندات، وبين دفوع الخصم وأسباب الحكم، وبين الأسباب والطلبات.

حلل النص التالي، واكتب JSON فقط بالمفاتيح:
documentType, overallStatus, gateDecision, primaryFatalDefect, judges, issueMatrix, temporalErrors, hierarchyErrors, exceptionErrors, rebuttalErrors, cassationErrors, claimErrors, attachmentErrors, remedyErrors, contradictions, nodeFailures, revisedDocument, changeLog, synthesisAdvice.

قواعد gateDecision:
- PASS فقط إذا لم توجد فجوة جوهرية، والمصادر اللازمة متحققة، ولا يوجد استثناء غير مفحوص أو دفاع جوهري بلا جواب.
- RETURN إذا كان الخلل قابلاً للإصلاح ولا يهدم المسار القضائي من أساسه.
- BLOCK إذا كان طريق الطعن خاطئاً، أو يوجد خطأ قانوني/واقعي جوهري قد يغير النتيجة، أو مصدر حاسم غير موثق، أو نص غير نافذ، أو استثناء حاسم غير مفحوص.
- nodeFailures يجب أن ينسب كل عيب إلى أقرب عقدة: fact-extraction / retrieval-temporal / legal-analysis / drafting / virtual-judge-gate.

يجب أن يحتوي judges على ثلاثة عناصر مراجعة آلية، وأن يكون revisedDocument النص الكامل بعد التصحيح دون اختصار.
لا تعتبر النص جاهزاً للإيداع لمجرد جودة الصياغة.
لا تنسب مادة أو ميعاداً أو مرسوماً أو قراراً أو حكماً قضائياً إلى النظام من الذاكرة.
لا تضف في revisedDocument أي سند قانوني جديد ما لم يكن موجوداً أصلاً في النص أو مثبتاً صراحة في حزمة المصادر الرسمية.
إذا لم يكن المصدر الرسمي متحققاً فاذكر أن التحقق المرجعي غير مكتمل، ولا تعتبر أي نص داخلي بديلاً عن المصدر الرسمي.

${legalReferenceContext}

الاختصاص: ${body.court || 'administrative'}
العنوان: ${body.documentTitle || 'محرر قضائي'}
المستفيد: صاحب الشأن

النص المراد فحصه:
${safeText.slice(0, 30000)}

المرفقات:
${safeAttachmentsText || body.uploadedFileName || 'لا توجد مرفقات مستقلة'}`;

  let raw = '';
  let lastError: unknown;

  try {
    // The gateway request is text-only here. If binary evidence exists, use Gemini
    // directly so the review agent actually reads the PDF/image bytes.
    raw = attachmentParts.length === 0 ? await generateReviewViaGateway(prompt) : '';
  } catch (error) {
    lastError = error;
    console.error('AI Gateway review failed:', error instanceof Error ? error.message : error);
  }

  if (!raw) {
    const clients = getGeminiClients();
    const models = USER_AI_MODELS;

    let attempts = 0;
    outer: for (const model of models) {
        if (isModelCoolingDown(model)) continue;
      for (const client of clients) {
        if (attempts >= clients.length * models.length) break outer;
        attempts += 1;
        try {
          const response = await withTimeout(client.models.generateContent({
            model,
            contents: attachmentParts.length > 0
              ? [{ role: 'user', parts: [...attachmentParts, { text: prompt }] }]
              : prompt,
          }), 28_000, 'AI_REVIEW_TIMEOUT');
          raw = response.text?.trim() || '';
          if (raw) break outer;
        } catch (error) {
          lastError = error;
          if (isQuotaError(error)) {
          markModelQuotaError(model, error);
          break;
        }
        }
      }
    }
  }

  if (!raw) {
    console.error('Judges review failed:', lastError);
    return res.status(503).json({ error: 'AI_REVIEW_UNAVAILABLE' });
  }

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: 'AI_INVALID_RESPONSE' });
    const report = JSON.parse(match[0]);
    const revisedDocument = typeof report?.revisedDocument === 'string' ? report.revisedDocument : '';
    const citationGuard = revisedDocument
      ? guardIntroducedLegalCitations(safeText, revisedDocument, legalReferenceContext)
      : { introducedMarkers: [], unsupportedMarkers: [], blocked: false };

    if (routeAudit.blocking) {
      report.overallStatus = 'معيب بحاجة لتصحيح';
      report.primaryFatalDefect = routeAudit.reason;
      report.revisedDocument = body.text;
      report.changeLog = Array.isArray(report.changeLog) ? report.changeLog : [];
      report.changeLog.unshift(`بوابة المرحلة أوقفت الصياغة: ${routeAudit.reason}`);
      report.synthesisAdvice = routeAudit.nextAction;
    }

    if (report.overallStatus === 'جاهز للإيداع') {
      report.overallStatus = 'معيب بحاجة لتصحيح';
      report.changeLog = Array.isArray(report.changeLog) ? report.changeLog : [];
      report.changeLog.push('QADA لا يعتمد وصف "جاهز للإيداع" آلياً؛ يلزم اعتماد بشري ومرجعي قبل الإيداع.');
    }

    if (citationGuard.blocked) {
      report.revisedDocument = body.text;
      report.overallStatus = 'معيب بحاجة لتصحيح';
      report.changeLog = Array.isArray(report.changeLog) ? report.changeLog : [];
      report.changeLog.push('أوقفت بوابة التحقق تطبيق الصياغة المنقحة لأنها أدخلت إحالات قانونية جديدة غير مثبتة في حزمة المصادر الرسمية.');
      report.synthesisAdvice = [
        String(report.synthesisAdvice || ''),
        'تمت إعادة revisedDocument إلى النص الأصلي بسبب أسانيد قانونية جديدة غير متحققة. راجع المصادر الرسمية ثم أعد الفحص.',
      ].filter(Boolean).join('\n');
    }

    const sourceBlockers = Array.isArray(sourceBundle.verification.blockers)
      ? sourceBundle.verification.blockers.filter(Boolean)
      : [];
    const fatalDefect = String(report?.primaryFatalDefect || '').trim();
    const requestedGate = String(report?.gateDecision || '').trim().toUpperCase();

    const countFindings = (value: any): number => {
      if (Array.isArray(value)) return value.length;
      if (!value || typeof value !== 'object') return 0;
      const items = Array.isArray(value.items) ? value.items.length : 0;
      const missing = Array.isArray(value.missingRequiredDocs) ? value.missingRequiredDocs.length : 0;
      return items + missing;
    };

    const findingCounts = {
      temporal: countFindings(report?.temporalErrors),
      hierarchy: countFindings(report?.hierarchyErrors),
      exception: countFindings(report?.exceptionErrors),
      rebuttal: countFindings(report?.rebuttalErrors),
      cassation: countFindings(report?.cassationErrors),
      claim: countFindings(report?.claimErrors),
      attachment: countFindings(report?.attachmentErrors),
      remedy: countFindings(report?.remedyErrors),
      contradiction: countFindings(report?.contradictions),
    };
    const materialErrorCount = Object.values(findingCounts).reduce((sum, count) => sum + count, 0);

    const caseProfileText = [
      body.court || '',
      body.documentTitle || '',
      safeText,
      safeAttachmentsText,
    ].join('\n').toLowerCase();

    const militaryPersonnelCase = /خدمة\s*الأفراد|فرد\s*عسكري|عسكري|القوات\s*(?:البرية|الجوية|البحرية)|وزارة\s*الدفاع|علاوة\s*فنية|بدل\s*عسكري|مكافأة\s*الحاسب|مكافاه\s*الحاسب/.test(caseProfileText);
    const administrativeCase = militaryPersonnelCase
      || /ديوان\s*المظالم|المحكمة\s*الإدارية|المحكمه\s*الاداريه|قرار\s*إداري|قرار\s*اداري|جهة\s*إدارية|جهه\s*اداريه/.test(caseProfileText)
      || String(body.court || '').toLowerCase().includes('administrative');

    const personnelPacket = sourceBundle.packets.find((packet) => packet.agentId === 'src-personnel');
    const bogPacket = sourceBundle.packets.find((packet) => packet.agentId === 'src-bog');
    const verifiedPersonnelArticles = personnelPacket?.verifiedArticles.length || 0;
    const verifiedAdministrativeArticles = bogPacket?.verifiedArticles.length || 0;

    const criticalSourceBlockers: string[] = [];
    if (sourceBundle.verification.officialSources === 0) {
      criticalSourceBlockers.push('لا يوجد مصدر رسمي متحقق في حزمة القضية.');
    }
    if (militaryPersonnelCase && verifiedPersonnelArticles === 0) {
      criticalSourceBlockers.push('القضية عسكرية/وظيفية ولم تتحقق مادة ذات صلة من نظام خدمة الأفراد.');
    }
    if (administrativeCase && verifiedAdministrativeArticles === 0) {
      criticalSourceBlockers.push('القضية إدارية ولم تتحقق مادة ذات صلة من أنظمة ديوان المظالم.');
    }
    for (const blocker of sourceBlockers) {
      if (
        /ذُكرت مواد|سجل مادة متحقق|غير متحقق|needs-correction|لم يعثر الفهرس على مادة|أداة الإصدار غير مكتملة|م\/37/i.test(blocker)
      ) {
        criticalSourceBlockers.push(blocker);
      }
    }

    const hardBlockers = [
      ...(routeAudit.blocking ? [routeAudit.reason] : []),
      ...(citationGuard.blocked ? ['تم إدخال إحالات قانونية غير متحققة في الصياغة.'] : []),
      ...(fatalDefect ? [fatalDefect] : []),
      ...criticalSourceBlockers,
    ];

    let readinessScore = 100;
    if (routeAudit.blocking) readinessScore -= 40;
    if (citationGuard.blocked) readinessScore -= 40;
    if (fatalDefect) readinessScore -= 35;
    readinessScore -= Math.min(35, criticalSourceBlockers.length * 12);
    readinessScore -= findingCounts.temporal * 12;
    readinessScore -= findingCounts.hierarchy * 10;
    readinessScore -= findingCounts.exception * 12;
    readinessScore -= findingCounts.rebuttal * 6;
    readinessScore -= findingCounts.cassation * 8;
    readinessScore -= findingCounts.claim * 7;
    readinessScore -= findingCounts.attachment * 5;
    readinessScore -= findingCounts.remedy * 8;
    readinessScore -= findingCounts.contradiction * 8;
    readinessScore = Math.max(0, Math.min(100, readinessScore));

    const readinessTarget = 95;
    const idealReadinessTarget = 99;

    let serverGate: 'PASS' | 'RETURN' | 'BLOCK' = 'RETURN';
    if (hardBlockers.length > 0) {
      serverGate = 'BLOCK';
    } else if (
      readinessScore >= readinessTarget
      && materialErrorCount === 0
      && requestedGate === 'PASS'
    ) {
      serverGate = 'PASS';
    }

    report.gateDecision = serverGate;
    report.readinessScore = readinessScore;
    report.readinessTarget = readinessTarget;
    report.idealReadinessTarget = idealReadinessTarget;
    report.militaryPersonnelCase = militaryPersonnelCase;
    report.administrativeCase = administrativeCase;
    report.hardBlockers = hardBlockers;
    report.verifiedPersonnelArticles = verifiedPersonnelArticles;
    report.verifiedAdministrativeArticles = verifiedAdministrativeArticles;

    if (serverGate === 'BLOCK') {
      report.revisedDocument = body.text;
      report.overallStatus = 'معيب بحاجة لتصحيح';
    } else if (serverGate === 'RETURN') {
      report.overallStatus = 'يحتاج مراجعة قبل الإيداع';
    } else {
      report.overallStatus = readinessScore >= idealReadinessTarget
        ? 'اجتاز بوابة الجاهزية العالية'
        : 'اجتاز الحد الأدنى لبوابة الجاهزية';
    }

    return res.status(200).json({
      report,
      sourceAudit: {
        officialSources: sourceBundle.verification.officialSources,
        verifiedArticles: sourceBundle.verification.verifiedArticles,
        blockers: sourceBundle.verification.blockers,
        literalQuotationReady: sourceBundle.verification.literalQuotationReady,
        precedentCorpusReady: sourceBundle.verification.precedentCorpusReady,
        introducedMarkers: citationGuard.introducedMarkers,
        unsupportedMarkers: citationGuard.unsupportedMarkers,
        blockedRevision: citationGuard.blocked || routeAudit.blocking,
        workflowTask: routeAudit.task,
        workflowStage: routeAudit.stage,
        workflowBlocker: routeAudit.blocking ? routeAudit.reason : '',
        gateDecision: report.gateDecision,
        readinessScore: report.readinessScore,
        readinessTarget: report.readinessTarget,
        idealReadinessTarget: report.idealReadinessTarget,
        militaryPersonnelCase: report.militaryPersonnelCase,
        administrativeCase: report.administrativeCase,
        verifiedPersonnelArticles: report.verifiedPersonnelArticles,
        verifiedAdministrativeArticles: report.verifiedAdministrativeArticles,
        hardBlockers: report.hardBlockers,
      },
      sourcePackets: sourceBundle.packets,
    });
  } catch (error) {
    console.error('Judges review JSON parse failed:', error);
    return res.status(502).json({ error: 'AI_INVALID_RESPONSE' });
  }
}
