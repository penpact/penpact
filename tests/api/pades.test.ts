import { sealPdfWithPades } from '@penpact/api/pades';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

describe('PAdES sealing', () => {
  it('applies a digital signature with a self-signed certificate', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    const bytes = await pdf.save();

    const signed = await sealPdfWithPades(bytes);
    const text = Buffer.from(signed).toString('latin1');

    // A PAdES signature dictionary is present (CAdES detached subfilter).
    expect(text).toContain('/ByteRange');
    expect(text).toContain('/ETSI.CAdES.detached');
    expect(text).toContain('/Contents');
    expect(signed.byteLength).toBeGreaterThan(bytes.byteLength);
  }, 30_000);
});
