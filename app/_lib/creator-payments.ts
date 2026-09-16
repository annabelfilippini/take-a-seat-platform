import { getCreatorStripeConnection, getConnectedAccountTransferStatus, getStripeSecretKey, STRIPE_API_VERSION } from './stripe-connect';
import { listCreatorBookings } from './bookings';

export async function stripeAccountRequest<T>(path: string, accountId: string, method = 'GET') {
  const secret = getStripeSecretKey();
  if (!secret) throw new Error('Stripe is unavailable. Please try again.');
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { method,
    headers: { authorization: `Bearer ${secret}`, 'stripe-version': STRIPE_API_VERSION, 'stripe-account': accountId },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Stripe could not be reached. Please retry.');
  return response.json() as Promise<T>;
}
export async function getCreatorPaymentView(creatorId: string) {
  const connection = await getCreatorStripeConnection(creatorId);
  const history = (await listCreatorBookings(creatorId)).filter((booking) => ['paid', 'approved', 'cancellation_processing', 'cancelled'].includes(booking.status));
  if (!connection) return { status: 'not_connected' as const, history, balances: null, balanceError: null };
  const secretKey = getStripeSecretKey();
  if (!secretKey) throw new Error('Stripe status could not be verified. Retry shortly.');
  const status = await getConnectedAccountTransferStatus({ accountId: connection.stripeAccountId, secretKey });
  type Balances = { available: Array<{ amount: number; currency: string }>; pending: Array<{ amount: number; currency: string }> };
  let balances: Balances | null = null;
  let balanceError: string | null = null;
  try { balances = await stripeAccountRequest<Balances>('balance', connection.stripeAccountId); }
  catch { balanceError = 'Balances are unavailable. Open Stripe or retry.'; }
  return { status: status === 'active' ? 'connected' as const : 'action_required' as const, history, balances, balanceError };
}
