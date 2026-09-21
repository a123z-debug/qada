import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.ts';
import { readActiveSession } from './session.ts';
import { enforceRateLimit } from './_rateLimit.ts';

type Court = 'administrative' | 'general' | 'criminal';

const COURT_HINTS: Record<Court, string> = {
  administrative: 'ديوان المظالم القضاء الإداري نظام المرافعات أمام ديوان المظالم',
  general: 'المحاكم العامة نظام القضاء نظام المرافعات الشرعية نظام الإثبات',
  criminal: 'المحاكم الجزائية نظام الإجراءات الجزائية نظام الإثبات',
};

function categoryForAgent(agentId: string): string {
  if (agentId === 'src-royal') return 'أمر/مرسوم/تعديل رسمي';
  if (agentId === 'src-personnel') return 'نظام خدمة الأفراد وحقوق عسكرية';
  if (agentId === 'src-bog') return 'ديوان المظالم';
  if (agentId === 'src-precedents') return 'مبدأ/حكم قضائي — تحقق مطلوب';
  if (agentId === 'amendments') return 'تعديل وسريان';
  if (agentId === 'exact-text') return 'مطابقة مادة ومصدر';
  return 'مصدر رسمي';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await readActiveSession(req.headers?.cookie);
  if (!session) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }

  try {
    const limit = await enforceRateLimit('legal-source-search', session.id, 90, 10 * 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }
  } catch (error) {
    console.error('Legal-source rate limit unavailable:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'RATE_LIMIT_STORE_UNAVAILABLE' });
  }

  const body = (req.body ?? {}) as { query?: string; court?: Court };
  const court: Court = body.court === 'general' || body.court === 'criminal'
    ? body.court
    : 'administrative';
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 4000) : '';
  const retrievalQuery = [COURT_HINTS[court], query].filter(Boolean).join('\n');

  const bundle = runLegalSourceAgents(retrievalQuery);
  const seen = new Set<string>();
  const references: Array<{
    id: string;
    title: string;
    category: string;
    source: string;
    sourceUrl: string;
    issueInstrument: string;
    coverage: string;
    verificationNote: string;
    agentId: string;
    agentStatus: 'success' | 'warning' | 'error';
  }> = [];

  for (const packet of bundle.packets) {
    for (const reference of packet.references) {
      const key = `${reference.sourceUrl}|${reference.name}`;
      if (!reference.sourceUrl || seen.has(key)) continue;
      seen.add(key);
      references.push({
        id: `${packet.agentId}-${references.length + 1}`,
        title: reference.name,
        category: categoryForAgent(packet.agentId),
        source: reference.authority || 'مصدر سعودي رسمي مفهرس',
        sourceUrl: reference.sourceUrl,
        issueInstrument: reference.issueInstrument || '',
        coverage: reference.coverage || '',
        verificationNote: reference.note || '',
        agentId: packet.agentId,
        agentStatus: packet.status,
      });
      if (references.length >= 24) break;
    }
    if (references.length >= 24) break;
  }

  const verifiedArticles = bundle.packets.flatMap((packet) =>
    packet.verifiedArticles.map((article) => ({
      agentId: packet.agentId,
      system: article.system,
      article: article.article,
      sourceUrl: article.sourceUrl,
      note: article.note,
    }))
  ).slice(0, 30);

  return res.status(200).json({
    references,
    verifiedArticles,
    blockers: bundle.verification.blockers,
    meta: {
      officialSources: bundle.verification.officialSources,
      verifiedArticles: bundle.verification.verifiedArticles,
      literalQuotationReady: bundle.verification.literalQuotationReady,
      precedentCorpusReady: bundle.verification.precedentCorpusReady,
    },
  });
}
