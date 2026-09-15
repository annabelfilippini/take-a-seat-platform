import { and, eq, or, isNull } from 'drizzle-orm';
import { customerBookings } from '../../db/schema';
import { getCustomerBooking } from './bookings';
import { getStripeSecretKey, STRIPE_API_VERSION } from './stripe-connect';
import { sendEmail } from './email';

// Persist the chosen operation before any network call. Concurrent opposite
// decisions cannot capture and cancel the same authorization. Same-action retries
// use the provider's idempotency key and continue after a lost response.
export async function claimBookingDecision(id: string, decision: 'accept' | 'decline') {
  const { getDb } = await import('../../db');
  const result = await getDb().update(customerBookings).set({ creatorDecision: decision })
    .where(and(eq(customerBookings.id, id), eq(customerBookings.status, 'payment_authorized'),
      or(isNull(customerBookings.creatorDecision), eq(customerBookings.creatorDecision, decision))))
    .returning({ id: customerBookings.id });
  return result.length > 0;
}

export async function declineBooking(id: string) {
  let booking = await getCustomerBooking(id);
  if (!booking) throw new Error('Request not found.');
  if (booking.status !== 'declined') {
    if (!await claimBookingDecision(id, 'decline')) throw new Error('This request has already changed. Refresh to see its status.');
    const secret = getStripeSecretKey();
    if (!secret || !booking.stripePaymentIntentId) throw new Error('Payment authorization could not be verified. Please retry.');
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(booking.stripePaymentIntentId)}/cancel`, {
      method: 'POST', headers: { authorization: `Bearer ${secret}`, 'stripe-version': STRIPE_API_VERSION,
        'idempotency-key': `take-a-seat-decline-${booking.id}` }, signal: AbortSignal.timeout(15000),
    });
    const intent = await response.json() as {id?:string;status?:string};
    if (!response.ok || intent.id !== booking.stripePaymentIntentId || intent.status !== 'canceled') throw new Error('Stripe has not confirmed cancellation. Retry decline to release the payment hold.');
    const { getDb } = await import('../../db');
    await getDb().update(customerBookings).set({ status: 'declined', updatedAt: new Date().toISOString() })
      .where(and(eq(customerBookings.id, id), eq(customerBookings.creatorDecision, 'decline')));
    booking = (await getCustomerBooking(id))!;
  }
  if (!booking.decisionNotifiedAt) {
    const text = `${booking.creatorName} could not accept your request for ${booking.seatName}. Your payment authorization has been canceled; no payment was captured. You can choose another time on Take a Seat.`;
    const result = await sendEmail({ to: booking.customerEmail, subject: 'An update on your Take a Seat request', text,
      html: `<p>${text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`, idempotencyKey: `take-a-seat-declined-${id}` });
    if (result.status !== 'sent') throw new Error('Request declined and payment released. Customer email failed; retry to send the update.');
    const { getDb } = await import('../../db');
    await getDb().update(customerBookings).set({ decisionNotifiedAt: new Date().toISOString() }).where(eq(customerBookings.id, id));
  }
  return getCustomerBooking(id);
}
