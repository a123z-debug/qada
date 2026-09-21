import {
  authErrorMessage,
  clearLegacySessionCookie,
  clearSessionCookie,
  loginAccount,
  loginAdmin,
  readSession,
  registerAccount,
  sessionCookie,
} from './_auth.ts';

function setSessionCookies(res: any, cookie: string) {
  res.setHeader('Set-Cookie', [clearLegacySessionCookie(), cookie]);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const session = readSession(req.headers?.cookie);
    if (!session) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, session });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', [clearSessionCookie(), clearLegacySessionCookie()]);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'register') {
      const result = registerAccount({
        name: String(body.name || ''),
        email: String(body.email || ''),
        password: String(body.password || ''),
      });

      setSessionCookies(res, sessionCookie(result.session));
      return res.status(200).json({
        session: result.session,
        accountProof: result.accountProof,
      });
    }

    if (action === 'user-login') {
      const session = loginAccount({
        email: String(body.email || ''),
        password: String(body.password || ''),
        accountProof: String(body.accountProof || ''),
      });

      setSessionCookies(res, sessionCookie(session));
      return res.status(200).json({ session });
    }

    if (action === 'admin-login') {
      const session = loginAdmin({
        adminCode: String(body.adminCode || ''),
        password: String(body.password || ''),
      });

      setSessionCookies(res, sessionCookie(session));
      return res.status(200).json({ session });
    }

    return res.status(400).json({ error: 'عملية المصادقة غير معروفة.' });
  } catch (error) {
    const mapped = authErrorMessage(error);
    return res.status(mapped.status).json({ error: mapped.error });
  }
}
