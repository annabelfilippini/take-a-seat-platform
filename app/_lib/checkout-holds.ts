import { getStripeSecretKey, STRIPE_API_VERSION } from './stripe-connect';
import { markBookingPaymentEnded, type CustomerBooking } from './bookings';

// Reconcile abandoned Checkout sessions even if their expiry webhook was missed.
// Never release from elapsed local time alone: an authorization may have succeeded.
export async function reconcileCheckoutHolds(bookings: CustomerBooking[]) {
  const secret = getStripeSecretKey();
  if (!secret) return;
  for (const booking of bookings) {
    if (!['requested','checkout_started'].includes(booking.status) || !booking.stripeCheckoutSessionId || Date.parse(booking.createdAt) > Date.now() - 30 * 60_000) continue;
    const base = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(booking.stripeCheckoutSessionId)}`;
    const headers = { authorization:`Bearer ${secret}`, 'stripe-version':STRIPE_API_VERSION };
    const response = await fetch(base,{headers,signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Payment holds could not be checked. Please try again shortly.');
    let session = await response.json() as {id?:string;status?:string;expires_at?:number};
    if (session.id !== booking.stripeCheckoutSessionId) throw new Error('Payment hold does not match.');
    if (session.status === 'open' && session.expires_at && session.expires_at * 1000 <= Date.now()) {
      const expired = await fetch(`${base}/expire`,{method:'POST',headers:{...headers,'idempotency-key':`take-a-seat-expire-${booking.id}`},signal:AbortSignal.timeout(15000)});
      if (!expired.ok) throw new Error('Payment hold is still being checked. Please retry.');
      session = await expired.json() as typeof session;
    }
    if (session.id === booking.stripeCheckoutSessionId && session.status === 'expired') await markBookingPaymentEnded({bookingId:booking.id,sessionId:booking.stripeCheckoutSessionId,status:'checkout_expired'});
  }
}
