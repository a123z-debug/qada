import { randomUUID } from 'node:crypto';
import { readSession, sessionCookie, type AuthSession } from './_auth.ts';

export default function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const existing = readSession(req.headers?.cookie);
  if (existing) {
    return res.status(200).json({ session: existing });
  }

  const session: AuthSession = {
    id: `guest-${randomUUID()}`,
    name: 'مستخدم المنصة',
    personName: 'مستخدم المنصة',
    email: 'guest@qada.local',
    nationalId: '',
    role: 'user',
    agency: 'أصول القضاء',
    loginMethod: 'email_password',
    loginAt: Date.now(),
  };

  res.setHeader('Set-Cookie', sessionCookie(session));
  return res.status(200).json({ session });
}
