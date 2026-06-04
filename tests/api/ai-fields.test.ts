import {
  callGemini,
  callOpenAI,
  extractProposals,
  proposeFields,
  selectedAiProvider,
} from '@penpact/api/ai-fields';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const PROPOSALS = '[{"type":"signature","page":1,"x":100,"y":200,"width":180,"height":40}]';

describe('extractProposals', () => {
  it('parses a fenced JSON array and assigns to the primary signer', () => {
    const text =
      'Here you go:\n```json\n[{"type":"signature","page":1,"x":100,"y":200,"width":180,"height":40},' +
      '{"type":"date","page":1,"x":300,"y":200,"width":80,"height":20}]\n```';
    const out = extractProposals(text, ['signer-1', 'signer-2']);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      type: 'signature',
      signerId: 'signer-1',
      page: 1,
      aiDetected: true,
      required: true,
      value: null,
    });
  });

  it('skips unknown types and non-positive geometry', () => {
    const text =
      '[{"type":"nope","page":1,"x":1,"y":1,"width":10,"height":10},' +
      '{"type":"name","page":1,"x":1,"y":1,"width":0,"height":10}]';
    expect(extractProposals(text, ['s1'])).toHaveLength(0);
  });

  it('returns [] without signers, and on non-JSON output', () => {
    expect(
      extractProposals('[{"type":"signature","page":1,"x":1,"y":1,"width":10,"height":10}]', []),
    ).toHaveLength(0);
    expect(extractProposals('sorry, I found no fields', ['s1'])).toHaveLength(0);
  });
});

describe('multi-provider AI', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    for (const k of [
      'ANTHROPIC_API_KEY',
      'GEMINI_API_KEY',
      'GOOGLE_API_KEY',
      'OPENAI_API_KEY',
      'AI_PROVIDER',
    ]) {
      delete process.env[k];
    }
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('selects a provider from the configured keys, honoring AI_PROVIDER', () => {
    expect(selectedAiProvider()).toBeNull();
    process.env.OPENAI_API_KEY = 'sk-x';
    expect(selectedAiProvider()).toBe('openai');
    process.env.ANTHROPIC_API_KEY = 'sk-a';
    expect(selectedAiProvider()).toBe('anthropic'); // default order: anthropic first
    process.env.GEMINI_API_KEY = 'g';
    process.env.AI_PROVIDER = 'gemini';
    expect(selectedAiProvider()).toBe('gemini'); // explicit override honored
    process.env.AI_PROVIDER = 'openai';
    expect(selectedAiProvider()).toBe('openai');
  });

  it('calls Gemini with native PDF and parses its text', async () => {
    process.env.GEMINI_API_KEY = 'g-key';
    let captured: { url: string; body: Record<string, unknown> } | null = null;
    const fetchMock = (async (url: string, init: RequestInit) => {
      captured = { url, body: JSON.parse(init.body as string) };
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: PROPOSALS }] } }] }),
      };
    }) as unknown as typeof fetch;

    const text = await callGemini(new Uint8Array([1, 2, 3]), fetchMock);
    expect(text).toBe(PROPOSALS);
    expect(captured?.url).toContain('generativelanguage.googleapis.com');
    expect(captured?.url).toContain('key=g-key');
    expect(
      (
        captured?.body as {
          contents: Array<{ parts: Array<{ inlineData?: { mimeType: string } }> }>;
        }
      ).contents[0].parts[0].inlineData?.mimeType,
    ).toBe('application/pdf');
  });

  it('calls OpenAI with a PDF file input and parses its content', async () => {
    process.env.OPENAI_API_KEY = 'sk-key';
    let captured: { url: string; auth: string; body: Record<string, unknown> } | null = null;
    const fetchMock = (async (url: string, init: RequestInit) => {
      captured = {
        url,
        auth: (init.headers as Record<string, string>).authorization,
        body: JSON.parse(init.body as string),
      };
      return { ok: true, json: async () => ({ choices: [{ message: { content: PROPOSALS } }] }) };
    }) as unknown as typeof fetch;

    const text = await callOpenAI(new Uint8Array([1, 2, 3]), fetchMock);
    expect(text).toBe(PROPOSALS);
    expect(captured?.url).toContain('api.openai.com');
    expect(captured?.auth).toBe('Bearer sk-key');
    const content = (
      captured?.body as {
        messages: Array<{ content: Array<{ type: string; file?: { file_data: string } }> }>;
      }
    ).messages[0].content;
    expect(content[0].type).toBe('file');
    expect(content[0].file?.file_data).toContain('data:application/pdf;base64,');
  });

  it('proposeFields dispatches to the selected provider and parses proposals', async () => {
    process.env.OPENAI_API_KEY = 'sk-key';
    process.env.AI_PROVIDER = 'openai';
    const fetchMock = (async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: PROPOSALS } }] }),
    })) as unknown as typeof fetch;

    const out = await proposeFields(new Uint8Array([1]), ['signer-1'], { fetch: fetchMock });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'signature', signerId: 'signer-1' });
  });

  it('returns [] when no provider is configured, and degrades on provider error', async () => {
    expect(await proposeFields(new Uint8Array([1]), ['s1'])).toEqual([]);

    process.env.GEMINI_API_KEY = 'g';
    const boom = (async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    expect(await proposeFields(new Uint8Array([1]), ['s1'], { fetch: boom })).toEqual([]);
  });
});
