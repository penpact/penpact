/**
 * Object storage for documents. The cloud uses R2/S3 with versioning +
 * object-lock for immutable retention; self-host defaults to local disk.
 * Keys are server-generated (e.g. `envelopes/{id}/source.pdf`), never user input.
 */
export interface Storage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  exists(key: string): Promise<boolean>;
}
