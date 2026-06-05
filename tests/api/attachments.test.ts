import { appendAttachmentsToPdf } from '@penpact/api/pdf';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([612, 792]);
  return doc.save();
}

// A minimal valid 1x1 PNG.
const PNG_1x1 = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
);

describe('appendAttachmentsToPdf', () => {
  it('returns the base unchanged when there are no attachments', async () => {
    const base = await makePdf(1);
    const out = await appendAttachmentsToPdf(base, []);
    expect(out).toBe(base);
  });

  it('appends a PDF attachment page-for-page and an image as one page', async () => {
    const base = await makePdf(1);
    const pdfAttachment = await makePdf(2);
    const out = await appendAttachmentsToPdf(base, [
      { bytes: pdfAttachment, contentType: 'application/pdf', filename: 'addendum.pdf' },
      { bytes: PNG_1x1, contentType: 'image/png', filename: 'id-card.png' },
    ]);
    const result = await PDFDocument.load(out);
    expect(result.getPageCount()).toBe(1 + 2 + 1);
  });

  it('skips an unreadable attachment instead of throwing', async () => {
    const base = await makePdf(1);
    const out = await appendAttachmentsToPdf(base, [
      { bytes: new Uint8Array([1, 2, 3, 4]), contentType: 'application/pdf', filename: 'broken.pdf' },
      { bytes: PNG_1x1, contentType: 'image/png', filename: 'ok.png' },
    ]);
    const result = await PDFDocument.load(out);
    expect(result.getPageCount()).toBe(1 + 1); // base + the one good image
  });

  it('sanitizes non-ASCII characters in the image caption (no font crash)', async () => {
    const base = await makePdf(1);
    const out = await appendAttachmentsToPdf(base, [
      { bytes: PNG_1x1, contentType: 'image/png', filename: 'паспорт-✓.png' },
    ]);
    const result = await PDFDocument.load(out);
    expect(result.getPageCount()).toBe(2);
  });
});
