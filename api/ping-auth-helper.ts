import { readSession } from './_auth.ts';

export default function handler(req: any, res: any) {
  const session = readSession(req.headers?.cookie);
  return res.status(200).json({ ok: true, authenticated: Boolean(session) });
}
