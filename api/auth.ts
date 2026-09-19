import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  authErrorMessage,
  clearSessionCookie,
  loginAccount,
  loginAdmin,
  readSession,
  registerAccount,
  sessionCookie,
} from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const session = readSession(req.headers.cookie);
    if (!session) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, session });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = String(body.action || '');

  try {
    if (action === 'register') {
      const { session, accountProof } = registerAccount({
        name: String(body.name || ''),
        nationalId: String(body.nationalId || ''),
        email: String(body.email || ''),
        password: String(body.password || ''),
        inviteCode: String(body.inviteCode || ''),
      });
      res.setHeader('Set-Cookie', sessionCookie(session));
      return res.status(201).json({ session, accountProof });
    }

    if (action === 'login') {
      const session = loginAccount({
        email: String(body.email || ''),
        password: String(body.password || ''),
        accountProof: String(body.accountProof || ''),
      });
      res.setHeader('Set-Cookie', sessionCookie(session));
      return res.status(200).json({ session });
    }

    if (action === 'admin-login') {
      const session = loginAdmin({
        adminCode: String(body.adminCode || ''),
        password: String(body.password || ''),
      });
      res.setHeader('Set-Cookie', sessionCookie(session));
      return res.status(200).json({ session });
    }

    return res.status(400).json({ error: 'عملية المصادقة غير معروفة.' });
  } catch (error) {
    const mapped = authErrorMessage(error);
    return res.status(mapped.status).json({ error: mapped.error });
  }
}
