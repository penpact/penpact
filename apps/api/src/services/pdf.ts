import type { CertificateOfCompletion } from '@penpact/core';
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';

interface FlattenField {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
  type?: string;
}

const TRUTHY_CHECKBOX = new Set(['true', 'on', 'yes', 'checked', '1', 'x']);

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
  // Checkboxes flatten to a mark, not the raw "true" string.
  if (field.type === 'checkbox') {
    if (!TRUTHY_CHECKBOX.has(field.value.trim().toLowerCase())) return;
    const size = Math.min(16, Math.max(9, field.height));
    page.drawText('X', {
      x: field.x + Math.max(0, (field.width - size * 0.6) / 2),
      y: height - field.y - field.height + (field.height - size) / 2,
      size,
      font,
      color: rgb(0.05, 0.05, 0.05),
    });
    return;
  }
  // Attachment fields render a fixed ASCII label (the uploaded file itself is
  // appended to the packet); never draw the raw filename, which may contain
  // glyphs the standard font cannot encode.
  if (field.type === 'attachment') {
    const size = Math.min(11, Math.max(8, field.height * 0.62));
    page.drawText('See attached', {
      x: field.x + 2,
      y: height - field.y - field.height + (field.height - size) / 2,
      size,
      font,
      color: rgb(0.2, 0.22, 0.3),
    });
    return;
  }
  const png = parsePngDataUrl(field.value);
  if (png) {
    const image = await pdf.embedPng(png);
    // Fit the signature inside the field box preserving its aspect ratio
    // ("contain"), never stretching it to fill the box. A signature drawn at
    // any size renders at its natural proportions, sitting on the line (the
    // box bottom) and left-aligned, with empty space above/right as needed.
    const scale =
      image.width > 0 && image.height > 0
        ? Math.min(field.width / image.width, field.height / image.height)
        : 1;
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, {
      x: field.x,
      y: height - field.y - field.height,
      width: w,
      height: h,
    });
    return;
  }
  const size = Math.min(14, Math.max(8, field.height * 0.6));
  // The standard PDF fonts are WinAnsi; replace code points they cannot encode
  // so an unexpected glyph in a free-text value can never crash the seal.
  const safe = field.value.replace(/[^\u0020-\u00FF]/g, '?');
  page.drawText(safe, {
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

export interface AttachmentFile {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}

/**
 * Append signer-uploaded attachments to the end of the sealed packet so the
 * completed PDF carries its supporting files. PDFs are merged page-for-page;
 * images get a captioned full page. Unreadable files are skipped, never fatal.
 */
export async function appendAttachmentsToPdf(
  baseBytes: Uint8Array,
  files: AttachmentFile[],
): Promise<Uint8Array> {
  if (!files.length) return baseBytes;
  const pdf = await PDFDocument.load(baseBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const f of files) {
    try {
      if (f.contentType === 'application/pdf') {
        const src = await PDFDocument.load(f.bytes);
        const copied = await pdf.copyPages(src, src.getPageIndices());
        for (const pg of copied) pdf.addPage(pg);
      } else if (f.contentType === 'image/png' || f.contentType === 'image/jpeg') {
        const img =
          f.contentType === 'image/png' ? await pdf.embedPng(f.bytes) : await pdf.embedJpg(f.bytes);
        const page = pdf.addPage([612, 792]);
        const margin = 48;
        const capH = 26;
        const maxW = 612 - margin * 2;
        const maxH = 792 - margin * 2 - capH;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        const caption = `Attachment: ${f.filename}`.replace(/[^\x20-\x7E]/g, '_');
        page.drawText(caption, {
          x: margin,
          y: 792 - margin,
          size: 11,
          font,
          color: rgb(0.1, 0.1, 0.12),
        });
        page.drawImage(img, {
          x: margin + (maxW - w) / 2,
          y: margin + (maxH - h) / 2,
          width: w,
          height: h,
        });
      }
    } catch {
      // Skip a single unreadable/corrupt attachment rather than fail the seal.
    }
  }
  return pdf.save();
}
