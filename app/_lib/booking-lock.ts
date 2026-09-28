import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { customerBookings } from '../../db/schema';

// All decisions, reschedules and delivery share this fence. Provider requests are
// bounded; renew before every external mutation and compare the token on release.
export async function withBookingLock<T>(id: string, operation: (guard: () => Promise<void>) => Promise<T>) {
  const { getDb } = await import('../../db');
  const db = getDb(), token = crypto.randomUUID();
  const acquired = await db.update(customerBookings).set({ workflowLock: token, workflowLockUntil: Date.now() + 300_000 })
    .where(and(eq(customerBookings.id, id), or(isNull(customerBookings.workflowLock), lt(customerBookings.workflowLockUntil, Date.now())))).returning({ id: customerBookings.id });
  if (!acquired.length) throw new Error('This request is being processed. Refresh shortly.');
  const guard = async () => {
    const rows = await db.update(customerBookings).set({ workflowLockUntil: Date.now() + 300_000 })
      .where(and(eq(customerBookings.id, id), eq(customerBookings.workflowLock, token), gt(customerBookings.workflowLockUntil, Date.now()))).returning({ id: customerBookings.id });
    if (!rows.length) throw new Error('Processing lease ended. Recovery will continue automatically.');
  };
  try { return await operation(guard); }
  finally { await db.update(customerBookings).set({ workflowLock: null, workflowLockUntil: null }).where(and(eq(customerBookings.id, id), eq(customerBookings.workflowLock, token))); }
}
