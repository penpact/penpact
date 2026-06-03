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

/** Decode a `data:image/png;base64,...` value to bytes, or null if it is not one. */
export function parsePngDataUrl(value: string): Uint8Array | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value.trim());
  if (!match?.[1]) return null;
  try {
    return new Uint8Array(Buffer.from(match[1], 'base64'));
  } catch {
    return null;
  }
}

export interface MergeSource {
  documentId: string;
  bytes: Uint8Array;
}
export interface MergeField extends FlattenField {
  documentId: string;
}

/**
 * Draw one field value onto a page. A `data:image/png` value (drawn/uploaded
 * signature) is embedded as an image; everything else is flattened as text.
 * Field coordinates use a top-left origin; pdf-lib uses bottom-left (the flip).
 */
async function drawField(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  field: FlattenField,
): Promise<void> {
  if (field.value === null || field.value === '') return;
  const { height } = page.getSize();
  const png = parsePngDataUrl(field.value);
  if (png) {
    const image = await pdf.embedPng(png);
    page.drawImage(image, {
      x: field.x,
      y: height - field.y - field.height,
      width: field.width,
      height: field.height,
    });
    return;
  }
  const size = Math.min(14, Math.max(8, field.height * 0.6));
  page.drawText(field.value, {
    x: field.x,
    y: height - field.y - field.height + (field.height - size) / 2,
    size,
    font,
    color: rgb(0.05, 0.05, 0.05),
  });
}

/**
 * Flatten signer-entered values onto a single source PDF. The v1 integrity
 * output — the document is locked and hashed.
 */
export async function buildFinalPdf(
  sourceBytes: Uint8Array,
  fields: FlattenField[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  for (const field of fields) {
    const page = pages[field.page - 1];
    if (page) await drawField(pdf, page, font, field);
  }
  return pdf.save();
}

/**
 * Merge several source documents (in the given order) into one PDF and flatten
 * each field onto `pageOffset[documentId] + field.page`. Used to seal a
 * multi-document envelope into a single final PDF.
 */
export async function buildMergedFinalPdf(
  sources: MergeSource[],
  fields: MergeField[],
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const offset = new Map<string, number>();
  for (const source of sources) {
    offset.set(source.documentId, merged.getPageCount());
    const doc = await PDFDocument.load(source.bytes);
    const copied = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of copied) merged.addPage(page);
  }
  const pages = merged.getPages();
  for (const field of fields) {
    const base = offset.get(field.documentId);
    if (base === undefined) continue;
    const page = pages[base + field.page - 1];
    if (page) await drawField(merged, page, font, field);
  }
  return merged.save();
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
