# QADA × Agent OS — Intelligence Architecture

## الهدف

ربط QADA بـ Agent OS كطبقة تخطيط قدرات، مع إبقاء **المنطق القانوني وحقيقة المصادر وبيانات القضايا داخل QADA**.

## الحدود المعمارية

```text
User
  ↓
QADA Simple / Professional / Admin
  ↓
QADA Intelligence Kernel
  ├─ Case Router
  ├─ Legal Truth Layer
  ├─ Dynamic Case Team
  ├─ Red Team
  ├─ Hujja Bayan
  └─ Virtual Judge / Release Gate
          │
          └─ optional capability-only projection
                    ↓
               Agent OS Gateway
                    ↓
               Agent OS Brain
                    ↓
                 Registry
```

Agent OS لا يستلم نص الحكم أو أسماء الأطراف أو المرفقات. الإسقاط المرسل إليه يقتصر على بيانات مجردة مثل نوع المهمة، المرحلة، مستوى المخاطر، مستوى التعقيد، حالة التحقق والقدرات المطلوبة.

## Legal Truth Layer

كل دورة تحمل حالة صريحة للحقيقة القانونية:

- عدد المصادر الرسمية المسترجعة.
- عدد المواد المفهرسة المتحققة.
- قائمة قيود التحقق (blockers).
- هل الاقتباس الحرفي جاهز من مصدر رسمي.
- هل corpus السوابق جاهز.
- الحالة الإجمالية: `verified | partial | blocked`.

وجود مصدر عام أو رقم مادة في كلام المستخدم لا يرقّي الادعاء تلقائياً إلى حقيقة متحققة.

## Dynamic Case Team

الفريق يتكون ديناميكياً من عقود الوكلاء الحالية، مثل:

- document-reader
- case-router
- qada-core
- official-source / exact-text / amendments
- src-bog / src-personnel / src-royal / src-precedents عند الصلة
- legislative-flaws / judicial-flaws / procedural-flaws / evidence-flaws / reasoning-flaws
- rebuttal-review
- hujja-bayan
- virtual-judge

لا يُفعّل وكيل الصياغة ولا بوابة الإخراج إذا كان الطريق القضائي محجوباً.

## مراحل التنفيذ

1. **Intake** — استخراج الملف والوقائع والتواريخ.
2. **Route** — تحديد المهمة والمرحلة والطريق القضائي.
3. **Truth** — تحقق المصدر والسريان والنص والسوابق.
4. **Analyze** — تحليل تشريعي/قضائي/إجرائي/إثباتي/تكييفي.
5. **Challenge** — اختبار أقوى دفع مضاد.
6. **Draft** — الصياغة عندما يسمح المسار.
7. **Release** — Virtual Judge والبوابة النهائية.

## Agent OS Bridge

الربط اختياري. الإعدادات:

```env
AGENT_OS_GATEWAY_URL=
AGENT_OS_ACCESS_TOKEN=
```

قواعد الربط:

- إذا لم يوجد URL يعمل QADA بالكامل بالـplanner المحلي.
- الاتصال الخارجي غير loopback يحتاج token.
- timeout قصير، وفشل Agent OS لا يعطل QADA.
- الاستدعاء `/route` فقط لتخطيط القدرات، وليس لتنفيذ تغييرات إنتاجية.
- لا ترسل raw case facts أو attachments أو PII.

## Invariants

- لا ادعاء قانوني نهائي بلا حالة مصدر واضحة.
- لا اقتباس حرفي بلا تغطية رسمية صالحة.
- لا مسودة نهائية مع blocker جوهري.
- لا تعتبر درجة الجاهزية أو ثقة التوجيه احتمال فوز.
- لا يتجاوز Agent OS بوابات QADA القانونية.
- أسرار الاتصال تحفظ في Railway/Vercel Secrets، وليس Git.

## الاختبار

```bash
npm run test:qada-agent-os
npm run verify
npm run build
```

اختبار `smoke-qada-agent-os.ts` يغطي تكوين الفريق، منع الطريق الخاطئ، انتشار blockers، وعدم إدراج معرّفات القضية في إسقاط Agent OS.


## Project Boundary — قاعدة غير قابلة للتجاوز

QADA يبقى مشروعاً مستقلاً داخل المستودع الأصلي `a123z-debug/qada`، وهو **المصدر النهائي والوحيد** لمنطق المجال القضائي، بيانات القضايا، بوابات الاعتماد، واجهات Simple/Professional/Admin، ووكلاء القضاء.

Agent OS هو طبقة مساندة اختيارية فقط، ولا يملك صلاحية نقل QADA أو استبداله أو ابتلاع منطق المجال.

القواعد الملزمة:

- لا يُنقل كود QADA إلى `agent-os-lab`.
- لا يصبح `agent-os-core` أو `agent-os-registry` مستودعاً بديلاً لـ QADA.
- لا تُرسل نصوص القضايا أو المرفقات أو المعرفات الشخصية إلى Agent OS.
- لا يستطيع Agent OS إنشاء حكم قانوني نهائي أو تجاوز Legal Truth Layer أو Virtual Judge.
- أي اقتراح صادر من Agent OS يبقى advisory ويُعاد تقييمه داخل QADA.
- تعطل Agent OS لا يمنع QADA من العمل.
- النشر والإصدار والإنتاج الخاص بـ QADA يبقى من مستودع `a123z-debug/qada`.
