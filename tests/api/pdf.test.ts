import { buildFinalPdf, parsePngDataUrl } from '@penpact/api/pdf';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

// 1x1 transparent PNG.
const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('pdf sealer', () => {
  it('parsePngDataUrl decodes a png data url and rejects everything else', () => {
    const bytes = parsePngDataUrl(`data:image/png;base64,${PNG_1x1}`);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes?.length ?? 0).toBeGreaterThan(0);
    expect(parsePngDataUrl('Ada Lovelace')).toBeNull();
    expect(parsePngDataUrl('data:image/jpeg;base64,xxxx')).toBeNull();
    expect(parsePngDataUrl('')).toBeNull();
  });

  it('embeds a drawn (png) signature and still produces a valid PDF', async () => {
    const src = await PDFDocument.create();
    src.addPage([612, 792]);
    const sourceBytes = await src.save();

    const out = await buildFinalPdf(sourceBytes, [
      { page: 1, x: 72, y: 100, width: 180, height: 60, value: `data:image/png;base64,${PNG_1x1}` },
      { page: 1, x: 72, y: 200, width: 120, height: 20, value: 'typed name' },
    ]);

    expect(out.byteLength).toBeGreaterThan(0);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
