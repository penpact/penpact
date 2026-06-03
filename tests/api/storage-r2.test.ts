import { r2ObjectUrl } from '@penpact/api/storage';
import { describe, expect, it } from 'vitest';

describe('r2ObjectUrl', () => {
  it('joins base and key, preserving path separators', () => {
    expect(r2ObjectUrl('https://acct.r2.cloudflarestorage.com/bucket', 'envelopes/abc/source.pdf')).toBe(
      'https://acct.r2.cloudflarestorage.com/bucket/envelopes/abc/source.pdf',
    );
  });

  it('normalizes a trailing slash on the base', () => {
    expect(r2ObjectUrl('https://x/bucket/', 'a/b.pdf')).toBe('https://x/bucket/a/b.pdf');
  });

  it('url-encodes unsafe characters within segments but keeps slashes', () => {
    expect(r2ObjectUrl('https://x/b', 'a b/c#d.pdf')).toBe('https://x/b/a%20b/c%23d.pdf');
  });
});
