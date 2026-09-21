export async function consumeTextSse(
  response: Response,
  onText?: (fullText: string) => void,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let doneSeen = false;

  const consumeLine = (rawLine: string) => {
    const line = rawLine.replace(/\r$/, '');
    if (!line.startsWith('data:')) return;

    const data = line.slice(5).trimStart().trim();
    if (!data) return;
    if (data === '[DONE]') {
      doneSeen = true;
      return;
    }

    try {
      const parsed = JSON.parse(data);
      if (typeof parsed?.text === 'string' && parsed.text) {
        fullText += parsed.text;
        onText?.(fullText);
      }
    } catch {
      // Keep malformed/incomplete SSE payloads out of the visible legal text.
      // Incomplete records remain buffered until a newline arrives.
    }
  };

  while (!doneSeen) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      consumeLine(line);
      if (doneSeen) break;
    }
  }

  buffer += decoder.decode();
  if (!doneSeen && buffer.trim()) {
    consumeLine(buffer);
  }

  try {
    await reader.cancel();
  } catch {}

  return fullText;
}
