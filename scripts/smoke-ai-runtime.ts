const MODEL = 'gemini-3.5-flash';
const keyNames = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4'];

let present = 0;
let usable = 0;

for (let index = 0; index < keyNames.length; index += 1) {
  const apiKey = process.env[keyNames[index]]?.trim();

  if (!apiKey) {
    console.log('[AI_KEY_TEST]', index + 1, 'MISSING');
    continue;
  }

  present += 1;

  try {
    const endpoint =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      MODEL +
      ':generateContent?key=' +
      encodeURIComponent(apiKey);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply only OK' }] }],
        generationConfig: { maxOutputTokens: 8, temperature: 0 },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (response.ok) {
      usable += 1;
      console.log('[AI_KEY_TEST]', index + 1, 'OK', MODEL);
    } else {
      console.log('[AI_KEY_TEST]', index + 1, 'FAIL', response.status);
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : 'UNKNOWN';
    console.log('[AI_KEY_TEST]', index + 1, 'FAIL', name);
  }
}

console.log('[AI_KEY_SUMMARY]', usable + '/' + present, 'OK');

if (present === 0 || usable === 0) {
  process.exitCode = 2;
}
