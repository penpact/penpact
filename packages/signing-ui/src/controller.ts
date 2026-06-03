/**
 * Framework-agnostic signing controller. All logic for the `<Sign/>` component
 * lives here as pure, dependency-injected functions so it can be unit-tested in
 * node without a DOM. It drives the same `/v1/sign/:token` API the hosted page
 * uses. The sealer renders field values as text, so signatures are typed.
 */

export interface SignerField {
  id: string;
  type: string;
  signerId: string;
  required?: boolean;
}

export interface SignerInfo {
  id: string;
  name: string;
  email: string;
  status: string;
}

export interface ConsentDisclosure {
  version: string;
  text: string;
  hash: string;
}

export interface SigningSessionData {
  envelopeId: string;
  documentName: string;
  signer: SignerInfo;
  documentUrl: string;
  fields: SignerField[];
  consentRequired: boolean;
  consentDisclosure: ConsentDisclosure | null;
}

export interface ControllerDeps {
  token: string;
  /** API origin, e.g. "https://api.penpact.dev". Defaults to same-origin. */
  apiBase?: string;
  /** Injected for testing; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export type SignatureType = 'drawn' | 'typed' | 'adopted' | 'uploaded';

export interface CompleteInput {
  signatureType: SignatureType;
  fields: Array<{ fieldId: string; value: string }>;
}

export type LoadResult =
  | { kind: 'ok'; session: SigningSessionData }
  | { kind: 'gone' }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string };

export type BuildResult =
  | { ok: true; values: Array<{ fieldId: string; value: string }> }
  | { ok: false; error: string };

function api(deps: ControllerDeps, suffix = ''): string {
  const base = deps.apiBase ?? '';
  return `${base}/v1/sign/${deps.token}${suffix}`;
}

function impl(deps: ControllerDeps): typeof fetch {
  return deps.fetch ?? (globalThis.fetch as typeof fetch);
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 4);
}

/** The browser-rendered PDF preview URL for this signer. */
export function documentUrl(deps: ControllerDeps): string {
  return api(deps, '/document');
}

/**
 * Map a signer's fields to submittable values: signature/name fields take the
 * typed full name, initials fields take derived initials, and everything else
 * takes the matching entry from `inputs`. Empty optional fields are skipped;
 * an empty required field is an error.
 */
export function buildFieldValues(
  fields: SignerField[],
  fullName: string,
  inputs: Record<string, string>,
): BuildResult {
  const values: Array<{ fieldId: string; value: string }> = [];
  for (const f of fields) {
    let value: string;
    if (f.type === 'signature' || f.type === 'name') {
      value = fullName;
    } else if (f.type === 'initials') {
      value = initialsOf(fullName);
    } else {
      value = inputs[f.id] ?? '';
    }
    if (f.required && !value) {
      return { ok: false, error: 'Please complete all required fields.' };
    }
    if (value) {
      values.push({ fieldId: f.id, value });
    }
  }
  return { ok: true, values };
}

export async function loadSession(deps: ControllerDeps): Promise<LoadResult> {
  try {
    const res = await impl(deps)(api(deps), { headers: { accept: 'application/json' } });
    if (res.status === 410) return { kind: 'gone' };
    if (res.status === 404) return { kind: 'notfound' };
    if (!res.ok) return { kind: 'error', message: `Request failed (${res.status}).` };
    return { kind: 'ok', session: (await res.json()) as SigningSessionData };
  } catch {
    return { kind: 'error', message: 'Could not load the document.' };
  }
}

async function post(
  deps: ControllerDeps,
  suffix: string,
  body?: unknown,
): Promise<{ ok: boolean }> {
  try {
    const res = await impl(deps)(api(deps, suffix), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export function postConsent(
  deps: ControllerDeps,
  disclosureHash: string,
): Promise<{ ok: boolean }> {
  return post(deps, '/consent', { disclosureHash, agree: true });
}

export function postComplete(deps: ControllerDeps, input: CompleteInput): Promise<{ ok: boolean }> {
  return post(deps, '/complete', input);
}

export function postDecline(deps: ControllerDeps, reason?: string): Promise<{ ok: boolean }> {
  return post(deps, '/decline', reason ? { reason } : {});
}
