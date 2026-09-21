export async function readSseTextResponse(
  response: Response,
  onText?: (fullText: string) => void,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  const processLine = (rawLine: string) => {
    const line = rawLine.replace(/\r$/, '');
    if (!line.startsWith('data:')) return;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === '[DONE]') return;

    try {
      const parsed = JSON.parse(dataStr);
      if (typeof parsed?.text === 'string' && parsed.text) {
        fullText += parsed.text;
        onText?.(fullText);
      }
    } catch {
      // Accept plain-text SSE only after a complete line has arrived.
      fullText += dataStr;
      onText?.(fullText);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) processLine(line);

    if (done) break;
  }

  if (buffer.trim()) processLine(buffer);
  return fullText;
}