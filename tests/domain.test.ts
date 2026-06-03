import { AUDIT_EVENT_TYPES, ENVELOPE_STATUSES, HASH_ALGORITHM } from '@penpact/core';
import { describe, expect, it } from 'vitest';

describe('domain model', () => {
  it('uses SHA-256 for document integrity', () => {
    expect(HASH_ALGORITHM).toBe('SHA-256');
  });

  it('covers the §8 audit-trail events', () => {
    const required = [
      'envelope_created',
      'consent_accepted',
      'signed',
      'completed',
      'copy_delivered',
    ];
    for (const event of required) {
      expect(AUDIT_EVENT_TYPES).toContain(event);
    }
  });

  it('has no duplicate envelope statuses', () => {
    expect(new Set(ENVELOPE_STATUSES).size).toBe(ENVELOPE_STATUSES.length);
  });
});
