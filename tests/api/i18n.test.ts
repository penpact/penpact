import { buildInviteEmail, buildOtpEmail } from '@penpact/api/email';
import { fill, normalizeLocale, strings } from '@penpact/api/i18n';
import { describe, expect, it } from 'vitest';

describe('i18n', () => {
  it('normalizes locales and falls back to en', () => {
    expect(normalizeLocale('es')).toBe('es');
    expect(normalizeLocale('fr-CA')).toBe('fr');
    expect(normalizeLocale('xx')).toBe('en');
    expect(normalizeLocale(null)).toBe('en');
  });

  it('fills placeholders', () => {
    expect(fill('Hi {name}, sign {doc}', { name: 'Ada', doc: 'NDA' })).toBe('Hi Ada, sign NDA');
  });

  it('translates the invite email by locale', () => {
    const en = buildInviteEmail({
      to: 'a@x',
      signerName: 'Ada',
      documentName: 'NDA',
      signUrl: 'u',
      locale: 'en',
    });
    expect(en.subject).toBe('Please sign: NDA');

    const es = buildInviteEmail({
      to: 'a@x',
      signerName: 'Ada',
      documentName: 'NDA',
      signUrl: 'u',
      locale: 'es',
    });
    expect(es.subject).toBe('Por favor, firme: NDA');
    expect(es.html).toContain('Hola Ada');

    const fr = buildInviteEmail({
      to: 'a@x',
      signerName: 'Ada',
      documentName: 'NDA',
      signUrl: 'u',
      locale: 'fr',
    });
    expect(fr.subject).toBe('Veuillez signer : NDA');
  });

  it('translates the OTP email and keeps the code in the subject', () => {
    const de = buildOtpEmail({ to: 'a@x', name: 'Ada', code: '123456', locale: 'de' });
    expect(de.subject).toContain('123456');
    expect(de.html).toContain('Hallo Ada');
  });

  it('defaults unknown locales to english strings', () => {
    expect(strings('zz').signButton).toBe('Sign document');
  });
});
