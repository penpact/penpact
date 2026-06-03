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

  it('GET /sign/:token → self-contained HTML signing page', async () => {
    const res = await app.request('/sign/abc123token');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('<!doctype html>');
    // The signer token is embedded so the page can call the /v1/sign API.
    expect(html).toContain('abc123token');
    // No external script/style dependencies (CSP-friendly, works offline).
    expect(html).not.toContain('http://');
    expect(html).not.toContain('src="https://');
    // Keep signing pages out of search indexes.
    expect(html).toContain('noindex');
  });

  it('GET /sign/:token → escapes nothing dangerous from the token', async () => {
    const res = await app.request(`/sign/${encodeURIComponent('"></script>')}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Token is injected via JSON.stringify, so a raw </script> must not appear verbatim.
    expect(html).not.toContain('"></script>');
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
