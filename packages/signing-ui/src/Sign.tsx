import { useEffect, useMemo, useState } from 'react';
import {
  buildFieldValues,
  type ControllerDeps,
  documentUrl,
  loadSession,
  postComplete,
  postConsent,
  postDecline,
  type SignerField,
  type SigningSessionData,
} from './controller.js';

export interface SignProps {
  /** The signer's token from the invitation link. */
  token: string;
  /** API origin, e.g. "https://api.penpact.dev". Defaults to same-origin. */
  apiBase?: string;
  onComplete?: (envelopeId: string) => void;
  onDecline?: () => void;
  onError?: (message: string) => void;
  /** Class applied to the root element for host-app styling. */
  className?: string;
}

type Phase = 'loading' | 'gone' | 'notfound' | 'error' | 'consent' | 'sign' | 'done' | 'declined';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Drop-in signing experience rendered natively in the host app. The document
 * itself is shown via the browser's PDF viewer; the consent and signature
 * chrome are plain React elements the host can style with `className`.
 */
export function Sign(props: SignProps): JSX.Element {
  const deps: ControllerDeps = useMemo(
    () =>
      props.apiBase !== undefined
        ? { token: props.token, apiBase: props.apiBase }
        : { token: props.token },
    [props.token, props.apiBase],
  );

  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<SigningSessionData | null>(null);
  const [fullName, setFullName] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setPhase('loading');
    loadSession(deps).then((r) => {
      if (!alive) return;
      if (r.kind === 'gone') return setPhase('gone');
      if (r.kind === 'notfound') return setPhase('notfound');
      if (r.kind === 'error') {
        props.onError?.(r.message);
        setErr(r.message);
        return setPhase('error');
      }
      const s = r.session;
      setSession(s);
      setFullName(s.signer.name ?? '');
      const seed: Record<string, string> = {};
      for (const f of s.fields) {
        if (f.type === 'date') seed[f.id] = today();
        if (f.type === 'email') seed[f.id] = s.signer.email ?? '';
      }
      setInputs(seed);
      setPhase(s.consentRequired ? 'consent' : 'sign');
    });
    return () => {
      alive = false;
    };
  }, [deps, props.onError]);

  const myFields: SignerField[] = session
    ? session.fields.filter((f) => f.signerId === session.signer.id)
    : [];
  const extraFields = myFields.filter((f) => !['signature', 'name', 'initials'].includes(f.type));

  async function continueFromConsent(): Promise<void> {
    if (!session?.consentDisclosure) return;
    setBusy(true);
    setErr('');
    const res = await postConsent(deps, session.consentDisclosure.hash);
    setBusy(false);
    if (res.ok) setPhase('sign');
    else setErr('Could not record your consent. Please try again.');
  }

  async function sign(): Promise<void> {
    if (!session) return;
    setErr('');
    const name = fullName.trim();
    if (!name) {
      setErr('Enter your full name to sign.');
      return;
    }
    const built = buildFieldValues(myFields, name, inputs);
    if (!built.ok) {
      setErr(built.error);
      return;
    }
    setBusy(true);
    const res = await postComplete(deps, { signatureType: 'typed', fields: built.values });
    setBusy(false);
    if (res.ok) {
      setPhase('done');
      props.onComplete?.(session.envelopeId);
    } else {
      setErr('Could not submit your signature. Please try again.');
    }
  }

  async function decline(): Promise<void> {
    const reason = window.prompt('Optionally, tell the sender why you are declining:') ?? undefined;
    setBusy(true);
    await postDecline(deps, reason);
    setBusy(false);
    setPhase('declined');
    props.onDecline?.();
  }

  const cls = props.className ? `penpact-sign ${props.className}` : 'penpact-sign';

  if (phase === 'loading') return <div className={cls}>Loading document…</div>;
  if (phase === 'gone') return <div className={cls}>This signing link is no longer active.</div>;
  if (phase === 'notfound') return <div className={cls}>Signing link not found.</div>;
  if (phase === 'error') return <div className={cls}>{err || 'Could not load this document.'}</div>;
  if (phase === 'done')
    return <div className={cls}>You're all set. This document has been signed.</div>;
  if (phase === 'declined') return <div className={cls}>You declined to sign.</div>;

  return (
    <div className={cls}>
      <iframe
        className="penpact-sign__doc"
        title="Document preview"
        src={`${documentUrl(deps)}#toolbar=1&view=FitH`}
        style={{ width: '100%', height: 420, border: '1px solid #ccc' }}
      />

      {phase === 'consent' && session?.consentDisclosure ? (
        <div className="penpact-sign__consent">
          <h3>Before you sign</h3>
          <pre className="penpact-sign__disclosure" style={{ whiteSpace: 'pre-wrap' }}>
            {session.consentDisclosure.text}
          </pre>
          <button type="button" disabled={busy} onClick={continueFromConsent}>
            I agree, continue
          </button>
          {err ? <p className="penpact-sign__error">{err}</p> : null}
        </div>
      ) : (
        <div className="penpact-sign__sign">
          <label>
            Full name
            <input
              type="text"
              value={fullName}
              autoComplete="name"
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <div
            className="penpact-sign__preview"
            style={{
              fontFamily: 'cursive',
              fontSize: 28,
              background: '#fff',
              color: '#111',
              padding: '6px 10px',
            }}
          >
            {fullName}
          </div>

          {extraFields.map((f) => (
            <label key={f.id}>
              {f.type}
              <input
                type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
                value={inputs[f.id] ?? ''}
                onChange={(e) => setInputs((prev) => ({ ...prev, [f.id]: e.target.value }))}
              />
            </label>
          ))}

          <button type="button" disabled={busy} onClick={sign}>
            {busy ? 'Signing…' : 'Sign document'}
          </button>
          <button type="button" disabled={busy} onClick={decline}>
            Decline to sign
          </button>
          {err ? <p className="penpact-sign__error">{err}</p> : null}
        </div>
      )}
    </div>
  );
}
