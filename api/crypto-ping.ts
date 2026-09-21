import { createHash } from 'node:crypto';

export default function handler(_req: any, res: any) {
  const value = createHash('sha256').update('qada').digest('hex').slice(0, 8);
  return res.status(200).json({ ok: true, value });
}
