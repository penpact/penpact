/**
 * Minimal structured logger: one JSON object per line (machine-parseable in
 * Railway / any log aggregator), level-filtered via LOG_LEVEL (default info),
 * warn/error to stderr. No dependency. CLI entrypoints (bin/*) keep console
 * for human-facing output.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const envLevel = process.env.LOG_LEVEL as Level | undefined;
const threshold = (envLevel && LEVELS[envLevel]) || LEVELS.info;

function emit(level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (LEVELS[level] < threshold) return;
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields });
  const stream = level === 'warn' || level === 'error' ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};
