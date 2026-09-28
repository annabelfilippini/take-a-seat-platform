import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { customerBookings } from '../../db/schema';
import { getCustomerBooking, markBookingPaid, type CustomerBooking } from './bookings';
import { localDateTimeToUtc } from './availability';
import { authorizationDeadline, mutateStripeIntent, retrieveStripePaymentIntent, type StripePaymentIntent } from './stripe-payments';
import { bookingAvailabilityRevision, readBookingAvailabilityRevision } from './booking-revalidation';
import { approveBookingAndSendGoogleInvite, canConfirmBookingCalendar, syncBookingCalendar } from './google-calendar';
import { ensureBookingZoom, reserveZoomHost, releaseZoomHost, syncBookingZoom } from './zoom';
import { deliverBookingEmail } from './booking-communications';
import { withBookingLock } from './booking-lock';
import { getStripeSecretKey, STRIPE_API_VERSION } from './stripe-connect';

async function update(id: string, values: Partial<typeof customerBookings.$inferInsert>) {
  const { getDb } = await import('../../db');
  await getDb().update(customerBookings).set(values).where(eq(customerBookings.id, id));
}
async function intentFor(booking: CustomerBooking) {
  if (!booking.stripePaymentIntentId) throw new Error('Payment authorization is missing.');
  const intent = await retrieveStripePaymentIntent(booking.stripePaymentIntentId);
  if (intent.id !== booking.stripePaymentIntentId || intent.metadata?.booking_id !== booking.id) throw new Error('Stripe payment does not match this booking.');
  if (booking.offeringUnitAmount != null && (intent.amount !== booking.offeringUnitAmount || intent.currency !== booking.offeringCurrency)) throw new Error('Stripe amount does not match this booking.');
  return intent;
}
function capturable(intent: StripePaymentIntent, booking: CustomerBooking) {
  const deadline = authorizationDeadline(intent, booking.createdAt, localDateTimeToUtc(booking.appointmentStartAt, booking.timezone)?.getTime() ?? 0);
  if (intent.status !== 'requires_capture' || intent.capture_method !== 'manual' || !deadline.captureBefore || deadline.captureBefore <= Date.now() + 3600_000 || deadline.respondBy <= Date.now() || (booking.respondBy !== null && booking.respondBy <= Date.now()) || (intent.amount_capturable ?? 0) !== (booking.offeringUnitAmount ?? intent.amount)) return false;
  return deadline;
}
async function releaseAuthorization(booking: CustomerBooking, target: 'declined' | 'expired', guard: () => Promise<void>) {
  await update(booking.id, { creatorDecision: target === 'declined' ? 'decline' : 'expire', status: target === 'declined' ? 'decline_processing' : 'expiration_processing', workflowStep: 'release', workflowRetryAt: Date.now() });
  let intent = await intentFor(booking);
  if (intent.status === 'succeeded') throw new Error('Payment was captured outside this decision. Operator refund review is required.');
  if (intent.status !== 'canceled') { await guard(); intent = await mutateStripeIntent(intent.id, 'cancel'); }
  if (intent.id !== booking.stripePaymentIntentId || intent.status !== 'canceled') throw new Error('Payment release is not yet confirmed.');
  await guard();
  await update(booking.id, { status: target, updatedAt: new Date().toISOString(), workflowStep: 'email' });
  await releaseZoomHost(booking.id);
}

export async function acceptBooking(id: string) {
  return withBookingLock(id, async guard => {
    let booking = await getCustomerBooking(id);
    if (!booking) throw new Error('Request not found.');
    if (['paid', 'approved', 'approval_processing'].includes(booking.status)) return runRecoverable(booking, guard);
    if (booking.status !== 'payment_authorized' || booking.creatorDecision === 'decline' || booking.creatorDecision === 'expire') throw new Error('This request is no longer available for acceptance.');
    const intent = await intentFor(booking);
    const deadline = capturable(intent, booking);
    if (!deadline) {
      await update(id, { workflowRetryAt: Date.now(), workflowStep: 'release', creatorDecision: 'expire', status: 'expiration_processing' });
      return runRecoverable((await getCustomerBooking(id))!, guard);
    }
    const revision = await readBookingAvailabilityRevision(booking.creatorId);
    if (!await canConfirmBookingCalendar(booking)) throw new Error('This time now conflicts with your calendar or availability. Decline the request or resolve the conflict before the response deadline.');
    await guard();
    try { await reserveZoomHost(booking); }
    catch (error) { await releaseZoomHost(id); throw error; }
    const { getDb } = await import('../../db');
    const claimed = await getDb().update(customerBookings).set({ ...deadline, status: 'approval_processing', creatorDecision: 'accept', workflowStep: 'capture', workflowRetryAt: Date.now(), updatedAt: new Date().toISOString() })
      .where(and(eq(customerBookings.id, id), eq(customerBookings.status, 'payment_authorized'), sql`${revision} = (${bookingAvailabilityRevision(booking.creatorId)})`)).returning({ id: customerBookings.id });
    if (!claimed.length) { await releaseZoomHost(id); throw new Error('Availability changed. Refresh and review the request.'); }
    booking = (await getCustomerBooking(id))!;
    return runRecoverable(booking, guard);
  });
}
export async function declineBooking(id: string) {
  return withBookingLock(id, async guard => {
    const booking = await getCustomerBooking(id);
    if (!booking || !['payment_authorized', 'decline_processing', 'declined'].includes(booking.status) || booking.creatorDecision === 'accept') throw new Error('This request is no longer available to decline.');
    if (booking.status === 'payment_authorized') await update(id, { status: 'decline_processing', creatorDecision: 'decline', workflowStep: 'release', workflowRetryAt: Date.now() });
    return runRecoverable((await getCustomerBooking(id))!, guard);
  });
}
async function runRecoverable(booking: CustomerBooking, guard: () => Promise<void>) {
  try {
    await processBooking(booking, guard);
    await guard();
    await update(booking.id, { workflowRetryAt: null, workflowError: null, workflowAttempts: 0, workflowStep: 'complete' });
  } catch (error) {
    await guard(); // A stale worker must not overwrite the replacement worker's job.
    const attempts = booking.workflowAttempts + 1;
    const message = error instanceof Error ? error.message : 'Booking processing needs a retry.';
    await update(booking.id, { workflowRetryAt: Date.now() + Math.min(3600_000, 30_000 * 2 ** Math.min(attempts, 7)), workflowAttempts: attempts, workflowError: message });
    console.error(JSON.stringify({ event: 'booking_workflow_retry', bookingId: booking.id, step: (await getCustomerBooking(booking.id))?.workflowStep, attempts }));
  }
  return getCustomerBooking(booking.id);
}
async function processBooking(initial: CustomerBooking, guard: () => Promise<void>) {
  let booking = initial;
  if (booking.status === 'approval_processing') {
    let intent = await intentFor(booking);
    // Lost capture response and webhook races recover from current Stripe state.
    if (intent.status !== 'succeeded') {
      if (!capturable(intent, booking)) { await releaseAuthorization(booking, 'expired', guard); }
      else {
        const revision = await readBookingAvailabilityRevision(booking.creatorId);
        if (!await canConfirmBookingCalendar(booking)) {
          await update(booking.id, { status: 'payment_authorized', creatorDecision: null, workflowStep: null, workflowRetryAt: booking.respondBy });
          await releaseZoomHost(booking.id);
          throw new Error('This time now conflicts with availability. Payment has not been captured.');
        }
        await reserveZoomHost(booking);
        await guard();
        const { getDb } = await import('../../db');
        const stable = await getDb().get<{ stable: number }>(sql`SELECT ${revision} = (${bookingAvailabilityRevision(booking.creatorId)}) AS stable`);
        if (!stable?.stable) throw new Error('Availability changed before capture. Revalidation will retry.');
        intent = await intentFor(booking);
        if (!capturable(intent, booking)) { await releaseAuthorization(booking, 'expired', guard); }
        else {
          await guard();
          intent = await mutateStripeIntent(intent.id, 'capture');
          if (intent.id !== booking.stripePaymentIntentId || intent.status !== 'succeeded') throw new Error('Stripe has not yet confirmed payment capture.');
        }
      }
    }
    if (intent.status === 'succeeded') {
      if (intent.amount_received !== undefined && intent.amount_received !== booking.offeringUnitAmount && booking.offeringUnitAmount !== null) throw new Error('Captured amount needs operator review.');
      await guard();
      await markBookingPaid({ bookingId: booking.id, stripeCheckoutSessionId: booking.stripeCheckoutSessionId!, stripePaymentIntentId: intent.id });
    }
    booking = (await getCustomerBooking(booking.id))!;
  }
  if (['decline_processing', 'expiration_processing'].includes(booking.status)) {
    await releaseAuthorization(booking, booking.status === 'decline_processing' ? 'declined' : 'expired', guard);
    booking = (await getCustomerBooking(booking.id))!;
  }
  if (booking.status === 'cancellation_processing') {
    await refundBooking(booking, guard);
    booking = (await getCustomerBooking(booking.id))!;
  }
  if (booking.status === 'paid') {
    if (!booking.zoomHostId) await reserveZoomHost(booking);
    await update(booking.id, { workflowStep: 'zoom' });
    await ensureBookingZoom(booking.id, guard);
    await guard();
    await update(booking.id, { workflowStep: 'calendar' });
    await approveBookingAndSendGoogleInvite(booking.id, guard);
    booking = (await getCustomerBooking(booking.id))!;
  }
  if (booking.status === 'approved') {
    await syncBookingZoom(booking, guard);
    await guard();
    await syncBookingCalendar(booking.id);
    if (initial.workflowStep !== 'reschedule') await update(booking.id, { workflowStep: 'email' });
    const { createCreatorBookingNotification } = await import('./notifications');
    await createCreatorBookingNotification(booking);
    await deliverBookingEmail(booking, initial.workflowStep === 'reschedule' ? 'rescheduled' : 'confirmed', guard);
  } else if (['declined', 'expired'].includes(booking.status)) {
    await releaseZoomHost(booking.id);
    await deliverBookingEmail(booking, booking.status as 'declined' | 'expired', guard);
    await update(booking.id, { decisionNotifiedAt: new Date().toISOString() });
  } else if (booking.status === 'cancelled') {
    if (booking.zoomCreateAttemptAt && !booking.zoomMeetingId) { await ensureBookingZoom(booking.id, guard); booking = (await getCustomerBooking(booking.id))!; }
    await syncBookingZoom(booking, guard);
    if (booking.googleCalendarEventId) { await guard(); await syncBookingCalendar(booking.id); }
    await releaseZoomHost(booking.id);
    await deliverBookingEmail(booking, 'cancelled', guard);
  }
}
export async function recoverBooking(id: string) {
  return withBookingLock(id, async guard => {
    let booking = await getCustomerBooking(id);
    if (!booking) return null;
    if (booking.status === 'payment_authorized') {
      const intent = await intentFor(booking);
      const deadline = authorizationDeadline(intent, booking.createdAt, localDateTimeToUtc(booking.appointmentStartAt, booking.timezone)?.getTime() ?? 0);
      const respondBy = Math.min(booking.respondBy ?? Infinity, deadline.respondBy);
      await update(id, { ...deadline, respondBy, workflowRetryAt: respondBy });
      if (respondBy > Date.now() && intent.status === 'requires_capture') return getCustomerBooking(id);
      await update(id, { status: 'expiration_processing', creatorDecision: 'expire', workflowStep: 'release', workflowRetryAt: Date.now() });
      booking = (await getCustomerBooking(id))!;
    }
    return runRecoverable(booking, guard);
  });
}
export async function runBookingMaintenance() {
  const { getDb } = await import('../../db');
  const rows = await getDb().select({ id: customerBookings.id }).from(customerBookings).where(and(
    or(lte(customerBookings.workflowRetryAt, Date.now()), and(eq(customerBookings.status, 'payment_authorized'), isNull(customerBookings.respondBy))),
    or(isNull(customerBookings.workflowLock), lte(customerBookings.workflowLockUntil, Date.now())),
  )).orderBy(customerBookings.workflowRetryAt).limit(25);
  // Bounded parallelism keeps scheduled invocations short and isolates failures.
  for (let i = 0; i < rows.length; i += 5) await Promise.allSettled(rows.slice(i, i + 5).map(row => recoverBooking(row.id).catch(async () => {
    await update(row.id, { workflowRetryAt: Date.now() + 60_000 });
  })));
}
export async function cancelConfirmedBooking(id: string) {
  return withBookingLock(id, async guard => {
    const booking = await getCustomerBooking(id);
    if (!booking || !['approved', 'paid', 'cancellation_processing', 'cancelled'].includes(booking.status)) throw new Error('Only a paid booking can be cancelled.');
    if (['approved', 'paid'].includes(booking.status)) await update(id, { status: 'cancellation_processing', workflowStep: 'refund', workflowRetryAt: Date.now(), updatedAt: new Date().toISOString() });
    return runRecoverable((await getCustomerBooking(id))!, guard);
  });
}
async function refundBooking(booking: CustomerBooking, guard: () => Promise<void>) {
  const intent = await intentFor(booking);
  if (intent.status !== 'succeeded') throw new Error('Captured payment must be verified before refunding.');
  const headers = { authorization: `Bearer ${getStripeSecretKey()}`, 'stripe-version': STRIPE_API_VERSION };
  // Search before POST, including after Stripe's idempotency retention window.
  const lookup = await fetch(`https://api.stripe.com/v1/refunds?payment_intent=${encodeURIComponent(intent.id)}&limit=100`, { headers, signal: AbortSignal.timeout(15000) });
  if (!lookup.ok) throw new Error('Refund lookup will retry.');
  const refunds = await lookup.json() as { data: { id: string; status: string; amount: number; metadata?: { booking_id?: string } }[]; has_more?: boolean };
  let refund = refunds.data.find(item => item.metadata?.booking_id === booking.id);
  if (!refund) {
    if (refunds.has_more || refunds.data.length) throw new Error('Existing refunds need operator reconciliation before cancellation.');
    await guard();
    const result = await fetch('https://api.stripe.com/v1/refunds', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { ...headers, 'idempotency-key': `take-a-seat-refund-${booking.id}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ payment_intent: intent.id, reverse_transfer: 'true', refund_application_fee: 'true', 'metadata[booking_id]': booking.id }),
    });
    if (!result.ok) throw new Error('Refund will retry automatically.');
    refund = await result.json() as typeof refund;
  }
  if (!refund || refund.status !== 'succeeded' || refund.amount !== intent.amount) throw new Error('Full refund is not yet confirmed by Stripe.');
  await guard();
  await update(booking.id, { stripeRefundId: refund.id, status: 'cancelled', workflowStep: 'cancellation_delivery', updatedAt: new Date().toISOString(), calendarSyncedRevision: null });
}
