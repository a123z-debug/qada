export default function handler(_req: any, res: any) {
  return res.status(200).json({
    gemini: Boolean(process.env.GEMINI_API_KEY),
    authSecret: Boolean(process.env.AUTH_SECRET),
    vercel: process.env.VERCEL || null
  });
}
