/**
 * Transactional email over Resend. `sendEmail` is the shared primitive (also
 * used by account verification / password reset); it is a no-op when
 * RESEND_API_KEY is unset, so flows keep working without email configured.
 * Send from the verified subdomain (send.penpact.dev) to protect root
 * reputation. `buildInviteEmail` is pure and unit-tested.
 */
export interface SigningInvite {
  to: string;
  signerName: string;
  documentName: string;
  signUrl: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DEFAULT_FROM = 'Penpact <noreply@send.penpact.dev>';

/** Send one transactional email. Returns the provider id, or null when unconfigured/failed. */
export async function sendEmail(msg: EmailMessage): Promise<{ id: string } | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null; // not configured — delivery skipped, the caller's flow still works
  }
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    if (!res.ok) {
      console.error('email send failed', res.status, body);
      return null;
    }
    if (body.id) {
      console.log('email sent', body.id, '->', msg.to);
      return { id: body.id };
    }
    return null;
  } catch (err) {
    console.error('email send error', err);
    return null;
  }
}

export function buildInviteEmail(invite: SigningInvite): EmailMessage {
  const name = escapeHtml(invite.signerName);
  const doc = escapeHtml(invite.documentName);
  const url = escapeHtml(invite.signUrl);
  return {
    to: invite.to,
    subject: `Please sign: ${invite.documentName}`,
    html: `<p>Hi ${name},</p>
<p><strong>${doc}</strong> is ready for your signature.</p>
<p><a href="${url}">Review &amp; sign the document</a></p>
<p>If you did not expect this, you can ignore this email.</p>`,
  };
}

export function sendSigningInvite(invite: SigningInvite): Promise<{ id: string } | null> {
  return sendEmail(buildInviteEmail(invite));
}

export function buildVerifyEmail(input: { to: string; verifyUrl: string }): EmailMessage {
  const url = escapeHtml(input.verifyUrl);
  return {
    to: input.to,
    subject: 'Verify your Penpact email',
    html: `<p>Welcome to Penpact.</p>
<p>Confirm your email address to finish setting up your account:</p>
<p><a href="${url}">Verify my email</a></p>
<p>If you did not create a Penpact account, you can ignore this email.</p>`,
  };
}

export function buildResetEmail(input: { to: string; resetUrl: string }): EmailMessage {
  const url = escapeHtml(input.resetUrl);
  return {
    to: input.to,
    subject: 'Reset your Penpact password',
    html: `<p>We received a request to reset your Penpact password.</p>
<p><a href="${url}">Choose a new password</a></p>
<p>This link expires in one hour. If you did not request this, you can ignore this email and your password stays the same.</p>`,
  };
}
