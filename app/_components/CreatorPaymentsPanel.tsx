'use client';
import { useCallback, useEffect, useState } from 'react';
import type { getCreatorPaymentView } from '../_lib/creator-payments';
import { bookingStatusLabel } from './CreatorRequestsPanel';
type PaymentView = Awaited<ReturnType<typeof getCreatorPaymentView>>;
export function CreatorPaymentsPanel({ creatorId, onReadiness }: { creatorId: string; onReadiness: (ready: boolean) => void }) {
  const [data,setData] = useState<PaymentView | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [opening,setOpening] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(''); onReadiness(false);
    try {
      const response = await fetch(`/api/creators/payments?creatorId=${encodeURIComponent(creatorId)}`);
      const result = await response.json() as PaymentView & {error?:string};
      if (!response.ok) throw new Error(result.error);
      setData(result); onReadiness(result.status === 'connected');
    } catch (err) { setData(null); setError(err instanceof Error ? err.message : 'Could not check Stripe. Retry.'); }
    finally { setLoading(false); }
  }, [creatorId,onReadiness]);
  // Fetch synchronizes the view with authoritative server state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); },[load]);
  async function openStripe() {
    setOpening(true); setError('');
    try {
      const body = new FormData(); body.set('creatorId', creatorId);
      const response = await fetch('/api/creators/payments',{method:'POST',body});
      const result = await response.json() as {url?:string;error?:string};
      if (!response.ok || !result.url) throw new Error(result.error || 'Could not open Stripe.');
      window.location.assign(result.url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Retry opening Stripe.'); }
    finally { setOpening(false); }
  }
  return <div className="creator-workspace-panel"><div className="creator-panel-heading"><div><span>Your earnings</span><h1>Payments</h1></div><button type="button" disabled={loading} onClick={() => void load()}>Refresh Stripe status</button></div>
    {error && <p role="alert">{error}</p>}<section className="creator-request-card"><h2>{loading ? 'Checking Stripe…' : data?.status === 'connected' ? 'Connected to Stripe ✓' : data?.status === 'action_required' ? 'Action required' : data?.status === 'not_connected' ? 'Not connected' : 'Stripe status unavailable'}</h2>
      <p>Stripe securely manages your payouts. Resolve any requested information there before accepting paid sessions.</p>
      {!loading && data && data.status !== 'connected' && <a className="editable-primary-button" href={`/api/stripe/connect/start?creatorId=${encodeURIComponent(creatorId)}&returnTo=/creator/profile`}>{data.status === 'action_required' ? 'Finish Stripe setup' : 'Connect Stripe'}</a>}
      {data && data.status !== 'not_connected' && <button type="button" disabled={opening} onClick={() => void openStripe()}>{opening ? 'Opening Stripe…' : 'Open Stripe dashboard'}</button>}
    </section>
    {data?.balances && <div className="creator-balance-grid">{(['available','pending'] as const).map((kind) => <section className="creator-request-card" key={kind}><h2>{kind === 'available' ? 'Available balance' : 'Pending balance'}</h2>{data.balances![kind].map((balance) => <p key={balance.currency}>{new Intl.NumberFormat('en-US',{style:'currency',currency:balance.currency}).format(balance.amount / 100)}</p>)}</section>)}</div>}
    {data?.balanceError && <p role="status">{data.balanceError}</p>}
    <h2>Past paid sessions</h2>{data && !data.history.length && <p>Your paid sessions will appear here.</p>}
    {data?.history.map((booking) => <article className="creator-request-card" key={booking.id}><h3>{booking.customerName || 'Customer'} · {booking.seatName}</h3><p>{booking.appointmentStartAt.replace('T',' ')} · {booking.timezone}</p><p>{booking.offeringUnitAmount == null ? 'Historical amount unavailable' : new Intl.NumberFormat('en-US',{style:'currency',currency:booking.offeringCurrency || 'usd'}).format(booking.offeringUnitAmount/100)} · {bookingStatusLabel(booking.status)}</p></article>)}
  </div>;
}
