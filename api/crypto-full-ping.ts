import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export default function handler(_req: any, res: any) {
  return res.status(200).json({
    ok: true,
    imports: [
      typeof createCipheriv,
      typeof createDecipheriv,
      typeof createHash,
      typeof createHmac,
      typeof pbkdf2Sync,
      typeof randomBytes,
      typeof timingSafeEqual,
    ],
  });
}
