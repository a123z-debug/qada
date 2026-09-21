import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

function dataRootSecret(): Buffer {
  const source = (process.env.DATA_SECRET || process.env.AUTH_SECRET || '').trim();
  if (!source || source.length < 32) throw new Error('DATA_SECRET_MISSING');
  return createHash('sha256').update(`qada-data-v1:${source}`).digest();
}

function keyFor(purpose: string): Buffer {
  return createHmac('sha256', dataRootSecret()).update(purpose).digest();
}

export function protectJson(value: unknown, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(purpose), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function unprotectJson<T>(token: string | null | undefined, purpose: string): T | null {
  if (!token) return null;
  try {
    const [version, ivPart, tagPart, encryptedPart] = token.split('.');
    if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) return null;
    const decipher = createDecipheriv('aes-256-gcm', keyFor(purpose), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64url')), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as T;
  } catch {
    return null;
  }
}