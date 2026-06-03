/**
 * @penpact/sdk — official TypeScript client for the Penpact e-signature API.
 *
 * First-class types are the wedge: fully-typed envelope/field inputs and
 * responses, an injectable `fetch` (works in Node, browsers, edge, and tests),
 * and typed errors (RFC 7807).
 */
import type { AuthMethod, EnvelopeStatus, FieldType, SignerStatus } from '@penpact/core';

export interface PenpactClientOptions {
  /** Secret API key (pk_live_… / pk_test_…). */
  apiKey: string;
  /** Override the API base URL (defaults to the managed cloud). */
  baseUrl?: string;
  /** Inject a fetch implementation (custom runtimes, testing). Defaults to global fetch. */
  fetch?: typeof fetch;
}

export interface Signer {
  id: string;
  name: string;
  email: string;
  status: SignerStatus;
  routingOrder: number;
  signedAt: string | null;
}

export interface Field {
  id: string;
  type: FieldType;
  signerId: string | null;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  aiDetected: boolean;
  value: string | null;
}

export interface Envelope {
  id: string;
  documentName: string;
  status: EnvelopeStatus;
  senderName: string;
  senderEmail: string;
  documentHashOriginal: string | null;
  documentHashFinal: string | null;
  hashAlgorithm: string;
  signers: Signer[];
  fields: Field[];
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface SignerInput {
  name: string;
  email: string;
  routingOrder?: number;
  authMethod?: AuthMethod;
}

export interface EnvelopeCreateInput {
  documentName: string;
  signers: SignerInput[];
  expiresAt?: string;
}

export interface FieldInput {
  type: FieldType;
  signerId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required?: boolean;
}

export interface ListEnvelopesParams {
  status?: EnvelopeStatus;
  cursor?: string;
  limit?: number;
}

export interface Page<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean };
}

export interface Document {
  id: string;
  contentHash: string;
  mimeType: string;
  byteSize: number | null;
  pageCount: number | null;
  isFinal: boolean;
}

export interface TemplateRole {
  id: string;
  name: string;
  routingOrder: number;
}
export interface TemplateField {
  id: string;
  roleId: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
}
export interface Template {
  id: string;
  name: string;
  documentName: string;
  storageKey: string | null;
  pageCount: number | null;
  roles: TemplateRole[];
  fields: TemplateField[];
  createdAt: string;
}
export interface TemplateCreateInput {
  name: string;
  documentName: string;
  roles: Array<{ name: string; routingOrder?: number }>;
}
export interface TemplateFieldInput {
  type: FieldType;
  roleId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required?: boolean;
}
export interface InstantiateTemplateInput {
  signers: Array<{ roleId: string; name: string; email: string }>;
  documentName?: string;
  expiresAt?: string;
}

/** Error carrying the RFC 7807 problem details from the API. */
export class PenpactError extends Error {
  readonly status: number;
  readonly type: string;
  readonly detail: string | undefined;

  constructor(status: number, title: string, type: string, detail?: string) {
    super(detail ? `${title}: ${detail}` : title);
    this.name = 'PenpactError';
    this.status = status;
    this.type = type;
    this.detail = detail;
  }
}

const DEFAULT_BASE_URL = 'https://api.penpact.dev';

export class PenpactClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: PenpactClientOptions) {
    if (!options.apiKey) {
      throw new Error('PenpactClient: `apiKey` is required.');
    }
    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    const f = options.fetch ?? globalThis.fetch;
    if (!f) {
      throw new Error('PenpactClient: no fetch implementation available; pass `fetch`.');
    }
    this.#fetch = f;
  }

  get baseUrl(): string {
    return this.#baseUrl;
  }

  async createEnvelope(input: EnvelopeCreateInput): Promise<Envelope> {
    return this.#json<Envelope>('POST', '/v1/envelopes', input);
  }

  async getEnvelope(id: string): Promise<Envelope> {
    return this.#json<Envelope>('GET', `/v1/envelopes/${encodeURIComponent(id)}`);
  }

  async listEnvelopes(params: ListEnvelopesParams = {}): Promise<Page<Envelope>> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return this.#json<Page<Envelope>>('GET', `/v1/envelopes${qs ? `?${qs}` : ''}`);
  }

  async uploadDocument(envelopeId: string, pdf: Uint8Array): Promise<Document> {
    return this.#json<Document>(
      'PUT',
      `/v1/envelopes/${encodeURIComponent(envelopeId)}/document`,
      pdf,
    );
  }

  async placeFields(envelopeId: string, fields: FieldInput[]): Promise<Field[]> {
    const result = await this.#json<{ data: Field[] }>(
      'POST',
      `/v1/envelopes/${encodeURIComponent(envelopeId)}/fields`,
      { fields },
    );
    return result.data;
  }

  async send(envelopeId: string): Promise<Envelope> {
    return this.#json<Envelope>('POST', `/v1/envelopes/${encodeURIComponent(envelopeId)}/send`);
  }

  async voidEnvelope(envelopeId: string, reason?: string): Promise<Envelope> {
    return this.#json<Envelope>(
      'POST',
      `/v1/envelopes/${encodeURIComponent(envelopeId)}/void`,
      reason ? { reason } : {},
    );
  }

  async downloadDocument(envelopeId: string): Promise<Uint8Array> {
    return this.#bytes(`/v1/envelopes/${encodeURIComponent(envelopeId)}/document`);
  }

  async downloadCertificate(envelopeId: string): Promise<Uint8Array> {
    return this.#bytes(`/v1/envelopes/${encodeURIComponent(envelopeId)}/certificate`);
  }

  // ─── templates ───

  async createTemplate(input: TemplateCreateInput): Promise<Template> {
    return this.#json<Template>('POST', '/v1/templates', input);
  }

  async listTemplates(): Promise<Template[]> {
    return (await this.#json<{ data: Template[] }>('GET', '/v1/templates')).data;
  }

  async getTemplate(id: string): Promise<Template> {
    return this.#json<Template>('GET', `/v1/templates/${encodeURIComponent(id)}`);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.#request('DELETE', `/v1/templates/${encodeURIComponent(id)}`);
  }

  async uploadTemplateDocument(id: string, pdf: Uint8Array): Promise<Template> {
    return this.#json<Template>('PUT', `/v1/templates/${encodeURIComponent(id)}/document`, pdf);
  }

  async placeTemplateFields(id: string, fields: TemplateFieldInput[]): Promise<TemplateField[]> {
    const result = await this.#json<{ data: TemplateField[] }>(
      'POST',
      `/v1/templates/${encodeURIComponent(id)}/fields`,
      { fields },
    );
    return result.data;
  }

  /** Instantiate the template into a new draft envelope by mapping roles to signers. */
  async createEnvelopeFromTemplate(id: string, input: InstantiateTemplateInput): Promise<Envelope> {
    return this.#json<Envelope>('POST', `/v1/templates/${encodeURIComponent(id)}/envelopes`, input);
  }

  // ─── internals ───

  async #request(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { authorization: `Bearer ${this.#apiKey}` };
    let payload: BodyInit | null = null;
    if (body instanceof Uint8Array) {
      headers['content-type'] = 'application/pdf';
      // Copy into a plain ArrayBuffer — an unambiguous BodyInit across runtimes/TS libs.
      payload = body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength,
      ) as ArrayBuffer;
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await this.#fetch(`${this.#baseUrl}${path}`, { method, headers, body: payload });
    if (!res.ok) {
      await this.#throwProblem(res);
    }
    return res;
  }

  async #json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.#request(method, path, body);
    return (await res.json()) as T;
  }

  async #bytes(path: string): Promise<Uint8Array> {
    const res = await this.#request('GET', path);
    return new Uint8Array(await res.arrayBuffer());
  }

  async #throwProblem(res: Response): Promise<never> {
    let title = res.statusText || 'Request failed';
    let type = 'about:blank';
    let detail: string | undefined;
    try {
      const problem = (await res.json()) as {
        title?: string;
        type?: string;
        detail?: string;
      };
      if (problem.title) title = problem.title;
      if (problem.type) type = problem.type;
      if (problem.detail) detail = problem.detail;
    } catch {
      // non-JSON error body
    }
    throw new PenpactError(res.status, title, type, detail);
  }
}

export type {
  AuthMethod,
  EnvelopeStatus,
  FieldType,
  SignatureType,
  SignerStatus,
} from '@penpact/core';
