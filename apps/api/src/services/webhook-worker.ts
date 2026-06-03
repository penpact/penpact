/**
 * Background webhook delivery worker. Periodically drains due deliveries from
 * the durable queue. Single in-process timer (fine for a single-instance
 * deploy); the drain itself is idempotent per row and safe to run often. The
 * core `drainDueDeliveries` is unit-tested; this is the scheduler glue.
 */
import { getDb } from '../db.js';
import { drainDueDeliveries } from './webhooks.js';

let timer: ReturnType<typeof setInterval> | null = null;

export function startWebhookWorker(intervalMs = 15_000): void {
  if (timer) return;
  timer = setInterval(() => {
    void drainDueDeliveries(getDb()).catch((err) => {
      console.error('webhook worker drain failed:', err);
    });
  }, intervalMs);
  // Do not keep the process alive solely for this timer.
  if (typeof timer.unref === 'function') timer.unref();
}

export function stopWebhookWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
