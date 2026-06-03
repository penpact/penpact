import { buildInviteEmail, buildResetEmail, buildVerifyEmail } from '@penpact/api/email';
import { describe, expect, it } from 'vitest';

describe('email: buildInviteEmail', () => {
  it('addresses the signer, names the document, and links to the signing URL', () => {
    const msg = buildInviteEmail({
      to: 'grace@example.com',
      signerName: 'Grace Hopper',
      documentName: 'Mutual NDA',
      signUrl: 'https://api.penpact.dev/sign/abc123',
    });
    expect(msg.to).toBe('grace@example.com');
    expect(msg.subject).toContain('Mutual NDA');
    expect(msg.html).toContain('Grace Hopper');
    expect(msg.html).toContain('https://api.penpact.dev/sign/abc123');
  });

  it('escapes HTML in the signer name and document (no injection)', () => {
    const msg = buildInviteEmail({
      to: 'x@example.com',
      signerName: '<script>alert(1)</script>',
      documentName: '<b>doc</b>',
      signUrl: 'https://api.penpact.dev/sign/x',
    });
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('&lt;script&gt;');
    expect(msg.html).toContain('&lt;b&gt;doc&lt;/b&gt;');
  });
});

describe('email: account templates', () => {
  it('buildVerifyEmail asks to confirm and links to the verify URL', () => {
    const msg = buildVerifyEmail({ to: 'a@b.com', verifyUrl: 'https://api.penpact.dev/app?verify=tok' });
    expect(msg.to).toBe('a@b.com');
    expect(msg.subject.toLowerCase()).toMatch(/verify|confirm/);
    expect(msg.html).toContain('https://api.penpact.dev/app?verify=tok');
  });

  it('buildResetEmail mentions reset and links to the reset URL', () => {
    const msg = buildResetEmail({ to: 'a@b.com', resetUrl: 'https://api.penpact.dev/app?reset=tok' });
    expect(msg.to).toBe('a@b.com');
    expect(msg.subject.toLowerCase()).toContain('reset');
    expect(msg.html).toContain('https://api.penpact.dev/app?reset=tok');
  });
});
