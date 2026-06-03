import { PenpactClient } from '@penpact/sdk';
import { describe, expect, it } from 'vitest';

describe('PenpactClient', () => {
  it('requires an apiKey', () => {
    expect(() => new PenpactClient({ apiKey: '' })).toThrow();
  });

  it('defaults and normalizes the base URL', () => {
    const client = new PenpactClient({
      apiKey: 'pk_test_x',
      baseUrl: 'https://api.example.com/',
    });
    expect(client.baseUrl).toBe('https://api.example.com');
  });

  it('uses the managed cloud base URL by default', () => {
    const client = new PenpactClient({ apiKey: 'pk_test_x' });
    expect(client.baseUrl).toBe('https://api.penpact.dev');
  });
});
