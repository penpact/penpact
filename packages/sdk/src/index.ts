/**
 * @penpact/sdk — official TypeScript client for the Penpact e-signature API.
 *
 * First-class types are the wedge: integrators get fully-typed envelope/field
 * inputs and responses. Network methods are stubbed for now; the shape below is
 * the contract we build against.
 */
import type { EnvelopeStatus, FieldType, SignerStatus } from '@penpact/core';

export interface PenpactClientOptions {
  /** Secret API key (pk_live_… / pk_test_…). */
  apiKey: string;
  /** Override the API base URL (defaults to the managed cloud). */
  baseUrl?: string;
}

export interface Signer {
  id: string;
  name: string;
  email: string;
  status: SignerStatus;
}

export interface Field {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
}

export interface Envelope {
  id: string;
  documentName: string;
  status: EnvelopeStatus;
  signers: Signer[];
  fields: Field[];
}

const DEFAULT_BASE_URL = 'https://api.penpact.dev';

export class PenpactClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;

  constructor(options: PenpactClientOptions) {
    if (!options.apiKey) {
      throw new Error('PenpactClient: `apiKey` is required.');
    }
    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  /** The resolved API base URL this client targets. */
  get baseUrl(): string {
    return this.#baseUrl;
  }

  /** Internal: present so the secret is captured and not flagged as unused. */
  protected get authorizationHeader(): string {
    return `Bearer ${this.#apiKey}`;
  }
}

export type { EnvelopeStatus, FieldType, SignerStatus } from '@penpact/core';
