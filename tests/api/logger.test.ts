import { logger } from '@penpact/api/logger';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('structured logger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes one JSON line with level, msg, time and merged fields to stdout', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.info('hello', { userId: 'u1' });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(line.level).toBe('info');
    expect(line.msg).toBe('hello');
    expect(line.userId).toBe('u1');
    expect(typeof line.time).toBe('string');
  });

  it('routes warn and error to stderr, not stdout', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.error('boom', { code: 500 });
    expect(err).toHaveBeenCalledTimes(1);
    expect(out).not.toHaveBeenCalled();
  });

  it('suppresses debug below the default (info) threshold', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.debug('quiet');
    expect(spy).not.toHaveBeenCalled();
  });
});
