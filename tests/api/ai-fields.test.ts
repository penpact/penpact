import { extractProposals } from '@penpact/api/ai-fields';
import { describe, expect, it } from 'vitest';

describe('extractProposals', () => {
  it('parses a fenced JSON array and assigns to the primary signer', () => {
    const text =
      'Here you go:\n```json\n[{"type":"signature","page":1,"x":100,"y":200,"width":180,"height":40},' +
      '{"type":"date","page":1,"x":300,"y":200,"width":80,"height":20}]\n```';
    const out = extractProposals(text, ['signer-1', 'signer-2']);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      type: 'signature',
      signerId: 'signer-1',
      page: 1,
      aiDetected: true,
      required: true,
      value: null,
    });
  });

  it('skips unknown types and non-positive geometry', () => {
    const text =
      '[{"type":"nope","page":1,"x":1,"y":1,"width":10,"height":10},' +
      '{"type":"name","page":1,"x":1,"y":1,"width":0,"height":10}]';
    expect(extractProposals(text, ['s1'])).toHaveLength(0);
  });

  it('returns [] without signers, and on non-JSON output', () => {
    expect(
      extractProposals('[{"type":"signature","page":1,"x":1,"y":1,"width":10,"height":10}]', []),
    ).toHaveLength(0);
    expect(extractProposals('sorry, I found no fields', ['s1'])).toHaveLength(0);
  });
});
