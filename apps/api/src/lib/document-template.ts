/**
 * Dependency-free document generation: merge {{variables}} into a lightweight
 * markdown-ish template and render a paginated PDF with pdf-lib. Supports
 * `# heading`, `## subheading`, blank-line paragraphs, and `- ` bullets with
 * word wrapping. Full HTML/DOCX fidelity would need a headless renderer
 * (Puppeteer/LibreOffice); this covers straightforward generated contracts
 * without adding a heavy runtime dependency.
 */
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';

/** Replace {{var}} placeholders. Unknown variables become empty strings. */
export function mergeVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => variables[key] ?? '');
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 64;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface Block {
  text: string;
  size: number;
  font: 'regular' | 'bold';
  gap: number;
  bullet?: boolean;
}

function parseBlocks(merged: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of merged.split(/\r?\n/)) {
    const l = raw.trimEnd();
    if (l.trim() === '') {
      blocks.push({ text: '', size: 6, font: 'regular', gap: 6 });
    } else if (l.startsWith('## ')) {
      blocks.push({ text: l.slice(3), size: 14, font: 'bold', gap: 8 });
    } else if (l.startsWith('# ')) {
      blocks.push({ text: l.slice(2), size: 20, font: 'bold', gap: 12 });
    } else if (l.startsWith('- ')) {
      blocks.push({ text: l.slice(2), size: 11, font: 'regular', gap: 4, bullet: true });
    } else {
      blocks.push({ text: l, size: 11, font: 'regular', gap: 6 });
    }
  }
  return blocks;
}

/** Render a merged template to a paginated PDF. */
export async function renderTemplatePdf(
  template: string,
  variables: Record<string, string> = {},
): Promise<Uint8Array> {
  const merged = mergeVariables(template, variables);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  for (const block of parseBlocks(merged)) {
    const font = block.font === 'bold' ? bold : regular;
    if (block.text === '') {
      y -= block.gap;
      continue;
    }
    const indent = block.bullet ? 16 : 0;
    const lines = wrap(block.text, font, block.size, CONTENT_W - indent);
    for (let i = 0; i < lines.length; i++) {
      const lineHeight = block.size * 1.35;
      if (y - lineHeight < MARGIN) newPage();
      const prefix = block.bullet && i === 0 ? '•  ' : '';
      page.drawText(prefix + (lines[i] as string), {
        x: MARGIN + indent,
        y: y - block.size,
        size: block.size,
        font,
        color: rgb(0.1, 0.1, 0.12),
      });
      y -= lineHeight;
    }
    y -= block.gap;
  }

  return pdf.save();
}
