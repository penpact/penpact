/**
 * Transactional email (signing invitations). Provider-agnostic over HTTP; today targets
 * Resend. No-op when unconfigured so the signing flow still works (events are recorded
 * regardless). Send from a subdomain (e.g. send.penpact.dev) to protect root reputation.
 */
export interface SigningInvite {
  to: string;
  signerName: string;
  documentName: string;
  signUrl: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendSigningInvite(invite: SigningInvite): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return; // not configured — delivery is skipped, signing still works
  }
  const from = process.env.EMAIL_FROM ?? 'Penpact <hello@penpact.dev>';
  const name = escapeHtml(invite.signerName);
  const doc = escapeHtml(invite.documentName);
  const html = `<p>Hi ${name},</p>
<p><strong>${doc}</strong> is ready for your signature.</p>
<p><a href="${invite.signUrl}">Review &amp; sign the document</a></p>
<p>If you did not expect this, you can ignore this email.</p>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: invite.to,
        subject: `Please sign: ${invite.documentName}`,
        html,
      }),
    });
  } catch {
    // Best-effort; a durable send/retry queue arrives with the dashboard (Phase 5).
  }
}
