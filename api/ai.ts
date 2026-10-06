import type { VercelRequest, VercelResponse } from '@vercel/node';
import chatHandler from './chat.js';
import { enforceSameOriginMutation } from './_requestGuard.js';

// Compatibility endpoint used by the floating assistant.
// Delegate to the canonical chat handler so authentication, attachment handling,
// source grounding, citation guards, rate limits, and provider fallback cannot drift.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!enforceSameOriginMutation(req, res)) return;
  return chatHandler(req, res);
}
