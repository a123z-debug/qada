import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const chat = fs.readFileSync('api/chat.ts', 'utf8');
assert(chat.includes('hasPdfAttachment'), 'chat must detect PDF attachments before gateway');
assert(chat.includes("if (hasPdfAttachment) return ''"), 'chat must bypass text-only gateway for PDFs');
assert(chat.includes('inlineData'), 'chat must retain Gemini inlineData path');

const review = fs.readFileSync('api/judges-review.ts', 'utf8');
assert(review.includes('attachments?: IncomingAttachment[]'), 'review API attachment contract missing');
assert(review.includes('attachmentParts'), 'review API must normalize binary evidence');
assert(review.includes("attachmentParts.length === 0 ? await generateReviewViaGateway(prompt) : ''"), 'review must bypass gateway when evidence exists');
assert(review.includes("parts: [...attachmentParts, { text: prompt }]"), 'review must send evidence bytes to Gemini');

const editor = fs.readFileSync('src/components/workspaces/LegalReviewEditor.tsx', 'utf8');
assert(editor.includes('uploadedAttachments?: Attachment[]'), 'editor attachment prop missing');
assert(editor.includes('attachments: uploadedAttachments'), 'editor must send evidence to review API');

for (const file of [
  'src/components/workspaces/AdministrativeWorkspace.tsx',
  'src/components/workspaces/CriminalWorkspace.tsx',
  'src/components/workspaces/GeneralWorkspace.tsx',
]) {
  const source = fs.readFileSync(file, 'utf8');
  assert(source.includes('uploadedAttachments={uploadedAttachment ? [uploadedAttachment] : []}'), `${file}: evidence is not forwarded to review editor`);
}

console.log(JSON.stringify({ ok: true, pdfGatewayBypass: true, reviewBinaryEvidence: true }, null, 2));