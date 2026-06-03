import { mergeVariables, renderTemplatePdf } from '@penpact/api/document-template';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

describe('document template', () => {
  it('merges {{variables}} and blanks unknown ones', () => {
    expect(
      mergeVariables('Dear {{name}}, you owe {{amount}}.', { name: 'Ada', amount: '$10' }),
    ).toBe('Dear Ada, you owe $10.');
    expect(mergeVariables('Hello {{ missing }} world', {})).toBe('Hello  world');
  });

  it('renders a merged template to a multi-line PDF', async () => {
    const template = `# Service Agreement

This agreement is between {{company}} and {{client}}.

## Terms

- Payment is due within 30 days.
- Either party may terminate with notice.

${'A long paragraph that should wrap across multiple lines. '.repeat(40)}`;
    const bytes = await renderTemplatePdf(template, { company: 'Penpact', client: 'Ada Lovelace' });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
