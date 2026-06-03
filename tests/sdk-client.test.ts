import { PenpactClient, PenpactError } from '@penpact/sdk';
import { describe, expect, it } from 'vitest';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('PenpactClient', () => {
  it('sends Bearer auth + JSON and parses the response', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const client = new PenpactClient({
      apiKey: 'pk_test_abc',
      baseUrl: 'https://api.test',
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse({ id: 'env_1', status: 'draft' }, 201);
      },
    });

    const env = await client.createEnvelope({
      documentName: 'NDA',
      signers: [{ name: 'Bob', email: 'b@x.com' }],
    });

    expect(env.id).toBe('env_1');
    expect(calls[0]?.url).toBe('https://api.test/v1/envelopes');
    expect(calls[0]?.init.method).toBe('POST');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer pk_test_abc');
    expect(JSON.parse(String(calls[0]?.init.body)).documentName).toBe('NDA');
  });

  it('maps RFC 7807 errors to PenpactError', async () => {
    const client = new PenpactClient({
      apiKey: 'pk_test_abc',
      fetch: async () =>
        jsonResponse(
          {
            status: 422,
            title: 'Validation Error',
            type: 'https://penpact.dev/errors/validation-error',
            detail: 'bad input',
          },
          422,
        ),
    });

    const error = await client.createEnvelope({ documentName: '', signers: [] }).catch((e) => e);
    expect(error).toBeInstanceOf(PenpactError);
    expect(error.status).toBe(422);
    expect(error.type).toContain('validation');
  });

  it('encodes list query parameters', async () => {
    let captured = '';
    const client = new PenpactClient({
      apiKey: 'pk_test_abc',
      baseUrl: 'https://api.test',
      fetch: async (url) => {
        captured = String(url);
        return jsonResponse({ data: [], pagination: { nextCursor: null, hasMore: false } }, 200);
      },
    });
    await client.listEnvelopes({ status: 'sent', limit: 5 });
    expect(captured).toContain('/v1/envelopes?');
    expect(captured).toContain('status=sent');
    expect(captured).toContain('limit=5');
  });
});
