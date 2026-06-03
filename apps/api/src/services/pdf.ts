import type { CertificateOfCompletion } from '@penpact/core';
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';

interface FlattenField {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
}

/**
 * Flatten signer-entered values onto the source PDF. Field coordinates use a
 * top-left origin (per our schema); pdf-lib uses bottom-left, hence the flip.
 *
 * This is the v1 integrity output — the document is locked and hashed. A
 * cryptographic PAdES signature (PKI) is the next increment (PLAN §7).
 */
export async function buildFinalPdf(
  sourceBytes: Uint8Array,
  fields: FlattenField[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const field of fields) {
    if (field.value === null || field.value === '') {
      continue;
    }
    const page = pages[field.page - 1];
    if (!page) {
      continue;
    }
    const { height } = page.getSize();
    const size = Math.min(14, Math.max(8, field.height * 0.6));
    page.drawText(field.value, {
      x: field.x,
      y: height - field.y - field.height + (field.height - size) / 2,
      size,
      font,
      color: rgb(0.05, 0.05, 0.05),
    });
  }

  return pdf.save();
}

/** Render a one-page Certificate of Completion from the audit payload. */
export async function buildCertificatePdf(payload: CertificateOfCompletion): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 744;
  const draw = (text: string, opts: { size?: number; bold?: boolean; gap?: number } = {}): void => {
    const f: PDFFont = opts.bold ? bold : font;
    drawLine(page, text, 56, y, opts.size ?? 10, f);
    y -= opts.gap ?? 15;
  };

  draw('Certificate of Completion', { size: 18, bold: true, gap: 28 });
  draw(`Document: ${payload.documentName}`);
  draw(`Envelope ID: ${payload.envelopeId}`);
  draw(`Completed (UTC): ${payload.completedAt}`);
  draw(`Hash algorithm: ${payload.hashAlgorithm}`);
  draw(`Original hash: ${payload.documentHashOriginal ?? '-'}`, { size: 7 });
  draw(`Final hash: ${payload.documentHashFinal ?? '-'}`, { size: 7, gap: 24 });

  draw('Signers', { bold: true });
  for (const signer of payload.signers) {
    draw(`- ${signer.name} <${signer.email}>  [${signer.signatureType ?? 'n/a'}]`);
    draw(
      `   consent: ${signer.consentGiven ? 'accepted' : 'no'} @ ${signer.consentTimestamp ?? '-'}`,
      { size: 8 },
    );
    draw(`   IP: ${signer.ipAddress ?? '-'}  UA: ${(signer.userAgent ?? '-').slice(0, 64)}`, {
      size: 8,
      gap: 18,
    });
    if (y < 80) {
      break;
    }
  }

  return pdf.save();
}

function drawLine(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
): void {
  page.drawText(text, { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
}
