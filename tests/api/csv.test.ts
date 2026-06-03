import { parseRecipientsCsv } from '@penpact/api/csv';
import { describe, expect, it } from 'vitest';

describe('parseRecipientsCsv', () => {
  it('parses a name,email header in any order', () => {
    const rows = parseRecipientsCsv(
      'email,name\nada@x.test,Ada Lovelace\ngrace@x.test,Grace Hopper',
    );
    expect(rows).toEqual([
      { name: 'Ada Lovelace', email: 'ada@x.test' },
      { name: 'Grace Hopper', email: 'grace@x.test' },
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const rows = parseRecipientsCsv('name,email\n"Doe, John",john@x.test');
    expect(rows).toEqual([{ name: 'Doe, John', email: 'john@x.test' }]);
  });

  it('trims whitespace and skips blank lines', () => {
    const rows = parseRecipientsCsv('name, email\n  Ada , ada@x.test \n\n');
    expect(rows).toEqual([{ name: 'Ada', email: 'ada@x.test' }]);
  });

  it('throws when a required column is missing', () => {
    expect(() => parseRecipientsCsv('firstname,email\nAda,ada@x.test')).toThrow();
  });

  it('throws on an empty document', () => {
    expect(() => parseRecipientsCsv('   ')).toThrow();
  });
});
