/**
 * Background reminder worker. Periodically sends due reminders for envelopes
 * that opted in via `reminderEveryHours`. The claim is atomic, so this is safe
 * to run on every instance. `processReminders` is unit/integration-tested; this
 * is just the scheduler glue.
 */
import { getDb } from '../db.js';
import { logger } from '../lib/logger.js';
import { processReminders } from './reminders.js';

let timer: ReturnType<typeof setInterval> | null = null;

export function startReminderWorker(intervalMs = 600_000): void {
  if (timer) return;
  timer = setInterval(() => {
    void processReminders(getDb())
      .then((n) => {
        if (n > 0) logger.info('reminders sent', { count: n });
      })
      .catch((err) => {
        logger.error('reminder worker failed', { err: String(err) });
      });
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
}

export function stopReminderWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
