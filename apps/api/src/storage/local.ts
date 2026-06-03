import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Storage } from './types.js';

/** Local-filesystem storage for development and self-hosting. */
export class LocalStorage implements Storage {
  readonly #baseDir: string;

  constructor(baseDir: string) {
    this.#baseDir = resolve(baseDir);
  }

  #resolve(key: string): string {
    const target = resolve(this.#baseDir, key);
    if (target !== this.#baseDir && !target.startsWith(this.#baseDir + '/')) {
      throw new Error(`Refusing to access key outside storage root: ${key}`);
    }
    return target;
  }

  async put(key: string, bytes: Uint8Array, _contentType: string): Promise<void> {
    const path = this.#resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.#resolve(key)));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.#resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
