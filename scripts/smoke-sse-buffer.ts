import { consumeTextSse } from '../src/lib/consumeTextSse.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const encoder = new TextEncoder();
const chunks = [
  'data: {"text":"مر',
  'حباً"}\n',
  '\ndata: {"text":" بالع',
  'الم"}\n\ndata: [DO',
  'NE]\n\n',
];

const stream = new ReadableStream<Uint8Array>({
  start(controller) {
    for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
    controller.close();
  },
});

const response = new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream' },
});

const updates: string[] = [];
const output = await consumeTextSse(response, (text) => updates.push(text));

assert(output === 'مرحباً بالعالم', `unexpected SSE output: ${output}`);
assert(updates.at(-1) === output, 'last callback must contain the full assembled text');
assert(updates.length === 2, `expected two parsed text events, got ${updates.length}`);

console.log(JSON.stringify({ ok: true, output, updates: updates.length }, null, 2));
