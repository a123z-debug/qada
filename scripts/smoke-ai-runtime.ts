import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-3.5-flash';
const keyNames = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4'];

function failureClass(error: unknown): string {
  if (!error || typeof error !== 'object') return 'UNKNOWN';
  const value = error as { status?: unknown; code?: unknown; name?: unknown };
  return String(value.status || value.code || value.name || 'UNKNOWN').slice(0, 40);
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('AI_SMOKE_TIMEOUT')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let present = 0;
let usable = 0;

for (let index = 0; index < keyNames.length; index += 1) {
  const keyName = keyNames[index];
  const apiKey = process.env[keyName]?.trim();

  if (!apiKey) {
    console.log('[AI_KEY_TEST]', index + 1, 'MISSING');
    continue;
  }

  present += 1;

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await withTimeout(
      client.models.generateContent({
        model: MODEL,
        contents: 'Reply only OK',
        config: { maxOutputTokens: 8, temperature: 0 },
      }),
      12_000,
    );

    if ((response.text || '').trim()) {
      usable += 1;
      console.log('[AI_KEY_TEST]', index + 1, 'OK', MODEL);
    } else {
      console.log('[AI_KEY_TEST]', index + 1, 'EMPTY', MODEL);
    }
  } catch (error) {
    console.log('[AI_KEY_TEST]', index + 1, 'FAIL', failureClass(error));
  }
}

console.log('[AI_KEY_SUMMARY]', usable + '/' + present, 'OK');

if (present === 0 || usable === 0) {
  process.exitCode = 2;
}
