import {
  buildFieldValues,
  documentUrl,
  initialsOf,
  loadSession,
  postComplete,
  postConsent,
  postDecline,
} from '@penpact/signing-ui/controller';
import { describe, expect, it } from 'vitest';

type Field = { id: string; type: string; signerId: string };

const fakeFetch = (status: number, body: unknown = {}) =>
  (async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  })) as unknown as typeof fetch;

describe('signing-ui controller', () => {
  it('initialsOf builds uppercase initials, capped at 4', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('  jean luc  picard ')).toBe('JLP');
    expect(initialsOf('madonna')).toBe('M');
    expect(initialsOf('')).toBe('');
  });

  it('buildFieldValues maps signature/name to the full name and initials field', () => {
    const fields: Field[] = [
      { id: 'f1', type: 'signature', signerId: 's' },
      { id: 'f2', type: 'name', signerId: 's' },
      { id: 'f3', type: 'initials', signerId: 's' },
    ];
    const result = buildFieldValues(fields, 'Ada Lovelace', {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values).toEqual([
        { fieldId: 'f1', value: 'Ada Lovelace' },
        { fieldId: 'f2', value: 'Ada Lovelace' },
        { fieldId: 'f3', value: 'AL' },
      ]);
    }
  });

  it('buildFieldValues uses provided inputs for text/date and skips empty optionals', () => {
    const fields: Field[] = [
      { id: 'd', type: 'date', signerId: 's' },
      { id: 't', type: 'text', signerId: 's' },
    ];
    const result = buildFieldValues(fields, 'Ada', { d: '2026-06-03', t: '' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // empty optional text is skipped; date is included
      expect(result.values).toEqual([{ fieldId: 'd', value: '2026-06-03' }]);
    }
  });

  it('buildFieldValues errors on a missing required field', () => {
    const fields: Field[] = [{ id: 't', type: 'text', signerId: 's', required: true } as Field];
    const result = buildFieldValues(fields, 'Ada', { t: '' });
    expect(result.ok).toBe(false);
  });

  it('documentUrl points at the signer document endpoint', () => {
    expect(documentUrl({ token: 'abc', apiBase: 'https://api.penpact.dev' })).toBe(
      'https://api.penpact.dev/v1/sign/abc/document',
    );
  });

  it('loadSession classifies responses', async () => {
    const okBody = { consentRequired: true, fields: [], signer: { id: 's' } };
    expect((await loadSession({ token: 't', fetch: fakeFetch(200, okBody) })).kind).toBe('ok');
    expect((await loadSession({ token: 't', fetch: fakeFetch(410) })).kind).toBe('gone');
    expect((await loadSession({ token: 't', fetch: fakeFetch(404) })).kind).toBe('notfound');
    const thrower = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect((await loadSession({ token: 't', fetch: thrower })).kind).toBe('error');
  });

  it('postConsent / postComplete / postDecline report ok on 2xx and error otherwise', async () => {
    expect((await postConsent({ token: 't', fetch: fakeFetch(204) }, 'hash')).ok).toBe(true);
    expect((await postConsent({ token: 't', fetch: fakeFetch(422) }, 'hash')).ok).toBe(false);

    expect(
      (
        await postComplete(
          { token: 't', fetch: fakeFetch(200) },
          { signatureType: 'typed', fields: [] },
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await postComplete(
          { token: 't', fetch: fakeFetch(409) },
          { signatureType: 'typed', fields: [] },
        )
      ).ok,
    ).toBe(false);

    expect((await postDecline({ token: 't', fetch: fakeFetch(200) }, 'no')).ok).toBe(true);
  });
});
