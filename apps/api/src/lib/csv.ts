/**
 * Tiny CSV reader for bulk-send recipient lists. Not a general CSV library —
 * it handles a header row plus quoted fields (with embedded commas and escaped
 * `""` quotes), which is all the recipient upload needs.
 */

/** Split one CSV line into fields, honoring double-quoted segments. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

export interface CsvRecipient {
  name: string;
  email: string;
}

/**
 * Parse a CSV string into recipients. Requires a header row with `name` and
 * `email` columns (case-insensitive, any order). Blank lines are skipped.
 */
export function parseRecipientsCsv(csv: string): CsvRecipient[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one recipient.');
  }
  const header = splitLine(lines[0] as string).map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const emailIdx = header.indexOf('email');
  if (nameIdx === -1 || emailIdx === -1) {
    throw new Error('CSV must include "name" and "email" columns.');
  }
  const out: CsvRecipient[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i] as string);
    const name = (cells[nameIdx] ?? '').trim();
    const email = (cells[emailIdx] ?? '').trim();
    if (!name && !email) {
      continue;
    }
    out.push({ name, email });
  }
  if (out.length === 0) {
    throw new Error('No recipients found in the CSV.');
  }
  return out;
}
