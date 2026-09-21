import fs from 'node:fs';

const protectedEndpoints = [
  'api/chat.ts',
  'api/judges-review.ts',
  'api/convert-story.ts',
  'api/legal-source-search.ts',
];

const violations: string[] = [];

for (const file of protectedEndpoints) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes("import { readSession } from './session.ts';")) {
    violations.push(`${file}: missing readSession import`);
  }
  if (!source.includes("res.status(401).json({ error: 'AUTH_REQUIRED' })")) {
    violations.push(`${file}: missing AUTH_REQUIRED response`);
  }
}

const aiCompat = fs.readFileSync('api/ai.ts', 'utf8');
if (!aiCompat.includes("import chatHandler from './chat.ts';")) {
  violations.push('api/ai.ts: must delegate to canonical chat handler');
}
if (!aiCompat.includes('return chatHandler(req, res)')) {
  violations.push('api/ai.ts: canonical delegation call missing');
}

const chat = fs.readFileSync('api/chat.ts', 'utf8');
if (!chat.includes('attachments?: IncomingAttachment[]')) {
  violations.push('api/chat.ts: multimodal attachment contract missing');
}
if (!chat.includes('inlineData')) {
  violations.push('api/chat.ts: Gemini inline attachment handling missing');
}
if (!chat.includes('trustedUserMessages')) {
  violations.push('api/chat.ts: client-supplied assistant/model roles are not being discarded');
}
if (!chat.includes("enforceRateLimit('chat', session.id")) {
  violations.push('api/chat.ts: distributed session-scoped chat rate limit missing');
}
if (chat.includes("message.role === 'assistant' || message.role === 'model' ? 'model' : 'user'")) {
  violations.push('api/chat.ts: client roles can still become trusted model history');
}

if (violations.length) {
  throw new Error(`API auth/attachment safety smoke failed:\n${violations.join('\n')}`);
}

console.log(JSON.stringify({ ok: true, protectedEndpoints, aiDelegatesToChat: true }, null, 2));