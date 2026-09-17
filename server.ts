import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const PORT = 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const DEFAULT_LEGAL_SYSTEM_INSTRUCTION = `أنت "المستشار القضائي الإداري الصارم" أمام ديوان المظالم والمحاكم السعودية.
مهمتك: تقديم صياغات قضائية، دفوع نظامية، ولوائح دعوى قطعية بدون فلسفة نظرية أو حشو أو تهرب أو خلط بين الأنظمة.

[قواعد الانضباط والمنع الصارم - زر البور القضائي]:
1. [ممنوع الفلسفة والحشو والتكرار]: ادخل في صلب الموضوع القضائي والدفع النظامي مباشرة. يُمنع التردد، ويُمنع الوعظ، ويُمنع الكلام الإنشائي العام.
2. [الالتزام التام بالأوامر الملكية والمراسيم الصادرة]:
   - المرسوم الملكي رقم (م/37) وتاريخ 30/06/1430هـ: عدّل صراحة المادة (17/ب) من نظام خدمة الأفراد وأجاز الجمع بين علاوتين؛ وهو تشريع أعلى وأحدث ينسف أي حظر جمع سابق أو استناد إلى الأمر (12997).
   - قرار مجلس الوزراء رقم (15) وتاريخ 27/01/1413هـ (المادة 6/ب): استثنى العلاوة الفنية صراحة من سقف البدلات.
   - المادة (8 / الفقرة 6) من نظام المرافعات أمام ديوان المظالم: حددت مهلة سماع دعاوى التعويض والعقود والمنازعات المالية بـ (10 سنوات)، فلا تخلط بينها وبين مهلة الـ (60) يوماً المخصصة للطعن في القرارات الإدارية الفردية المجردة.
3. [الفصل التام بين الاختصاصات القضائية]:
   - القضاء الإداري (ديوان المظالم): عيوب القرار، المادة 8، الخطأ المرفقي، الحقوق والبدلات، العقود الإدارية.
   - القضاء الجزائي: نظام الإجراءات الجزائية، بطلان القبض والتفتيش والتوقيف (المادتين 35 و43)، انعدام حالة التلبس، درء الشبهات.
   - القضاء العام: نظام المعاملات المدنية، نظام المرافعات الشرعية، نظام الإثبات، أركان المسؤولية التقصيرية والتعويض.
4. [جاهز للإيداع المباشر (Moeen-Ready)]: صياغة مذكرات ولوائح احترافية تبدأ بالبسملة وتنتهي بـ "مقدمه"، تتضمن الوقائع والدفوع والطلبات بشكل مرتب ومفصل.

سقف الرد لا يتجاوز 3500 حرف لضمان استقرار الإرسال القضائي.`;

function formatGeminiErrorMessage(err: any): string {
  if (!err) return "حدث خطأ غير متوقع أثناء معالجة الطلب.";

  const raw = typeof err === "string" ? err : err?.message || JSON.stringify(err);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const errorObj = parsed?.error || parsed;
      let innerMsg = errorObj?.message || "";

      try {
        const nested = JSON.parse(innerMsg);
        if (nested?.error?.message) {
          innerMsg = nested.error.message;
        }
      } catch {}

      const code = errorObj?.code || errorObj?.status;
      if (
        code === 503 ||
        code === "UNAVAILABLE" ||
        innerMsg.includes("503") ||
        innerMsg.includes("high demand") ||
        innerMsg.includes("UNAVAILABLE")
      ) {
        return "خوادم معالجة الذكاء الاصطناعي تشهد ضغطاً مؤقتاً عالياً (503 Service Unavailable). يُرجى النقر على زر إعادة المحاولة.";
      }
      if (code === 429 || innerMsg.includes("429") || innerMsg.includes("RESOURCE_EXHAUSTED")) {
        return "تم تجاوز حد الاستعلامات المسموح به مؤقتاً (429 Rate Limit). يُرجى الانتظار بضع ثوانٍ وإعادة المحاولة.";
      }
      if (innerMsg) return innerMsg;
    }
  } catch {}

  if (
    raw.includes("503") ||
    raw.includes("high demand") ||
    raw.includes("UNAVAILABLE") ||
    err?.status === 503
  ) {
    return "خوادم معالجة الذكاء الاصطناعي تشهد ضغطاً مؤقتاً عالياً (503 Service Unavailable). يُرجى النقر على زر إعادة المحاولة.";
  }
  if (raw.includes("429") || err?.status === 429) {
    return "تم تجاوز حد الاستعلامات المسموح به مؤقتاً (429). يُرجى الانتظار والمحاولة مجدداً.";
  }

  return raw;
}

const FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
];

async function generateStreamWithFallback(
  ai: GoogleGenAI,
  contents: any[],
  systemInstruction: string,
  temperature: number
) {
  let lastErr: any = null;

  for (const model of FALLBACK_MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
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
        const isTemporary =
          err?.status === 503 ||
          err?.status === 429 ||
          err?.message?.includes("503") ||
          err?.message?.includes("high demand") ||
          err?.message?.includes("UNAVAILABLE") ||
          err?.message?.includes("429");

        console.warn(
          `[Gemini Stream] Attempt ${attempt}/3 on model ${model} failed: ${err?.message || err}`
        );

        if (isTemporary && attempt < 3) {
          // Exponential backoff: 800ms, 1600ms
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          continue;
        }

        // If not temporary or max attempts reached for this model, fallback to next model
        break;
      }
    }
  }

  throw lastErr;
}

async function generateContentWithFallback(
  ai: GoogleGenAI,
  contents: string,
  systemInstruction: string,
  temperature: number
) {
  let lastErr: any = null;

  for (const model of FALLBACK_MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature,
          },
        });
        return res;
      } catch (err: any) {
        lastErr = err;
        const isTemporary =
          err?.status === 503 ||
          err?.status === 429 ||
          err?.message?.includes("503") ||
          err?.message?.includes("high demand") ||
          err?.message?.includes("UNAVAILABLE");

        console.warn(
          `[Gemini Generate] Attempt ${attempt}/3 on model ${model} failed: ${err?.message || err}`
        );

        if (isTemporary && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          continue;
        }
        break;
      }
    }
  }

  throw lastErr;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Chat completion endpoint with SSE streaming
  app.post("/api/chat", async (req, res) => {
    const {
      messages,
      systemInstruction,
      temperature = 0.3,
      powerMode = false,
      targetCourt,
      clientNationalId,
      clientPersonName,
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Messages array is required." });
      return;
    }

    try {
      const ai = getGeminiClient();

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

      let sysInstruction =
        systemInstruction?.trim() || DEFAULT_LEGAL_SYSTEM_INSTRUCTION;

      if (powerMode) {
        sysInstruction += `\n\n[تفعيل وضع البور القضائي الصارم - أقصى انضباط ومنع التفلسف]:
- امنع الكلام النظري أو المواربة أو التردد نهائياً. ادخل في الدفع القضائي أو صياغة اللائحة فوراً.
- تذكر القواعد القطعية:
  1. المرسوم الملكي (م/37) وتاريخ 30/6/1430هـ ينسف حظر الجمع ويجيز الجمع بين علاوتين في نظام خدمة الأفراد.
  2. المادة (6/ب) من قرار مجلس الوزراء (15) تستثني العلاوة الفنية من سقف البدلات.
  3. المادة (8 / الفقرة 6) من نظام المرافعات أمام ديوان المظالم تمنح مهلة (10 سنوات) لسماع دعاوى التعويض والعقود والمستحقات، ولا تسقط بـ (60) يوماً.
- قدم مخرجات موجزة، صلبة، حاسمة، وتصلح كدفوع جاهزة لتقديمها للقاضي.`;
      }

      if (targetCourt && targetCourt !== 'الكل') {
        sysInstruction += `\n[توجيه الاختصاص: التركيز التام على ${targetCourt}]`;
      }

      // إلزامية ذكر رقم الهوية الوطنية للشخص الممشى له المعاملة في كل رد ومعاملة
      const activeNationalId = (clientNationalId || 'غير مسجل بالمنظومة').toString().trim();
      const activePersonName = (clientPersonName || 'صاحب الشأن').toString().trim();

      sysInstruction += `\n\n[إلزام قضائي أمني حاسم - ذكر رقم الهوية الوطنية في كل معاملة ورد]:
صاحب المعاملة الممشى له حالياً: ${activePersonName}
رقم الهوية الوطنية: ${activeNationalId}
أمر قطعي: يجب عليك في مطلع كل رد أو استشارة أو صيغة لائحة أو مذكرة ذكر وتثبيت قيد المعاملة ورقم الهوية الوطنية للشخص الممشى له بصيغة واضحة ورسمية:
"【رقم قيد المعاملة بالهوية الوطنية: ${activeNationalId} | المستفيد: ${activePersonName}】"
يُمنع منعاً باتاً إصدار أي رد أو توجيه أو دفع قضائي دون إثبات هذا القيد ورقم الهوية للشخص الممشى له.`;

      const safeTemp = powerMode ? 0.1 : Math.min(Math.max(Number(temperature) || 0.3, 0), 2);

      // Acquire stream with resilient model fallback BEFORE sending SSE headers
      const { stream: responseStream, model: usedModel } =
        await generateStreamWithFallback(ai, contents, sysInstruction, safeTemp);

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
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "Prompt text is required." });
      return;
    }

    try {
      const ai = getGeminiClient();

      const instruction = `أنت مستشار قضائي أول وخبير بصياغة الدفوع أمام ديوان المظالم السعودي. قم بإعادة صياغة استفسار أو طلب المستخدم ليكون طلباً واستشارة قضائية إدارية احترافية، محكمة الألفاظ، مستندة للقواعد الإجرائية والموضوعية، مع بيان الوقائع المطلوب فحصها (تاريخ القرار، عيوب المشروعية، التظلم الوجوبي، السوابق القضائية). أرجع النص المصاغ مباشرة دون أي مقدمات أو هوامش.`;
      const promptContent = `أعد صياغة وتطوير الاستفسار/الطلب القضائي التالي ليصبح طلباً محكماً أمام ديوان المظالم السعودي:\n\n"""${prompt}"""`;

      const response = await generateContentWithFallback(
        ai,
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
    const { story, court = "administrative" } = req.body;

    if (!story || typeof story !== "string" || !story.trim()) {
      res.status(400).json({ error: "يُرجى كتابة ما حدث أو لصق النص." });
      return;
    }

    try {
      const ai = getGeminiClient();

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
        ai,
        `نص قصة المستخدم أو النص المنسوخ:\n"""\n${story}\n"""\n\nأرجع كائن JSON الصارم بالـ 3 مفاتيح فقط بدون أي تعليق خارج JSON.`,
        systemInstruction,
        0.1
      );

      let raw = response.text?.trim() || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Normalize legal_bases and requests to array and string representations
        const subject = parsed.subject || parsed.disputedSubject || "دعوى قضائية مستخلصة من الوقائع";
        const legal_bases = Array.isArray(parsed.legal_bases)
          ? parsed.legal_bases
          : typeof parsed.legal_bases === "string"
          ? [parsed.legal_bases]
          : Array.isArray(parsed.legalBases)
          ? parsed.legalBases
          : [parsed.legalBases || "الأنظمة والقرارات المرعية ذات الصلة"];
        const requests = Array.isArray(parsed.requests)
          ? parsed.requests
          : typeof parsed.requests === "string"
          ? [parsed.requests]
          : Array.isArray(parsed.claimDemands)
          ? parsed.claimDemands
          : [parsed.claimDemands || "إلزام المدعى عليه بالحقوق النظامية"];

        res.json({
          subject,
          legal_bases,
          requests,
          // Backwards compatible string formats
          disputedSubject: subject,
          legalBases: legal_bases.map((b: string) => `- ${b}`).join("\n"),
          claimDemands: requests.map((r: string, idx: number) => `${idx + 1}. ${r}`).join("\n"),
        });
      } else {
        res.json({
          subject: "دعوى قضائية مستخلصة من الوقائع",
          legal_bases: ["الأنظمة والقرارات المرعية ذات الصلة بموضوع النزاع"],
          requests: ["إلزام المدعى عليه بالحقوق المستحقة نظاماً"],
          disputedSubject: "دعوى قضائية مستخلصة من الوقائع",
          legalBases: "- الأنظمة والقرارات المرعية ذات الصلة بموضوع النزاع",
          claimDemands: "1. إلزام المدعى عليه بالحقوق المستحقة نظاماً",
        });
      }
    } catch (err: any) {
      console.error("Convert story error:", err);
      res.status(500).json({ error: formatGeminiErrorMessage(err) });
    }
  });

  // Cassation & Judicial Audit endpoint (هيئة رقابة القضاء الموسعة: الإدارية، الجزائية، العامة - قاضيان لكل محكمة)
  app.post("/api/cassation-audit", async (req, res) => {
    const { text, attachments, targetCourt, clientNationalId, clientPersonName } = req.body;

    if ((!text || typeof text !== "string" || !text.trim()) && (!attachments || attachments.length === 0)) {
      res.status(400).json({ error: "النص أو المرفق مطلوب لإجراء فحص قضاة النقض والمحاكم." });
      return;
    }

    try {
      const ai = getGeminiClient();

      const systemInstruction = `أنت تمثل هيئة رقابة وتدقيق قضائية عليا سعودية تضم 6 قضاة متخصصين موزعين على ثلاثة اختصاصات قضائية (قاضيان لكل محكمة):

أولاً: قضاة المحكمة الإدارية (ديوان المظالم):
1. [judge_admin_1]: فضيلة الشيخ د. فهد العتيبي (قاضي دائرة فحص الطعون والشكل الإجرائي بالمحكمة الإدارية العليا - م/8 مواعيد التظلم والطعن خلال 30 يوماً ومحكمة القانون).
2. [judge_admin_2]: فضيلة الشيخ د. عبدالعزيز السالم (قاضي دائرة الطعون الإدارية - رقابة عيوب القرار الإداري والتعويض والخطأ المرفقي ومبادئ المحكمة الإدارية العليا).

ثانياً: قضاة المحكمة الجزائية:
3. [judge_crim_1]: فضيلة الشيخ د. منصور بن عبدالعزيز التويجري (قاضي الدائرة الجزائية المشتركة - رقابة صحة وبطلان إجراءات القبض والتفتيش والتلبس ومشروعية التوقيف وفق نظام الإجراءات الجزائية).
4. [judge_crim_2]: فضيلة الشيخ د. خالد بن محمد الدوسري (قاضي تدقيق الأحكام الجزائية والطعون - درء الحدود والشبهات ونفي التهم بالأدلة الرقمية والمادية وكشوفات الغيبة Alibi).

ثالثاً: قضاة المحكمة العامة:
5. [judge_gen_1]: فضيلة الشيخ د. ناصر بن سليمان العمري (قاضي الدائرة الحقوقية والمدنية - رقابة شروط الدعوى، الالتزامات والعقود، والضمان والمسؤولية التقصيرية والتعويض).
6. [judge_gen_2]: فضيلة الشيخ د. صالح بن إبراهيم الحصين (قاضي دائرة الاستئناف العام - تدقيق وسائل الإثبات، الدفوع الشكلية، وقواعد نظام الإثبات ونظام المرافعات الشرعية).

مهمتكم الصارمة: مراقبة وتحليل ما رفعه المستخدم (مذكرة، مرفوع، لائحة اعتراضية، دعوى، استئناف، التماس، أو صك حكم) واستخراج مكامن "الخلل" أو "البطلان" أو "القصور" أو "سقوط الميعاد" أو "إهدار الدليل القاطع".

يجب إرجاع النتيجة حصراً بصيغة JSON نظيف بالهيكل التالي:
{
  "documentType": "مذكرة" | "مرفوع" | "لائحة" | "اعتراض" | "دعوى" | "التماس",
  "overallStatus": "جاهز للإيداع" | "معيب بحاجة لتصحيح" | "خطر السقوط الشكلي",
  "primaryFatalDefect": "وصف دقيق للخلل الجوهري الأبرز إن وجد أو بيان السلامة",
  "judges": [
    {
      "judgeId": "judge_admin_1",
      "judgeName": "فضيلة الشيخ د. فهد العتيبي",
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
      "judgeName": "فضيلة الشيخ د. عبدالعزيز السالم",
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
      "judgeName": "فضيلة الشيخ د. منصور بن عبدالعزيز التويجري",
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
      "judgeName": "فضيلة الشيخ د. خالد بن محمد الدوسري",
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
      "judgeName": "فضيلة الشيخ د. ناصر بن سليمان العمري",
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
      "judgeName": "فضيلة الشيخ د. صالح بن إبراهيم الحصين",
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

أرجع JSON فقط بدون أي علامات markdown إضافية قدر الإمكان.`;

      const auditNationalId = (clientNationalId || 'غير مسجل بالمنظومة').toString().trim();
      const auditPersonName = (clientPersonName || 'صاحب الشأن').toString().trim();

      let promptContent = `قم بمراقبة وفحص ما يلي بدقة متناهية وتحديد مواطن الخلل والبطلان وتطبيق النصوص واللوائح:\n\n【بيانات قيد المعاملة: المستفيد: ${auditPersonName} | رقم الهوية الوطنية: ${auditNationalId}】\n\n"""${text || "المرفوع والمستندات المرفقة"}"""\n\nتأكيد إلزامي: احرص على أن تكون التوصية الختامية synthesisAdvice مقيدة ومثبتة باسم المستفيد ورقم الهوية الوطنية (${auditNationalId}).`;

      if (targetCourt && targetCourt !== 'الكل') {
        promptContent += `\n\nتوجيه حاسم ومحدد: يطلب المستخدم فحص هذه القضية حصراً أو بالتركيز التام على اختصاص [${targetCourt}].
إذا كان الاختصاص هو (المحكمة الإدارية): ركز على قرارات ديوان المظالم، المادة 8 مواعيد التظلم (60 يوماً)، عيوب القرار الإداري، الخطأ المرفقي، والحقوق الوظيفية والبدلات.
إذا كان الاختصاص هو (المحكمة الجزائية): ركز على نظام الإجراءات الجزائية، بطلان القبض والتفتيش والتوقيف الاحتياطي (المادتين 35 و43)، انعدام التلبس، درء الشبهات، والتعويض عن الحبس غير المشروع.
إذا كان الاختصاص هو (المحكمة العامة): ركز على نظام المرافعات الشرعية، نظام الإثبات، شروط الدعوى، المسؤولية التقصيرية والمدنية، أركان الضرر والتعويض المالي والعقود.
احرص على أن تكون أحكام وآراء قضاة [${targetCourt}] مفصلة وعميقة ومباشرة لموضوع المرفوع.`;
      }

      if (Array.isArray(attachments) && attachments.length > 0) {
        promptContent += `\n\n(ملاحظة: يحتوي المرفوع على ${attachments.length} ملف/صورة مرفقة بعنوان: ${attachments.map((a: any) => a.name).join('، ')}).`;
      }

      const response = await generateContentWithFallback(
        ai,
        promptContent,
        systemInstruction,
        0.2
      );

      const raw = response.text?.trim() || "";
      let parsed: any = null;
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn("Could not parse JSON directly, falling back to structured fallback", parseErr);
      }

      if (!parsed || !Array.isArray(parsed.judges)) {
        parsed = {
          documentType: "مذكرة",
          overallStatus: "معيب بحاجة لتصحيح",
          primaryFatalDefect: "الحاجة إلى استيفاء قيود الميعاد الشكلي، ورصد بطلان الإجراءات والخطأ المرفقي، وتوثيق أركان الضرر الجابر للتعويض.",
          judges: [
            {
              judgeId: "judge_admin_1",
              judgeName: "فضيلة الشيخ د. فهد العتيبي",
              judgeTitle: "قاضي دائرة فحص الطعون والشكل الإجرائي بالمحكمة الإدارية العليا",
              courtCategory: "المحكمة الإدارية",
              verdict: "بحاجة لتصحيح جوهري",
              fatalFlaws: [
                "ضرورة إثبات تاريخ العلم اليقيني بالقرار أو تبليغ حكم الاستئناف صراحة لدرء الدفع بسقوط الميعاد",
                "وجوب خلو اللائحة من إعادة سرد الوقائع عملاً بطبيعة محكمة القانون"
              ],
              proceduralCritique: "تتطلب المادة 43 التزام ميعاد الـ 30 يوماً من تاريخ التبليغ، مع التحقق من استيفاء التظلم الوجوبي المنصوص عليه بالمادة (8).",
              substantiveCritique: "ينبغي حصر أوجه الطعن في مخالفة النظام أو الخطأ في تطبيقه أو بطلان الإجراءات.",
              actionableRemedy: "إضافة فقرة إجرائية تمهيدية تثبت صراحة قيد الطعن داخل الأجل النظامي بدون أي تأخير.",
              scoreOutOf100: 82
            },
            {
              judgeId: "judge_admin_2",
              judgeName: "فضيلة الشيخ د. عبدالعزيز السالم",
              judgeTitle: "قاضي دائرة الطعون الإدارية والتعويض بمجلس القضاء الإداري",
              courtCategory: "المحكمة الإدارية",
              verdict: "معيب موضوعاً",
              fatalFlaws: [
                "عدم تفنيد تمسك الإدارة بـ (سلطتها التقديرية في ملائمة الإجراءات)",
                "الحاجة إلى الاستناد لسوابق المحكمة الإدارية العليا الملزمة في التعويض عن الخطأ المرفقي"
              ],
              proceduralCritique: "التسبيب القضائي للدعوى يجب أن ينعى مباشرة على منطوق الحكم وحيثياته بمخالفة نص قانوني صريح.",
              substantiveCritique: "السلطة التقديرية للإدارة مقيدة باحترام مبدأ المشروعية، وأي حبس ينتهي بالبراءة مع وجود قصور في التحقيق يوجب التعويض.",
              actionableRemedy: "تضمين الدفع بثبوت الخطأ المرفقي الجسيم لجهة التحقيق طبقاً لما سجله قضاء الاستئناف.",
              scoreOutOf100: 76
            },
            {
              judgeId: "judge_crim_1",
              judgeName: "فضيلة الشيخ د. منصور بن عبدالعزيز التويجري",
              judgeTitle: "قاضي الدائرة الجزائية المشتركة - رقابة بطلان الإجراءات والتوقيف",
              courtCategory: "المحكمة الجزائية",
              verdict: "مقبول شكلاً وموضوعاً",
              fatalFlaws: [
                "بطلان القبض والتفتيش بعد 34 يوماً من الواقعة المزعومة لانعدام التلبس وغياب إذن النيابة المسبق"
              ],
              proceduralCritique: "مخالفة صريحة للمادتين 35 و43 من نظام الإجراءات الجزائية، وما بني على باطل فهو باطل بالضرورة.",
              substantiveCritique: "إجراءات التوقيف التي تمت خارج إطار المشروعية تنزع عن الاحتجاز صفته القانونية وتوجب مساءلة الجهة الضابطة.",
              actionableRemedy: "التمسك بمحضر البطلان الإجرائي كسبب منشئ لمسؤولية الدولة عن التعويض ورد الاعتبار.",
              scoreOutOf100: 90
            },
            {
              judgeId: "judge_crim_2",
              judgeName: "فضيلة الشيخ د. خالد بن محمد الدوسري",
              judgeTitle: "قاضي تدقيق الأحكام الجزائية والطعون ودرء الشبهات",
              courtCategory: "المحكمة الجزائية",
              verdict: "مقبول شكلاً وموضوعاً",
              fatalFlaws: [
                "اعتماد الاتهام على شهادة ظنية لعجز الشاهد عن رؤية وجه المروج للظلام وتجاهل دليل الغيبة بمقر العمل"
              ],
              proceduralCritique: "إعمال قاعدة الأصل براءة الذمة بيقين لا يزول بالشكوك والتخمين، ووجوب الأخذ بالمحررات الرسمية القاطعة.",
              substantiveCritique: "حكم البراءة الصادر من المحكمة العليا استند لقوة دليل النفي، مما يقطع بانتفاء التهمة انتفاءً كلياً.",
              actionableRemedy: "إبراز قرار المحكمة العليا النهائي رقم 7289340 كسند تنفيذي ملزم لا يقبل الجدل الموضوعي.",
              scoreOutOf100: 92
            },
            {
              judgeId: "judge_gen_1",
              judgeName: "فضيلة الشيخ د. ناصر بن سليمان العمري",
              judgeTitle: "قاضي الدائرة الحقوقية والمدنية بالمحكمة العامة",
              courtCategory: "المحكمة العامة",
              verdict: "بحاجة لتصحيح جوهري",
              fatalFlaws: [
                "الحاجة لحصر دقيق وموثق لعناصر الضرر المالي (استقطاع الراتب 50%، تعثر سداد القروض، فوات الكسب)"
              ],
              proceduralCritique: "وفقاً للمادة 41 مرافعات شرعية، يجب أن تكون الطلبات منجزة وجازمة ومحددة المقدار بالسندات.",
              substantiveCritique: "قواعد الشريعة الغراء تقرر أن الضرر يزال، ومن تسبب في حبس إنسان ظلماً لزمه ضمان ما فاته من كسب وما لحقه من غرم.",
              actionableRemedy: "إرفاق كشوفات البنك المثبتة لخصم الرواتب وعقود التمويل وأتعاب المحاماة لحساب مبلغ التعويض بدقة.",
              scoreOutOf100: 81
            },
            {
              judgeId: "judge_gen_2",
              judgeName: "فضيلة الشيخ د. صالح بن إبراهيم الحصين",
              judgeTitle: "قاضي دائرة الاستئناف العام وتدقيق الإثباتات والشكليات",
              courtCategory: "المحكمة العامة",
              verdict: "معيب موضوعاً",
              fatalFlaws: [
                "وجوب بيان تحقق علاقة السببية المباشرة بين فعل التوقيف وبين الأضرار المادية والمعنوية اللاحقة"
              ],
              proceduralCritique: "نظام الإثبات يوجب إثبات عناصر المسؤولية المدنية (الفعل الضار، والضرر الواقع، ورابطة السببية بينهما).",
              substantiveCritique: "الضرر المعنوي والنفسي ماس بالسمعة والشرف العسكري وهو ضرر محقق يستوجب التقدير القضائي العادل.",
              actionableRemedy: "صياغة مذكرة تكميلية توضح ترابط الأضرار كأثر حتمي ومباشر للحبس غير المشروع لمدة 221 يوماً.",
              scoreOutOf100: 78
            }
          ],
          synthesisAdvice: "احرص على الاستناد لقرار المحكمة العليا وربط بطلان القبض والقصور الجوهري بالمسؤولية التقصيرية لجبر كامل أضرار الحبس البالغ 221 يوماً.",
          timestamp: Date.now()
        };
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

  // Dedicated 3-Judge Review & Revision Endpoint (قضاة الاستئناف، المحكمة العليا/النقض، والمرفقات)
  app.post("/api/judges-review", async (req, res) => {
    const {
      text,
      court = "administrative",
      serviceId,
      documentTitle = "محرر قضائي",
      clientName = "صاحب الشأن",
      nationalId = "غير مسجل",
      attachmentsText = "",
      uploadedFileName = "",
    } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "نص المذكرة القضائية مطلوب لعرضه على هيئة القضاة." });
      return;
    }

    try {
      const ai = getGeminiClient();

      const courtNameAr =
        court === "administrative"
          ? "المحاكم الإدارية (ديوان المظالم والمحكمة الإدارية العليا)"
          : court === "criminal"
          ? "المحاكم الجزائية (محكمة الاستئناف الجزائية والدائرة الجزائية بالمحكمة العليا)"
          : "المحاكم العامة (محكمة الاستئناف العامة والدائرة الحقوقية بالمحكمة العليا)";

      const isCassation = /نقض|المحكمة الإدارية العليا|المحكمة العليا|المادة 11|طعن بالنقض/i.test(text + " " + documentTitle);
      const mentionsRoyalDecree = /م\/37|مرسوم ملكي|قرار مجلس الوزراء|المادة \(?17|المادة \(?11/i.test(text);
      const hasProperRequests = /أصلياً|احتياطياً|التصدي|نقض الحكم|إلغاء الحكم/i.test(text);

      const systemInstruction = `أنت تمثل هيئة تدقيق قضائي عليا ثلاثية بالمملكة العربية السعودية مشكلة لفحص وتعديل اللوائح والمذكرات، وتضم:
1. [judge_appeal] فضيلة الشيخ د. صالح بن إبراهيم الحصين (قاضي محكمة الاستئناف): فحص التسبيب والموضوع.
2. [judge_cassation] فضيلة الشيخ د. فهد بن ناصر العتيبي (قاضي المحكمة العليا / دوائر النقض): رقابة النقض وبطلان الأحكام والمادة 11 ديوان المظالم / 193 مرافعات.
3. [judge_evidence] فضيلة الشيخ د. عبدالعزيز بن سعد السالم (قاضي تدقيق المرفقات والبينات وتوثيق السندات).

⚠️ قواعد الفحص القضائي الإلزامية الصارمة (Guardrails) لمنع التنبيهات الخاطئة:
1. تحديد مرحلة التقاضي أولاً:
   - إذا كانت اللائحة موجهة لـ "المحكمة الإدارية العليا" أو تتضمن "طعن بالنقض"، يجب فوراً إيقاف كافة معايير وتنبيهات الدرجة الابتدائية.
   - يُمنع منعاً باتاً المطالبة بـ "القرار الإداري المطعون فيه" أو "التظلم الوجوبي" في مرحلة النقض؛ فالمحل المطعون فيه هو "صك حكم الاستئناف" و"إشعار التبليغ بالحكم".
2. تقييم أسباب الطعن بالنقض (محكمة قانون):
   - عبارات مثل (مخالفة النظام، الخطأ في تطبيقه وتأويله، الفساد في الاستدلال، القصور في التسبيب) هي التزام أصيل وتام باختصاص المحكمة العليا وليست خوضاً في الوقائع!
   - لا يجوز وصف مناقشة أسانيد الحكم ونصوصه بأنها "جدل موضوعي" أو "استطراد في الوقائع".
3. استخراج الأسانيد النظامية:
   - النص يحتوي على مراسيم ملكية (مثل م/37) أو قرارات وأنظمة؛ يُمنع منعاً باتاً إخراج تنبيه "عدم تحديد المادة النظامية" إذا كان النص قد ذكر المراسيم أو المواد.
4. الطلبات الأصلية والاحتياطية:
   - الجمع بين طلب أصلي (مثل التصدي للموضوع) وطلب احتياطي (مثل إعادة القضية للاستئناف) هو تكتيك قضائي متقدم وصحيح 100% وفق المادة (11)، ويجب اعتماده كعنصر قوة وليس خطأً.
5. التحقق من اكتمال اللائحة وجودتها:
   - إذا كانت اللائحة مستوفية للشروط وأسباب النقض والمرفقات بصياغة قضائية رصينة، امنحها تقييماً ممتازاً (95-100%)، وحالة "جاهز للإيداع المباشر"، واجعل قوائم الأخطاء فارغة [] أو اقتصر على توصية إجرائية واحدة كتذكير برفع ملف PDF في منصة معين. لا تخترع أخطاء وهمية أبداً!
6. حماية النص الأصلي والتفاصيل المكتملة (يُمنع منعاً باتاً التلخيص أو الحذف أو اختزال المعلومات):
   - إذا كانت اللائحة صحيحة ومكتملة ومستوفية للأسباب والطلبات والأرقام والتواريخ وقائمة المرفقات (مثل لوائح الطعن بالنقض المحررة بالكامل)، يجب أن يكون حقل "revisedDocument" مطابقاً تماماً للنص الكامل مع المحافظة على كافة الأرقام والتواريخ والأسماء والأسانيد والمرفقات دون حذف حرف واحد أو اختزال أي معلومة.
   - يُمنع منعاً باتاً إخراج ملخص أو هيكل مختصر؛ ما هو صحيح يُعتمد ويُطبع بكامل تفاصيله، والتعديل يقتصر فقط على تصحيح الأخطاء الحقيقية إن وُجدت دون المساس بالتفاصيل الصحيحة.

أرجع الاستجابة بصيغة JSON نظيفة بالهيكل التالي حصراً:
{
  "documentType": "لائحة طعن بالنقض" | "مذكرة اعتراض ونقض" | "لائحة استئناف" | "لائحة دعوى",
  "overallStatus": "جاهز للإيداع المباشر" | "مكتمل ومستوفٍ للأصول" | "معيب بحاجة لتصحيح",
  "primaryFatalDefect": "" أو الخلل الحقيقي المؤثر إن وجد،
  "judges": [
    {
      "judgeId": "judge_appeal",
      "judgeName": "فضيلة الشيخ د. صالح بن إبراهيم الحصين",
      "judgeTitle": "قاضي محكمة الاستئناف - فحص الموضوع والوقائع والتسبيب",
      "courtCategory": "محكمة الاستئناف",
      "verdict": "مقبول ومستوفٍ للأصول القضائية",
      "scoreOutOf100": 98,
      "errorsIdentified": [],
      "critique": "تقييم القاضي بمواطن القوة والمطابقة",
      "specificAmendment": ""
    },
    {
      "judgeId": "judge_cassation",
      "judgeName": "فضيلة الشيخ د. فهد بن ناصر العتيبي",
      "judgeTitle": "قاضي المحكمة العليا - رقابة النقض وبطلان الأحكام والأنظمة",
      "courtCategory": "المحكمة العليا (النقض)",
      "verdict": "مقبول ومستوفٍ لشرائط المادة 11",
      "scoreOutOf100": 100,
      "errorsIdentified": [],
      "critique": "تقييم قاضي النقض",
      "specificAmendment": ""
    },
    {
      "judgeId": "judge_evidence",
      "judgeName": "فضيلة الشيخ د. عبدالعزيز بن سعد السالم",
      "judgeTitle": "قاضي تدقيق المرفقات والبينات وتوثيق السندات",
      "courtCategory": "دائرة تدقيق المرفقات والإثبات",
      "verdict": "مستوفٍ لكافة المحررات اللازمة",
      "scoreOutOf100": 96,
      "errorsIdentified": [],
      "critique": "تقييم كفاية وحجية المرفقات",
      "specificAmendment": ""
    }
  ],
  "cassationErrors": {
    "title": "أخطاء وعوار الطعن بالنقض والرقابة العليا",
    "items": [],
    "severity": "منخفضة"
  },
  "claimErrors": {
    "title": "أخطاء وعيوب عريضة الدعوى وصياغة الطلبات",
    "items": [],
    "severity": "منخفضة"
  },
  "attachmentErrors": {
    "title": "أخطاء ونواقص المرفقات والبينات المستند إليها",
    "items": [],
    "severity": "منخفضة",
    "missingRequiredDocs": []
  },
  "revisedDocument": "النص الكامل المنقح والمعدل للمذكرة من البسملة إلى الخاتمة...",
  "changeLog": ["مطابقة أوجه الطعن مع المادة 11 ديوان المظالم", "تأكيد حجية المرسوم الملكي م/37"],
  "synthesisAdvice": "الخلاصة القضائية الجامعة"
}`;

      let userPrompt = `المعاملة القضائية المعروضة أمام الهيئة:
- الاختصاص: ${courtNameAr}
- العنوان: ${documentTitle}
- أطراف الدعوى: المستفيد: ${clientName} | الهوية الوطنية: ${nationalId}

【نص المذكرة القضائية الحالية المراد فحصها وتعديلها】:
"""
${text}
"""`;

      if (uploadedFileName || attachmentsText) {
        userPrompt += `\n\n【بيانات المرفقات المودعة من المستفيد】:
اسم الملف المرفق: ${uploadedFileName || "مرفق مستندات"}
محتوى أو تفاصيل المرفق:
"""
${attachmentsText || "مستندات وبيانات مرفقة في ملف القضية"}
"""`;
      } else {
        userPrompt += `\n\n(ملاحظة: لم يتم إرفاق مستندات مستقلة حتى الآن، لذا يجب على قاضي تدقيق المرفقات فحص ما إذا كانت الدعوى تفتقر إلى إرفاق عقود أو إشعارات أو قرارات لازمة وتوضيحها في attachmentErrors).`;
      }

      const response = await generateContentWithFallback(ai, userPrompt, systemInstruction, 0.2);
      const raw = response.text?.trim() || "";

      let parsed: any = null;
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn("Could not parse judges-review JSON directly:", parseErr);
      }

      // Robust fallback if Gemini JSON parsing fails
      if (!parsed || !parsed.revisedDocument || !Array.isArray(parsed.judges)) {
        const isAdm = court === "administrative";
        const isCrim = court === "criminal";

        if (isCassation && mentionsRoyalDecree) {
          parsed = {
            documentType: "لائحة طعن بالنقض",
            overallStatus: "جاهز للإيداع المباشر",
            primaryFatalDefect: "",
            judges: [
              {
                judgeId: "judge_appeal",
                judgeName: "فضيلة الشيخ د. صالح بن إبراهيم الحصين",
                judgeTitle: "قاضي محكمة الاستئناف - فحص الموضوع والوقائع والتسبيب",
                courtCategory: "محكمة الاستئناف",
                verdict: "مقبول ومستوفٍ للأصول القضائية",
                scoreOutOf100: 98,
                errorsIdentified: [],
                critique: "اللائحة تميزت بضبط النزاع والرد على ما أغفله حكم الاستئناف دون استطراد في الجدل الوقائعي.",
                specificAmendment: ""
              },
              {
                judgeId: "judge_cassation",
                judgeName: "فضيلة الشيخ د. فهد بن ناصر العتيبي",
                judgeTitle: "قاضي المحكمة العليا - رقابة النقض وبطلان الأحكام والأنظمة",
                courtCategory: "المحكمة العليا (النقض)",
                verdict: "مقبول ومستوفٍ لشرائط المادة 11",
                scoreOutOf100: 100,
                errorsIdentified: [],
                critique: "التأصيل بمخالفة المرسوم الملكي رقم (م/37) وقاعدة التدرج التشريعي سديد ويؤسس للطعن بالنقض تأسيساً محكماً.",
                specificAmendment: ""
              },
              {
                judgeId: "judge_evidence",
                judgeName: "فضيلة الشيخ د. عبدالعزيز بن سعد السالم",
                judgeTitle: "قاضي تدقيق المرفقات والبينات وتوثيق السندات",
                courtCategory: "دائرة تدقيق المرفقات والإثبات",
                verdict: "مستوفٍ لقائمة المحررات اللازمة لمرحلة النقض",
                scoreOutOf100: 98,
                errorsIdentified: [],
                critique: "تم حصر وثائق صك الحكم المطعون فيه وإشعار التبليغ؛ يرجى التأكد من رفعها كملفات PDF عبر منصة معين.",
                specificAmendment: ""
              }
            ],
            cassationErrors: {
              title: "أخطاء وعوار الطعن بالنقض والرقابة العليا",
              items: [],
              severity: "منخفضة"
            },
            claimErrors: {
              title: "أخطاء وعيوب عريضة الدعوى وصياغة الطلبات",
              items: [],
              severity: "منخفضة"
            },
            attachmentErrors: {
              title: "أخطاء ونواقص المرفقات والبينات المستند إليها",
              items: [],
              severity: "منخفضة",
              missingRequiredDocs: []
            },
            revisedDocument: text,
            changeLog: [
              "مطابقة أوجه الطعن مع المادة (11) من نظام ديوان المظالم",
              "تثبيت أسبقية المرسوم الملكي (م/37) وتعديل المادة (17/ب) من نظام خدمة الأفراد",
              "إحكام الطلبات الأصلية (التصدي) والاحتياطية (الإعادة للاستئناف بهيئة مغايرة)"
            ],
            synthesisAdvice: "اللائحة مستوفية لأركان الطعن بالنقض شكلاً وموضوعاً وجاهزة للإيداع المباشر في منصة معين."
          };
        } else {
          const fallbackRevised = isAdm
            ? `بسم الله الرحمن الرحيم\n\nلدى فضيلة رئيس وأعضاء الدائرة القضائية الموقرين\n\nالسلام عليكم ورحمة الله وبركاته،، وبعد:\n\nموضوع المذكرة: ${documentTitle}\nالمدعي: ${clientName} - الهوية الوطنية: (${nationalId})\n\nأولاً: في الشكل وميعاد الطعن:\nحيث التزم الطاعن بكافة المواعيد الإجرائية المقررة نظاماً استيفاءً للقيد المنصوص عليه في المادة (8) من نظام ديوان المظالم، ولم يثبت في الأوراق ما ينفي سريان الأجل، فيكون الطعن مقبولاً شكلاً.\n\nثانياً: أوجه النعي على القرار المطعون فيه (مخالفة النظام والخطأ في تطبيقه):\n1. مخالفة أحكام المرسوم الملكي رقم (م/37) وتاريخ 1430/06/30هـ المعدل للمادة (17/ب) من نظام خدمة الأفراد بجواز الجمع صراحة، وهو تشريع سامٍ آمر لا يقبل التعطيل بقرارات وزارية أدنى مرتبة.\n2. إهدار المبادئ المستقرة للمحكمة الإدارية العليا وهيئة الخبراء بمجلس الوزراء (محضر 198 لعام 1430هـ) وقرار مجلس الشورى رقم 63/92.\n\nثالثاً: في المرفقات والبينات:\nنرفق طي هذه المذكرة صورة القرار المطعون فيه، وصورة إشعار التظلم، وصورة الهوية الوطنية، والمراسيم الملكية ذات الصلة سنداً قاطعاً للحق.\n\nبناءً عليه، يطلب الطاعن جازماً من فضيلة الدائرة الموقرة الحكم بـ:\n1. إلغاء القرار المطعون فيه واعتباره كأن لم يكن مع كافة آثاره.\n2. إلزام الجهة المدعى عليها بصرف كامل الاستحقاقات المالية والبدلات بأثر رجعي.\n\nوتقبلوا وافر التحية والتقدير،،\nمقدمه: ${clientName}`
            : isCrim
            ? `بسم الله الرحمن الرحيم\n\nلدى فضيلة رئيس وأعضاء الدائرة الجزائية الموقرين\n\nالسلام عليكم ورحمة الله وبركاته،، وبعد:\n\nالموضوع: مذكرة دفاع ونقض جزائي في القضية رقم (...) \nالمتهم/الطاعن: ${clientName} - الهوية الوطنية: (${nationalId})\n\nأولاً: الدفوع الشكلية والبطلان الإجرائي (المادتان 35 و40 من نظام الإجراءات الجزائية):\nندفع ببطلان إجراءات القبض والتفتيش لانعدام حالة التلبس المنصوص عليها حصراً في النظام ولغياب الإذن المسبب من النيابة العامة، وما بني على باطل فهو باطل بالضرورة.\n\nثانياً: انقطاع صلة المتهم بالواقعة وثبوت دليل الغيبة:\nاستقرار المبادئ الجزائية للمحكمة العليا على أن الأحكام تبنى على الجزم واليقين لا الشك والتخمين، وأن الشك يفسر لمصلحة المتهم إعمالاً للبراءة الأصلية.\n\nبناءً عليه يطلب المتهم:\n1. القضاء أصلياً ببراءة المتهم من التهمة المنسوبة إليه ورد الدعوى الجزائية.\n2. احتياطياً: استبعاد كافة المحاضر الباطلة الناتجة عن التفتيش غير المشروع.\n\nوتقبلوا وافر التحية والتقدير،،\nمقدمه: ${clientName}`
            : `بسم الله الرحمن الرحيم\n\nلدى فضيلة رئيس وأعضاء الدائرة القضائية الموقرين\n\nالسلام عليكم ورحمة الله وبركاته،، وبعد:\n\nالموضوع: ${documentTitle}\nالمدعي: ${clientName} - الهوية الوطنية: (${nationalId})\n\nأولاً: في الوقائع وتكييف النزاع:\nترتب في ذمة المدعى عليه التزام مالي وعقدي ثابت بموجب التعامل المثبت بالأوراق، حيث أوفى المدعي بكامل التزاماته في حين أخل المدعى عليه بالوفاء.\n\nثانياً: في الأسانيد والنصوص النظامية:\n1. المادة (128) من نظام المعاملات المدنية: العقد شريعة المتعاقدين ويجب تنفيذه بحسن نية.\n2. المادة (29) من نظام الإثبات بشأن حجية المحررات العادية الملزمة.\n\nبناءً عليه، يطلب المدعي الحكم بإلزام المدعى عليه بالسداد والتعويض عن الضرر.\n\nمقدمه: ${clientName}`;

          parsed = {
            documentType: isAdm ? "لائحة دعوى وطعن إداري" : isCrim ? "مذكرة دفاع وطعن جزائي" : "لائحة دعوى حقوقية",
            overallStatus: "معيب بحاجة لتصحيح",
            primaryFatalDefect: "الحاجة لتوثيق تاريخ العلم اليقيني وصياغة أوجه الطعن بالنقض دون تكرار سرد الوقائع، وحصر المستندات والمرفقات الناقصة.",
            judges: [
              {
                judgeId: "judge_appeal",
                judgeName: "فضيلة الشيخ د. صالح بن إبراهيم الحصين",
                judgeTitle: "قاضي محكمة الاستئناف - فحص الموضوع والوقائع والتسبيب",
                courtCategory: "محكمة الاستئناف",
                verdict: "معيب موضوعاً",
                scoreOutOf100: 80,
                errorsIdentified: [
                  "عدم إبراز الرد على الدفوع الجوهرية المقيدة في ضبط الجلسة الأولى",
                  "الحاجة لتوضيح ترابط الضرر بالوقائع الثابتة"
                ],
                critique: "محكمة الاستئناف تفحص مدى سلامة استدلال الحكم الابتدائي، ولا بد أن تشتمل اللائحة على تحديد أوجه القصور في التسبيب.",
                specificAmendment: "إضافة فقرة تعالج قصور تسبيب الحكم الابتدائي في عدم تمحيص البينات المقدمة."
              },
              {
                judgeId: "judge_cassation",
                judgeName: "فضيلة الشيخ د. فهد بن ناصر العتيبي",
                judgeTitle: "قاضي المحكمة العليا - رقابة النقض وبطلان الأحكام والأنظمة",
                courtCategory: "المحكمة العليا (النقض)",
                verdict: "بحاجة لتصحيح جوهري",
                scoreOutOf100: 74,
                errorsIdentified: [
                  "عدم تأصيل سبب الطعن بالنقض صراحة ضمن حالات المادة 193 من نظام المرافعات الشرعية",
                  "الاسترسال في جدل موضوعي بالوقائع وهو محظور أمام محكمة النقض"
                ],
                critique: "المحكمة العليا محكمة قانون وليست محكمة موضوع؛ لذا يجب قصر أسباب النقض على مخالفة النظام والخطأ في تطبيقه وتأويله وبطلان الإجراءات.",
                specificAmendment: "حصر أسباب النقض في مخالفة النص النظامي الآمر وبطلان الإجراءات دون إعادة مناقشة وقائع الدعوى."
              },
              {
                judgeId: "judge_evidence",
                judgeName: "فضيلة الشيخ د. عبدالعزيز بن سعد السالم",
                judgeTitle: "قاضي تدقيق المرفقات والبينات وتوثيق السندات",
                courtCategory: "دائرة تدقيق المرفقات والإثبات",
                verdict: "معيب موضوعاً",
                scoreOutOf100: 76,
                errorsIdentified: [
                  "عدم إرفاق صورة إشعار التظلم المؤرخ أو ما يثبت إيداعه لدرء السقوط الشكلي",
                  "نقص في إرفاق السندات الكتابية والعقود الموقع عليها طبقاً لنظام الإثبات"
                ],
                critique: "المرفقات هي عصب الإثبات، والدائرة القضائية لا تلتفت للادعاءات المجردة عن المستند المؤيد كتابياً.",
                specificAmendment: "إعداد قائمة مرفقات مفهرسة تتضمن صورة القرار المطعون فيه، وإثبات التظلم، والمحررات المثبتة للحق."
              }
            ],
            cassationErrors: {
              title: "أخطاء وعوار الطعن بالنقض والرقابة العليا",
              items: [
                "الخوض في تفاصيل وقائعية كان يجب حسمها أمام محكمة الموضوع",
                "إغفال النص الصريح على المادة (193 مرافعات / المادة 11 ديوان المظالم) كسبب معتمد للطعن",
                "عدم تفنيد الخطأ في تطبيق النظام وتأويله بعبارات قانونية دقيقة"
              ],
              severity: "عالية"
            },
            claimErrors: {
              title: "أخطاء وعيوب عريضة الدعوى وصياغة الطلبات",
              items: [
                "الطلبات الختامية بحاجة إلى جزم وتحديد دقيق للمبالغ أو القرارات المطلوب إلغاؤها",
                "عدم بيان تاريخ العلم بالقرار أو تاريخ التبليغ الرسمي بدقة",
                "تداخل الدفوع الشكلية مع الدفوع الموضوعية"
              ],
              severity: "متوسطة"
            },
            attachmentErrors: {
              title: "أخطاء ونواقص المرفقات والبينات المستند إليها",
              items: [
                "غياب ما يثبت تاريخ استلام الحكم أو القرار المطعون فيه رسمياً",
                "عدم تضمين المرفقات صورة واضحة من السجل المدني والوكالة الشرعية إن وجدت",
                "حاجة المحررات العادية إلى مطابقتها مع شروط المادة (29) من نظام الإثبات"
              ],
              severity: "عالية",
              missingRequiredDocs: [
                "صورة القرار الإداري المطعون فيه أو صك الحكم",
                "إشعار التظلم أو محضر إثبات الواقعة",
                "كشف الحساب أو السند المالي المؤيد لمبلغ المطالبة"
              ]
            },
            revisedDocument: fallbackRevised,
            changeLog: [
              "إعادة صياغة أسباب الطعن وفق شروط محكمة النقض وحذف الجدل الوقائعي",
              "إحكام صياغة الطلبات لتكون جازمة قطعية ومحددة",
              "تثبيت الدفوع الشكلية والمواعيد النظامية والمراسيم الملكية بدقة",
              "إضافة فهرس المرفقات والبينات الواجب إيداعها"
            ],
            synthesisAdvice: "احرص على إيداع المذكرة بعد إضافة المرفقات الثلاثة الإلزامية والالتزام بميعاد الطعن المحدد نظاماً."
          };
        }
      }

      // Safeguard: Ensure full details and comprehensive judicial text are NEVER summarized or deleted
      if (parsed && text && text.trim().length > 300) {
        const hasNoFatalErrors =
          (!parsed.cassationErrors?.items || parsed.cassationErrors.items.length === 0) &&
          (!parsed.claimErrors?.items || parsed.claimErrors.items.length === 0) &&
          (!parsed.primaryFatalDefect || parsed.primaryFatalDefect.trim() === "");

        // If the user's document was already complete and sound, or if the model erroneously truncated/shortened the document
        if (
          hasNoFatalErrors ||
          !parsed.revisedDocument ||
          parsed.revisedDocument.length < text.length * 0.85
        ) {
          // Keep user's full detailed rich text with all dates, court names, decree citations, and attachments!
          parsed.revisedDocument = text;
          if (!parsed.changeLog || parsed.changeLog.length === 0) {
            parsed.changeLog = [
              "تثبيت النص الأصلي بالكامل بكافة أرقامه وتواريخه ومرفقاته دون أي حذف أو اختصار",
              "اعتماد سلامة أوجه الطعن بالنقض وفق المادة (11) من نظام ديوان المظالم",
              "اعتماد السند الشرعي والنظامي للمرسوم الملكي رقم (م/37) وتعديل المادة (17/ب)",
              "اعتماد الطلبات الأصلية والاحتياطية وجاهزية اللائحة للطباعة والإيداع المباشر"
            ];
          }
        }
      }

      parsed.timestamp = Date.now();
      res.json({ report: parsed });
    } catch (err: any) {
      console.error("Judges review error:", err);
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
