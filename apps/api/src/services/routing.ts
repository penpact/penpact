/**
 * Sequential signing order. Signers sharing the lowest routing order among the
 * not-yet-finished signers are "active" and may sign; later orders activate
 * only once every earlier signer has signed or declined. When every signer
 * defaults to order 1, all are active at once (parallel signing).
 */
export interface RoutingSigner {
  routingOrder: number;
  status: string;
}

const FINISHED = new Set(['signed', 'declined']);

export function activeOrder(signers: RoutingSigner[]): number | null {
  const pending = signers.filter((s) => !FINISHED.has(s.status));
  if (pending.length === 0) return null;
  return Math.min(...pending.map((s) => s.routingOrder));
}

export function isActiveSigner(signer: RoutingSigner, all: RoutingSigner[]): boolean {
  if (FINISHED.has(signer.status)) return false;
  const order = activeOrder(all);
  return order !== null && signer.routingOrder === order;
}
