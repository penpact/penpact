import { app } from '@penpact/api';
import { describe, expect, it } from 'vitest';

describe('app (no DB required)', () => {
  it('GET /health → 200 ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('GET / → service info', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Penpact');
  });

  it('POST /v1/envelopes without auth → RFC 7807 401', async () => {
    const res = await app.request('/v1/envelopes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const body = await res.json();
    expect(body.status).toBe(401);
    expect(body.title).toBe('Unauthorized');
    expect(typeof body.type).toBe('string');
  });
});
