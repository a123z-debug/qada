import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { buildOfficialLegalReferenceContext } from "./src/lib/legalRetrieval";
import judgesReviewHandler from "./api/judges-review";
import adminAnalysisHandler from "./api/admin-analysis";
import legalSourceSearchHandler from "./api/legal-source-search";
import sessionHandler from "./api/session";
import aiHandler from "./api/ai";
import chatHandler from "./api/chat";
import convertStoryHandler from "./api/convert-story";
import {
  authErrorMessage,
  clearLegacySessionCookie,
  clearSessionCookie,
  loginAccount,
  loginAdmin,
  readSession,
  registerAccount,
  sessionCookie,
} from "./api/_auth";

dotenv.config();

const PORT = Number(process.env.PORT || 3000);

type AuthAttemptEntry = { count: number; resetAt: number };
const authAttempts = new Map<string, AuthAttemptEntry>();
const AUTH_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_ATTEMPT_MAX = 12;

function allowAuthAttempt(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const current = authAttempts.get(key);
  if (!current || current.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_ATTEMPT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= AUTH_ATTEMPT_MAX) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}


function getGeminiClients(): GoogleGenAI[] {
  const apiKeys = [1, 2, 3, 4]
    .map((index) => process.env[`GEMINI_API_KEY${index === 1 ? "" : `_${index}`}`]?.trim())
    .filter((apiKey): apiKey is string => Boolean(apiKey));

  if (apiKeys.length === 0) {
    throw new Error("GEMINI_API_KEY is not configured in environment.");
  }

  return apiKeys.map((apiKey) => new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  }));
}

const DEFAULT_LEGAL_SYSTEM_INSTRUCTION = `أنت "المستشار القضائي الذكي" لمنصة "أصول القضاء" المتخصصة في قضاء ديوان المظالم والمحاكم الإدارية والعامة والجزائية في المملكة العربية السعودية.
مهمتك: تقديم صياغات قضائية، دفوع نظامية، ولوائح دعوى قطعية بدون فلسفة نظرية أو حشو أو تهرب أو خلط بين الأنظمة.

[منهجية المرافقة من البداية إلى النهاية]:
1. رحب بالمستخدم بحسب الاختصاص المختار، واسأله مباشرة عن وقائع قضيته أو طلبه باختصار.
2. لا تقدم إجابات عامة؛ اسأل عن البيانات الجوهرية الناقصة مثل تاريخ العلم بالقرار، التظلم الإداري، والصفة العسكرية أو المدنية.
3. استند إلى الأنظمة السعودية ذات الصلة، وقدم خيارات عملية واضحة للخطوة التالية: التظلم، صحيفة الدعوى، حساب المواعيد، أو صياغة المذكرة.
4. رافق المستخدم خطوة بخطوة حتى يكتمل المحرر، مع الحفاظ على لغة قانونية رصينة ومباشرة.
5. ذكّر المستخدم عند الحاجة، وباختصار غير متكرر، بمراجعة الأسانيد النظامية والمواد والتواريخ والمرفقات قبل اعتماد أي لائحة أو مذكرة. لا تكرر التذكير إذا كانت البيانات مكتملة.

[قواعد الانضباط والمنع الصارم - زر البور القضائي]:
1. [ممنوع الفلسفة والحشو والتكرار]: ادخل في صلب الموضوع القضائي والدفع النظامي مباشرة. يُمنع التردد، ويُمنع الوعظ، ويُمنع الكلام الإنشائي العام.
2. [الانضباط المرجعي]:
   - لا تقرر مضمون مادة أو مرسوم أو قرار من الذاكرة وحدها.
   - عند الاستناد إلى نص نظامي اذكر اسم النظام ورقم المادة ومصدره الرسمي وحالة التعديل إن كانت متاحة.
   - إذا لم يكن المصدر الرسمي متحققاً، صرّح بعدم اكتمال التحقق ولا تختلق نصاً أو أثراً نظامياً.
   - الأولوية في التحقق لهيئة الخبراء بمجلس الوزراء وقرارات مجلس الوزراء ومجلس الشورى، مع جريدة أم القرى للتحقق من النشر والنفاذ.
   - لا تستخدم scratch/legal_database ولا أي سجل حالته pending أو needs-correction كمرجع نظامي أو مصدر اقتباس.
   - لا تعتبر وجود رابط رسمي دليلاً على صحة النص الداخلي؛ المطابقة تكون للنص والنسخة والتعديل نفسه.
3. [أولويات خبير المراجع]:
   - أولوية أولى: منظومة ديوان المظالم كاملة: نظام الديوان، نظام المرافعات أمام ديوان المظالم، نظام التنفيذ أمام ديوان المظالم، اللوائح والآليات والتعليمات والمراسيم والأوامر والقرارات الرسمية ذات الصلة.
   - أولوية ثانية: نظام خدمة الأفراد ولائحته التنفيذية وتعديلاته وقراراته وأوامره الرسمية، مع فهرس مستقل للحقوق والضمانات والمزايا. عند ذكر ميزة للفرد العسكري اذكر شروطها وقيودها من المصدر نفسه ولا تنتقِ الجزء المفيد وحده.
   - أولوية ثالثة: المحكمة العليا ونظام القضاء والمحاكم العامة والجزائية والنيابة العامة ونظام المحاماة، ثم نظام مجلس الوزراء والأنظمة والقرارات المنشورة عبر هيئة الخبراء.
   - إذا طلب المستخدم نصاً حرفياً ولم تكن تغطية النص في المستودع full-verified، فلا تنقله من الذاكرة؛ استخدم النص الرسمي المسترجع في الطلب أو صرّح بأن النسخة الحرفية لم تُعتمد بعد.
4. [الفصل التام بين الاختصاصات القضائية]:
   - القضاء الإداري (ديوان المظالم): عيوب القرار والحقوق الوظيفية والعقود والمواعيد وفق النصوص الرسمية المسترجعة فقط.
   - القضاء الجزائي: الإجراءات الجزائية والقبض والتفتيش والتوقيف وحالة التلبس وفق النصوص الرسمية المسترجعة فقط.
   - القضاء العام: نظام المعاملات المدنية، نظام المرافعات الشرعية، نظام الإثبات، أركان المسؤولية التقصيرية والتعويض.
5. [جاهز للإيداع المباشر (Moeen-Ready)]: صياغة مذكرات ولوائح احترافية تبدأ بالبسملة وتنتهي بـ "مقدمه"، تتضمن الوقائع والدفوع والطلبات بشكل مرتب ومفصل.

سقف الرد لا يتجاوز 3500 حرف لضمان استقرار الإرسال القضائي.`;

function getErrorText(err: any): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  return err?.message || err?.error?.message || JSON.stringify(err);
}

function getErrorStatus(err: any): number | undefined {
  const direct = Number(err?.status || err?.code || err?.error?.code);
  if (Number.isFinite(direct)) return direct;

  const raw = getErrorText(err);
  const match = raw.match(/\b(400|401|403|404|408|409|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : undefined;
}

function formatGeminiErrorMessage(err: any): string {
  const raw = getErrorText(err);
  const status = getErrorStatus(err);

  if (status === 429 || /RESOURCE_EXHAUSTED|rate.?limit/i.test(raw)) {
    return "تم تجاوز حد استخدام خدمة الذكاء الاصطناعي مؤقتاً (429). جرّب بعد قليل أو استخدم مفتاح API آخر صالح.";
  }

  if (status === 503 || status === 504 || /UNAVAILABLE|high demand|overloaded/i.test(raw)) {
    return "خدمة الذكاء الاصطناعي غير متاحة مؤقتاً بسبب الضغط. أعد المحاولة بعد لحظات.";
  }

  if (status === 401 || status === 403 || /API_KEY_INVALID|permission denied|unauthorized/i.test(raw)) {
    return "مفتاح Gemini غير صالح أو لا يملك الصلاحية المطلوبة. تحقق من GEMINI_API_KEY في متغيرات البيئة.";
  }

  if (status === 404 || /model.*not found|NOT_FOUND/i.test(raw)) {
    return "تعذر العثور على نموذج Gemini المطلوب. تم تجربة النماذج الاحتياطية المتاحة ولم ينجح أي منها.";
  }

  if (status === 400 || /INVALID_ARGUMENT/i.test(raw)) {
    return "رفض Gemini الطلب بسبب صيغة أو بيانات غير صالحة. تحقق من حجم المرفقات ونوعها ومحتوى الطلب.";
  }

  // لا نعيد رسالة المزود الخام للمستخدم حتى لا تتسرب تفاصيل داخلية.
  return "حدث خطأ أثناء الاتصال بخدمة الذكاء الاصطناعي. راجع سجل الخادم لمعرفة التفاصيل الفنية.";
}

// نماذج مستقرة حالياً. الترتيب من الأقوى إلى الأخف.
const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];

function isRetryableGeminiError(err: any): boolean {
  const status = getErrorStatus(err);
  const raw = getErrorText(err);
  return (
    status === 503 ||
    status === 504 ||
    status === 408 ||
    /UNAVAILABLE|high demand|overloaded|timeout/i.test(raw)
  );
}

function shouldSwitchApiKeyImmediately(err: any): boolean {
  const status = getErrorStatus(err);
  const raw = getErrorText(err);
  return status === 429 || status === 401 || status === 403 || /RESOURCE_EXHAUSTED|API_KEY_INVALID/i.test(raw);
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateStreamWithFallback(
  clients: GoogleGenAI[],
  contents: any[],
  systemInstruction: string,
  temperature: number
) {
  let lastErr: any = null;

  for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
    const ai = clients[clientIndex];

    for (const model of FALLBACK_MODELS) {
      // محاولتان فقط للأخطاء المؤقتة. 429/401/403 ينتقل فوراً للمفتاح التالي.
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const stream = await ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction,
              temperature,
            },
          });
          return { stream, model };
        } catch (err: any) {
          lastErr = err;
          console.warn(
            `[Gemini Stream] key=${clientIndex + 1} model=${model} attempt=${attempt} failed: ${getErrorText(err)}`
          );

          if (shouldSwitchApiKeyImmediately(err)) break;
          if (isRetryableGeminiError(err) && attempt < 2) {
            await delay(700 * attempt);
            continue;
          }
          break;
        }
      }

      // إذا كان المفتاح نفسه محظوراً/مستنفداً فلا فائدة من تجربة موديلات أخرى عليه.
      if (lastErr && shouldSwitchApiKeyImmediately(lastErr)) break;
    }
  }

  throw lastErr || new Error("No Gemini model was available.");
}

async function generateContentWithFallback(
  clients: GoogleGenAI[],
  contents: any,
  systemInstruction: string,
  temperature: number,
  responseMimeType?: "application/json"
) {
  let lastErr: any = null;

  for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
    const ai = clients[clientIndex];

    for (const model of FALLBACK_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              temperature,
              ...(responseMimeType ? { responseMimeType } : {}),
            },
          });
          return res;
        } catch (err: any) {
          lastErr = err;
          console.warn(
            `[Gemini Generate] key=${clientIndex + 1} model=${model} attempt=${attempt} failed: ${getErrorText(err)}`
          );

          if (shouldSwitchApiKeyImmediately(err)) break;
          if (isRetryableGeminiError(err) && attempt < 2) {
            await delay(700 * attempt);
            continue;
          }
          break;
        }
      }

      if (lastErr && shouldSwitchApiKeyImmediately(lastErr)) break;
    }
  }

  throw lastErr || new Error("No Gemini model was available.");
}

function parseModelJson<T = any>(rawText: string): T | null {
  const raw = (rawText || "").trim();
  if (!raw) return null;

  const candidates = [
    raw,
    raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(),
  ];

  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {}
  }

  return null;
}


function normalizeInlineAttachment(att: any): { inlineData: { mimeType: string; data: string } } | null {
  if (!att || typeof att.data !== "string" || !att.data.trim()) return null;

  let mimeType = String(att.type || "application/pdf");
  const name = String(att.name || "").toLowerCase();
  if (mimeType === "application/octet-stream" || !mimeType.includes("/")) {
    if (name.endsWith(".png")) mimeType = "image/png";
    else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) mimeType = "image/jpeg";
    else if (name.endsWith(".webp")) mimeType = "image/webp";
    else mimeType = "application/pdf";
  }

  // يدعم البيانات الخام base64 وكذلك data URLs.
  const data = att.data.includes(",") && att.data.startsWith("data:")
    ? att.data.slice(att.data.indexOf(",") + 1)
    : att.data;

  return { inlineData: { mimeType, data } };
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Local development uses the exact same handlers as Vercel for application-critical routes.
  app.all("/api/session", (req, res) => {
    void sessionHandler(req as any, res as any);
  });
  app.post("/api/ai", (req, res) => {
    void aiHandler(req as any, res as any);
  });
  app.post("/api/chat", (req, res) => {
    void chatHandler(req as any, res as any);
  });
  app.post("/api/convert-story", (req, res) => {
    void convertStoryHandler(req as any, res as any);
  });
  app.post("/api/legal-source-search", (req, res) => {
    void legalSourceSearchHandler(req as any, res as any);
  });
  app.post("/api/admin-analysis", (req, res) => {
    void adminAnalysisHandler(req as any, res as any);
  });
  app.post("/api/judges-review", (req, res) => {
    void judgesReviewHandler(req as any, res as any);
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Server-side authentication. The browser never validates administrator secrets itself.
  app.get("/api/auth", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const session = readSession(req.headers.cookie);
    if (!session) {
      res.status(401).json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, session });
  });

  app.post("/api/auth", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const body = req.body || {};
    const action = String(body.action || "");

    if (action === "register" || action === "login" || action === "admin-login") {
      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
        .split(",")[0]
        .trim()
        .slice(0, 80);
      const limit = allowAuthAttempt(`${action}:${ip}`);
      if (!limit.allowed) {
        res.setHeader("Retry-After", String(limit.retryAfter));
        res.status(429).json({ error: "محاولات كثيرة. حاول مرة أخرى لاحقاً." });
        return;
      }
    }

    try {
      if (action === "register") {
        const { session, accountProof } = registerAccount({
          name: String(body.name || ""),
          email: String(body.email || ""),
          password: String(body.password || ""),
        });
        res.setHeader("Set-Cookie", [clearLegacySessionCookie(), sessionCookie(session)]);
        res.status(201).json({ session, accountProof });
        return;
      }

      if (action === "login") {
        const session = loginAccount({
          email: String(body.email || ""),
          password: String(body.password || ""),
          accountProof: String(body.accountProof || ""),
        });
        res.setHeader("Set-Cookie", [clearLegacySessionCookie(), sessionCookie(session)]);
        res.json({ session });
        return;
      }

      if (action === "admin-login") {
        const session = loginAdmin({
          adminCode: String(body.adminCode || ""),
          password: String(body.password || ""),
        });
        res.setHeader("Set-Cookie", [clearLegacySessionCookie(), sessionCookie(session)]);
        res.json({ session });
        return;
      }

      res.status(400).json({ error: "عملية المصادقة غير معروفة." });
    } catch (error) {
      const mapped = authErrorMessage(error);
      res.status(mapped.status).json({ error: mapped.error });
    }
  });

  app.delete("/api/auth", (_req, res) => {
    res.setHeader("Set-Cookie", [clearSessionCookie(), clearLegacySessionCookie()]);
    res.status(204).end();
  });

  // Chat completion endpoint with SSE streaming
  app.post("/api/chat", async (req, res) => {
    const session = readSession(req.headers.cookie);
    if (!session) {
      res.status(401).json({ error: "يلزم تسجيل الدخول لاستخدام المستشار." });
      return;
    }

    const {
      messages,
      temperature = 0.3,
      powerMode = false,
      targetCourt,
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Messages array is required." });
      return;
    }

    try {
      const aiClients = getGeminiClients();

      // Transform messages into Gemini contents structure supporting multimodal attachments
      const contents = messages.map(
        (m: {
          role: string;
          content: string;
          attachments?: Array<{
            name: string;
            type: string;
            data: string;
            isImage?: boolean;
          }>;
        }) => {
          const parts: any[] = [];

          if (Array.isArray(m.attachments) && m.attachments.length > 0) {
            for (const att of m.attachments) {
              if (att.data) {
                let mimeType = att.type || "application/pdf";
                if (mimeType === "application/octet-stream") {
                  if (att.name?.endsWith(".pdf")) mimeType = "application/pdf";
                  else if (att.name?.endsWith(".png")) mimeType = "image/png";
                  else if (att.name?.endsWith(".jpg") || att.name?.endsWith(".jpeg")) mimeType = "image/jpeg";
                  else if (att.name?.endsWith(".webp")) mimeType = "image/webp";
                  else mimeType = "application/pdf";
                }

                parts.push({
                  inlineData: {
                    mimeType,
                    data: att.data,
                  },
                });
              }
            }
          }

          const trimmedText = m.content?.trim();
          if (trimmedText) {
            parts.push({ text: trimmedText });
          } else if (parts.length > 0) {
            parts.push({
              text: "يرجى فحص وتحليل المستند أو الصورة المرفقة واستخراج الوقائع والنقاط النظامية والدفوع القضائية أمام ديوان المظالم.",
            });
          }

          return {
            role: m.role === "user" ? "user" : "model",
            parts,
          };
        }
      );

      const localReferenceContext = buildOfficialLegalReferenceContext(
        messages.map((message: any) => String(message?.content || "")).join("\n").slice(0, 24000),
        4
      );

      let sysInstruction = `${DEFAULT_LEGAL_SYSTEM_INSTRUCTION}\n\n${localReferenceContext}`;

      if (powerMode) {
        sysInstruction += `\n\n[تفعيل وضع البور القضائي الصارم - أقصى انضباط ومنع التفلسف]:
- امنع الكلام النظري أو المواربة أو التردد نهائياً. ادخل في الدفع القضائي أو صياغة اللائحة فوراً.
- لا تعتبر أي قاعدة قانونية "قطعية" ما لم يكن نصها ومصدرها الرسمي والنسخة النافذة متحققاً منها في مركز المراجع.
- عند وجود تعارض بين معلومة داخلية ومصدر رسمي، قدّم المصدر الرسمي ووسم المعلومة الداخلية بأنها تحتاج مراجعة.
- قدم مخرجات موجزة، صلبة، حاسمة، وتصلح كدفوع جاهزة لتقديمها للقاضي.`;
      }

      if (targetCourt && targetCourt !== 'الكل') {
        sysInstruction += `\n[توجيه الاختصاص: التركيز التام على ${targetCourt}]`;
      }

      // سياق داخلي للمستفيد مع حماية البيانات الشخصية في المخرجات
      const activePersonName = session.name.toString().trim();

      sysInstruction += `\n\n[سياق المعاملة الداخلي والخصوصية]
اسم المستفيد: ${activePersonName}

تعليمات إلزامية لحماية البيانات الشخصية:
- لا تعرض أو تكرر رقم الهوية الوطنية في أي رد أو تحليل أو تقرير.
- إذا ظهر رقم هوية داخل رسالة سابقة أو نص أو مرفق، عامله كبيان خاص ولا تنقله إلى المخرجات.
- لا تستنتج أو تنشئ أرقام هويات أو بيانات تعريفية غير موجودة.
- لا تكرر اسم المستفيد في كل رد؛ استخدمه فقط عند الحاجة السياقية.
- عند صياغة مستند رسمي، لا تُدرج أي رقم هوية إلا إذا طلب المستخدم ذلك صراحة في نفس الطلب.
- ركز المخرجات على الوقائع، الأسانيد، الإجراءات، المواعيد، الأدلة والطلبات دون كشف بيانات شخصية غير لازمة.`;

      const safeTemp = powerMode ? 0.1 : Math.min(Math.max(Number(temperature) || 0.3, 0), 2);

      // Acquire stream with resilient model fallback BEFORE sending SSE headers
      const { stream: responseStream, model: usedModel } =
        await generateStreamWithFallback(aiClients, contents, sysInstruction, safeTemp);

      console.log(`[Gemini] Successfully started streaming using model: ${usedModel}`);

      // Set headers for SSE streaming only once stream is ready
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      for await (const chunk of responseStream) {
        const text = chunk.text || "";
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (err: any) {
      console.error("Gemini chat error:", err);
      const friendlyMessage = formatGeminiErrorMessage(err);

      // If headers already sent, write error in SSE format
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: friendlyMessage })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
      } else {
        const status =
          err?.status === 503 ||
          err?.message?.includes("503") ||
          err?.message?.includes("UNAVAILABLE")
            ? 503
            : err?.status === 429
            ? 429
            : 500;
        res.status(status).json({ error: friendlyMessage });
      }
    }
  });

  // Prompt enhancement endpoint
  app.post("/api/enhance-prompt", async (req, res) => {
    const session = readSession(req.headers.cookie);
    if (!session) {
      res.status(401).json({ error: "يلزم تسجيل الدخول لاستخدام هذه الخدمة." });
      return;
    }
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "Prompt text is required." });
      return;
    }

    try {
      const aiClients = getGeminiClients();

      const instruction = `أنت مستشار قضائي أول وخبير بصياغة الدفوع أمام ديوان المظالم السعودي. قم بإعادة صياغة استفسار أو طلب المستخدم ليكون طلباً واستشارة قضائية إدارية احترافية، محكمة الألفاظ، مستندة للقواعد الإجرائية والموضوعية، مع بيان الوقائع المطلوب فحصها (تاريخ القرار، عيوب المشروعية، التظلم الوجوبي، السوابق القضائية). أرجع النص المصاغ مباشرة دون أي مقدمات أو هوامش.`;
      const promptContent = `أعد صياغة وتطوير الاستفسار/الطلب القضائي التالي ليصبح طلباً محكماً أمام ديوان المظالم السعودي:\n\n"""${prompt}"""`;

      const response = await generateContentWithFallback(
        aiClients,
        promptContent,
        instruction,
        0.3
      );

      const enhanced = response.text?.trim() || prompt;
      res.json({ enhancedPrompt: enhanced });
    } catch (err: any) {
      console.error("Enhance prompt error:", err);
      res.status(500).json({ error: formatGeminiErrorMessage(err) });
    }
  });

  // Convert plain user narrative or pasted text ("صار كذا كذا") to formal Saudi legal articles & claims
  app.post("/api/convert-story", async (req, res) => {
    const session = readSession(req.headers.cookie);
    if (!session) {
      res.status(401).json({ error: "يلزم تسجيل الدخول لاستخدام هذه الخدمة." });
      return;
    }
    const { story, court = "administrative" } = req.body;

    if (!story || typeof story !== "string" || !story.trim()) {
      res.status(400).json({ error: "يُرجى كتابة ما حدث أو لصق النص." });
      return;
    }

    try {
      const aiClients = getGeminiClients();

      let courtName = "المحاكم الإدارية (ديوان المظالم)";
      if (court === "criminal") {
        courtName = "المحاكم الجزائية (نظام الإجراءات الجزائية)";
      } else if (court === "general") {
        courtName = "المحاكم العامة (نظام المعاملات المدنية ونظام الإثبات)";
      }

      const systemInstruction = `أنت قاضٍ ومستشار قانوني سعودي. اقرأ قصة المستخدم العادية أو النص العشوائي، وقم بـ 'تكييفها نظامياً' بناءً على الاختصاص المختار (${courtName}). استخرج الأسانيد والمواد النظامية الدقيقة من القوانين السعودية فقط. أرجع استجابتك بصيغة JSON تحتوي على 3 مفاتيح فقط:
subject: (موضوع الدعوى بصياغة قانونية قصيرة).
legal_bases: (مصفوفة Array تحتوي على أرقام المواد والمراسيم والأنظمة المستند إليها).
requests: (مصفوفة Array للطلبات الختامية المتوقعة من المحكمة).`;

      const response = await generateContentWithFallback(
        aiClients,
        `نص قصة المستخدم أو النص المنسوخ:\n"""\n${story}\n"""\n\nأرجع كائن JSON الصارم بالـ 3 مفاتيح فقط بدون أي تعليق خارج JSON.`,
        systemInstruction,
        0.1,
        "application/json"
      );

      const raw = response.text?.trim() || "";
      const parsed = parseModelJson<any>(raw);

      if (!parsed || typeof parsed !== "object") {
        res.status(502).json({
          error: "تعذر قراءة نتيجة التحليل بصيغة صحيحة. أعد المحاولة؛ لم يتم إنشاء أي أسانيد أو طلبات افتراضية.",
          retryable: true,
        });
        return;
      }

      const subject = String(parsed.subject || parsed.disputedSubject || "").trim();
      const legal_bases = Array.isArray(parsed.legal_bases)
        ? parsed.legal_bases.map(String).filter(Boolean)
        : typeof parsed.legal_bases === "string" && parsed.legal_bases.trim()
        ? [parsed.legal_bases.trim()]
        : Array.isArray(parsed.legalBases)
        ? parsed.legalBases.map(String).filter(Boolean)
        : typeof parsed.legalBases === "string" && parsed.legalBases.trim()
        ? [parsed.legalBases.trim()]
        : [];

      const requests = Array.isArray(parsed.requests)
        ? parsed.requests.map(String).filter(Boolean)
        : typeof parsed.requests === "string" && parsed.requests.trim()
        ? [parsed.requests.trim()]
        : Array.isArray(parsed.claimDemands)
        ? parsed.claimDemands.map(String).filter(Boolean)
        : typeof parsed.claimDemands === "string" && parsed.claimDemands.trim()
        ? [parsed.claimDemands.trim()]
        : [];

      if (!subject || (legal_bases.length === 0 && requests.length === 0)) {
        res.status(502).json({
          error: "رجعت خدمة الذكاء الاصطناعي بنتيجة ناقصة. أعد المحاولة؛ لم يتم تعويض النقص بمواد أو طلبات مختلقة.",
          retryable: true,
        });
        return;
      }

      res.json({
        subject,
        legal_bases,
        requests,
        disputedSubject: subject,
        legalBases: legal_bases.map((b: string) => `- ${b}`).join("\n"),
        claimDemands: requests.map((r: string, idx: number) => `${idx + 1}. ${r}`).join("\n"),
      });
    } catch (err: any) {
      console.error("Convert story error:", err);
      res.status(500).json({ error: formatGeminiErrorMessage(err) });
    }
  });

  // Cassation & Judicial Audit endpoint (هيئة رقابة القضاء الموسعة: الإدارية، الجزائية، العامة - قاضيان لكل محكمة)
  app.post("/api/cassation-audit", async (req, res) => {
    const session = readSession(req.headers.cookie);
    if (!session) {
      res.status(401).json({ error: "يلزم تسجيل الدخول لاستخدام هذه الخدمة." });
      return;
    }
    const { text, attachments, targetCourt, clientPersonName } = req.body;

    if ((!text || typeof text !== "string" || !text.trim()) && (!attachments || attachments.length === 0)) {
      res.status(400).json({ error: "النص أو المرفق مطلوب لإجراء فحص قضاة النقض والمحاكم." });
      return;
    }

    try {
      const aiClients = getGeminiClients();

      const systemInstruction = `أنت تمثل هيئة رقابة وتدقيق قضائية عليا سعودية تضم 6 قضاة متخصصين موزعين على ثلاثة اختصاصات قضائية (قاضيان لكل محكمة):

أولاً: قضاة المحكمة الإدارية (ديوان المظالم):
1. [judge_admin_1]: مراجع الإجراءات الإدارية (قاضي دائرة فحص الطعون والشكل الإجرائي بالمحكمة الإدارية العليا - م/8 مواعيد التظلم والطعن خلال 30 يوماً ومحكمة القانون).
2. [judge_admin_2]: مراجع الطعون الإدارية (قاضي دائرة الطعون الإدارية - رقابة عيوب القرار الإداري والتعويض والخطأ المرفقي ومبادئ المحكمة الإدارية العليا).

ثانياً: قضاة المحكمة الجزائية:
3. [judge_crim_1]: مراجع الإجراءات الجزائية (قاضي الدائرة الجزائية المشتركة - رقابة صحة وبطلان إجراءات القبض والتفتيش والتلبس ومشروعية التوقيف وفق نظام الإجراءات الجزائية).
4. [judge_crim_2]: مراجع الطعون الجزائية (قاضي تدقيق الأحكام الجزائية والطعون - درء الحدود والشبهات ونفي التهم بالأدلة الرقمية والمادية وكشوفات الغيبة Alibi).

ثالثاً: قضاة المحكمة العامة:
5. [judge_gen_1]: مراجع الدعاوى الحقوقية (قاضي الدائرة الحقوقية والمدنية - رقابة شروط الدعوى، الالتزامات والعقود، والضمان والمسؤولية التقصيرية والتعويض).
6. [judge_gen_2]: مراجع الاستئناف العام (قاضي دائرة الاستئناف العام - تدقيق وسائل الإثبات، الدفوع الشكلية، وقواعد نظام الإثبات ونظام المرافعات الشرعية).

مهمتكم الصارمة: مراقبة وتحليل ما رفعه المستخدم (مذكرة، مرفوع، لائحة اعتراضية، دعوى، استئناف، التماس، أو صك حكم) واستخراج مكامن "الخلل" أو "البطلان" أو "القصور" أو "سقوط الميعاد" أو "إهدار الدليل القاطع".

يجب إرجاع النتيجة حصراً بصيغة JSON نظيف بالهيكل التالي:
{
  "documentType": "مذكرة" | "مرفوع" | "لائحة" | "اعتراض" | "دعوى" | "التماس",
  "overallStatus": "جاهز للإيداع" | "معيب بحاجة لتصحيح" | "خطر السقوط الشكلي",
  "primaryFatalDefect": "وصف دقيق للخلل الجوهري الأبرز إن وجد أو بيان السلامة",
  "judges": [
    {
      "judgeId": "judge_admin_1",
      "judgeName": "مراجع الإجراءات الإدارية",
      "judgeTitle": "قاضي دائرة فحص الطعون والشكل الإجرائي بالمحكمة الإدارية العليا",
      "courtCategory": "المحكمة الإدارية",
      "verdict": "مقبول شكلاً وموضوعاً" | "مرفوض شكلاً" | "معيب موضوعاً" | "بحاجة لتصحيح جوهري",
      "fatalFlaws": ["نقطة خلل محددة"],
      "proceduralCritique": "تحليل صارم للميعاد، الصفة، المصلحة، الاختصاص، والتظلم الوجوبي",
      "substantiveCritique": "مدى سلامة الاقتصار على أسباب الطعن وحظر الجدل الوقائعي",
      "actionableRemedy": "خطوة عملية حاسمة لتدارك الخلل الإجرائي",
      "scoreOutOf100": 85
    },
    {
      "judgeId": "judge_admin_2",
      "judgeName": "مراجع الطعون الإدارية",
      "judgeTitle": "قاضي دائرة الطعون الإدارية والتعويض بمجلس القضاء الإداري",
      "courtCategory": "المحكمة الإدارية",
      "verdict": "مقبول شكلاً وموضوعاً" | "مرفوض شكلاً" | "معيب موضوعاً" | "بحاجة لتصحيح جوهري",
      "fatalFlaws": ["نقطة خلل موضوعية في تطبيق النظام وتأويله"],
      "proceduralCritique": "رقابة التسبيب وتأصيل مخالفة النصوص الإدارية الآمرة",
      "substantiveCritique": "تفكيك ذريعة السلطة التقديرية للإدارة، وتحديد عيب القرار الإداري والخطأ المرفقي",
      "actionableRemedy": "توجيه قضائي حاسم لصياغة الدفع الإداري",
      "scoreOutOf100": 80
    },
    {
      "judgeId": "judge_crim_1",
      "judgeName": "مراجع الإجراءات الجزائية",
      "judgeTitle": "قاضي الدائرة الجزائية المشتركة - رقابة بطلان الإجراءات والتوقيف",
      "courtCategory": "المحكمة الجزائية",
      "verdict": "مقبول شكلاً وموضوعاً" | "مرفوض شكلاً" | "معيب موضوعاً" | "بحاجة لتصحيح جوهري",
      "fatalFlaws": ["خلل في مراعاة حالات التلبس ومشروعية القبض والتفتيش أو ميعاد الاحتجاز"],
      "proceduralCritique": "رقابة المادتين 35 و43 من نظام الإجراءات الجزائية والتفتيش دون إذن",
      "substantiveCritique": "بيان بطلان ما بني على إجراء باطل وسقوط قوة المحاضر المطعون في مشروعيتها",
      "actionableRemedy": "الدفع الصريح ببطلان القبض ومصادرة آثاره الجنائية والتمسك بالبراءة",
      "scoreOutOf100": 82
    },
    {
      "judgeId": "judge_crim_2",
      "judgeName": "مراجع الطعون الجزائية",
      "judgeTitle": "قاضي تدقيق الأحكام الجزائية والطعون ودرء الشبهات",
      "courtCategory": "المحكمة الجزائية",
      "verdict": "مقبول شكلاً وموضوعاً" | "مرفوض شكلاً" | "معيب موضوعاً" | "بحاجة لتصحيح جوهري",
      "fatalFlaws": ["وهن أدلة الإثبات وتجاهل أدلة النفي القاطعة"],
      "proceduralCritique": "رقابة شروط الشهادة المعتبرة وسقوط الشهادة الظنية العاجزة عن تمييز الملامح بالظلام",
      "substantiveCritique": "تفعيل قاعدة الأحكام الجزائية تبنى على الجزم واليقين لا الشك والتخمين ودليل الغيبة",
      "actionableRemedy": "حصر أوجه الطعن الجزائي في انقطاع رابطة السببية وثبوت البراءة الأصلية",
      "scoreOutOf100": 88
    },
    {
      "judgeId": "judge_gen_1",
      "judgeName": "مراجع الدعاوى الحقوقية",
      "judgeTitle": "قاضي الدائرة الحقوقية والمدنية بالمحكمة العامة",
      "courtCategory": "المحكمة العامة",
      "verdict": "مقبول شكلاً وموضوعاً" | "مرفوض شكلاً" | "معيب موضوعاً" | "بحاجة لتصحيح جوهري",
      "fatalFlaws": ["نقص في تحرير دعوى المطالبة أو ركن الضرر والمسؤولية المدنية والتعويض"],
      "proceduralCritique": "رقابة شروط المادة 41 مرافعات في تحرير الطلبات الجازمة وحصر الالتزامات",
      "substantiveCritique": "إثبات أركان المسؤولية التقصيرية والضمان (التعدي والضرر وعلاقة السببية الحتمية)",
      "actionableRemedy": "تحديد تقدير التعويض المالي بالأدلة والسندات البنكية والعقود الملزمة",
      "scoreOutOf100": 79
    },
    {
      "judgeId": "judge_gen_2",
      "judgeName": "مراجع الاستئناف العام",
      "judgeTitle": "قاضي دائرة الاستئناف العام وتدقيق الإثباتات والشكليات",
      "courtCategory": "المحكمة العامة",
      "verdict": "مقبول شكلاً وموضوعاً" | "مرفوض شكلاً" | "معيب موضوعاً" | "بحاجة لتصحيح جوهري",
      "fatalFlaws": ["قصور في توثيق الدليل الكتابي أو حجية المحررات الرسمية والقرائن"],
      "proceduralCritique": "رقابة الالتزام بأحكام نظام الإثبات ونظام المرافعات الشرعية",
      "substantiveCritique": "إعمال قواعد استصحاب الأصل وحجية الأحكام النهائية المكتسبة للقطعية",
      "actionableRemedy": "إرفاق صك الحكم النهائي القاطع وبيان استحقاق التعويض المادي والمعنوي",
      "scoreOutOf100": 84
    }
  ],
  "synthesisAdvice": "توصية قضائية ختامية موحدة لتدارك أي بطلان أو قصور قبل إيداع المرفوع في المنظومة القضائية."
}

مهم: يجب ألا يحتوي JSON على رقم الهوية الوطنية أو أي معرّف شخصي حساس، حتى لو ظهر في المستندات.
أرجع JSON فقط بدون أي علامات markdown إضافية قدر الإمكان.`;

      const auditPersonName = (clientPersonName || 'صاحب الشأن').toString().trim();

      let promptContent = `قم بمراقبة وفحص ما يلي بدقة متناهية وتحديد مواطن الخلل والبطلان وتطبيق النصوص واللوائح:

【سياق داخلي للمعاملة】
المستفيد: ${auditPersonName}

【تعليمات الخصوصية】
- لا تعرض رقم الهوية الوطنية أو أي معرّف شخصي حساس في التقرير.
- إذا ظهر رقم هوية داخل النص أو المرفقات، استخدمه فقط لفهم المستند ولا تنقله إلى JSON أو التوصية.
- لا تكرر اسم المستفيد إلا إذا كان لازماً لفهم النتيجة.
- لا تنسب للمستفيد أي بيانات لم ترد في النص أو المرفقات.

【المادة محل الفحص】
"""${text || "المرفوع والمستندات المرفقة"}"""`;

      if (targetCourt && targetCourt !== 'الكل') {
        promptContent += `\n\nتوجيه حاسم ومحدد: يطلب المستخدم فحص هذه القضية حصراً أو بالتركيز التام على اختصاص [${targetCourt}].
إذا كان الاختصاص هو (المحكمة الإدارية): ركز على قرارات ديوان المظالم، المادة 8 مواعيد التظلم (60 يوماً)، عيوب القرار الإداري، الخطأ المرفقي، والحقوق الوظيفية والبدلات.
إذا كان الاختصاص هو (المحكمة الجزائية): ركز على نظام الإجراءات الجزائية، بطلان القبض والتفتيش والتوقيف الاحتياطي (المادتين 35 و43)، انعدام التلبس، درء الشبهات، والتعويض عن الحبس غير المشروع.
إذا كان الاختصاص هو (المحكمة العامة): ركز على نظام المرافعات الشرعية، نظام الإثبات، شروط الدعوى، المسؤولية التقصيرية والمدنية، أركان الضرر والتعويض المالي والعقود.
احرص على أن تكون أحكام وآراء قضاة [${targetCourt}] مفصلة وعميقة ومباشرة لموضوع المرفوع.`;
      }

      const auditParts: any[] = [{ text: promptContent }];
      if (Array.isArray(attachments) && attachments.length > 0) {
        const names = attachments.map((a: any) => a?.name).filter(Boolean).join("، ");
        auditParts.push({
          text: `\n\nالمرفقات المودعة (${attachments.length})${names ? `: ${names}` : ""}. افحص محتوى المرفقات نفسها واربط ملاحظاتك بما يظهر فيها فقط.`,
        });

        for (const att of attachments) {
          const inline = normalizeInlineAttachment(att);
          if (inline) auditParts.push(inline);
        }
      }

      const auditContents = [{ role: "user", parts: auditParts }];
      const response = await generateContentWithFallback(
        aiClients,
        auditContents,
        systemInstruction,
        0.2,
        "application/json"
      );

      const raw = response.text?.trim() || "";
      const parsed: any = parseModelJson<any>(raw);

      if (!parsed || !Array.isArray(parsed.judges)) {
        res.status(502).json({
          error: "تعذر تكوين تقرير التدقيق القضائي بصيغة موثوقة. أعد المحاولة؛ تم إيقاف التقرير الاحتياطي الثابت حتى لا تُنسب للقضية وقائع أو مواد لم يرسلها المستخدم.",
          retryable: true,
        });
        return;
      }

      // Backward compatibility for components expecting judge1 and judge2
      if (parsed.judges && parsed.judges.length >= 2) {
        parsed.judge1 = parsed.judges[0];
        parsed.judge2 = parsed.judges[1];
      }

      parsed.timestamp = Date.now();
      if (targetCourt) {
        parsed.targetCourt = targetCourt;
      }
      res.json({ auditReport: parsed });
    } catch (err: any) {
      console.error("Judicial audit error:", err);
      res.status(500).json({ error: formatGeminiErrorMessage(err) });
    }
  });

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
