'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CustomerBooking } from '../_lib/bookings';

export function bookingStatusLabel(status: string) {
  return ({ payment_authorized: 'New', requested: 'Waiting for payment authorization', checkout_started: 'Waiting for payment authorization',
    paid: 'Accepted — calendar confirmation pending', approved: 'Booked', accepted: 'Accepted — waiting for booking', declined: 'Declined',
    payment_canceled: 'Canceled', checkout_expired: 'Expired' } as Record<string, string>)[status] ?? status;
}
export function CreatorRequestsPanel({ creatorId }: { creatorId: string }) {
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/creators/requests?creatorId=${encodeURIComponent(creatorId)}`);
      const data = await response.json() as {bookings:CustomerBooking[];error?:string};
      if (!response.ok) throw new Error(data.error);
      setBookings(data.bookings);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load requests. Retry.'); }
    finally { setLoading(false); }
  }, [creatorId]);
  // Fetch synchronizes the view with authoritative server state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  async function decide(bookingId: string, action: string) {
    if (busy.current) return;
    busy.current = true; setPending(bookingId); setError('');
    try {
      const body = new FormData(); body.set('bookingId', bookingId); body.set('action', action); body.set('returnTo', '/creator/profile');
      const response = await fetch('/api/creators/requests', { method: 'POST', body });
      const data = await response.json() as {booking:CustomerBooking;error?:string};
      if (!response.ok) throw new Error(data.error);
      setBookings((current) => current.map((booking) => booking.id === bookingId ? data.booking : booking));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update request. Retry.'); }
    finally { busy.current = false; setPending(null); }
  }
  return <div className="creator-workspace-panel"><div className="creator-panel-heading"><div><span>Your conversations</span><h1>Requests</h1></div><button type="button" onClick={() => void load()} disabled={loading || Boolean(pending)}>Refresh requests</button></div>
    <p>Acceptance captures the authorized payment and confirms the calendar invitation.</p>
    {error && <p role="alert">{error}</p>}{loading ? <p role="status">Loading requests…</p> : !bookings.length ? <p>No requests yet. They will appear here when someone chooses a session.</p> : null}
    <div className="creator-request-list">{[...bookings].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map((booking) => <article className="creator-request-card" key={booking.id}>
      <div className="creator-panel-heading"><h2>{booking.customerName || 'Customer'}</h2><strong>{bookingStatusLabel(booking.status)}</strong></div>
      <h3>{booking.seatName}</h3><p>{booking.appointmentStartAt.replace('T',' ')} · {booking.timezone}</p>
      {booking.offeringUnitAmount != null && <p>{new Intl.NumberFormat('en-US',{style:'currency',currency:booking.offeringCurrency || 'usd'}).format(booking.offeringUnitAmount / 100)} · {booking.offeringDurationMinutes} minutes</p>}
      <p className="creator-request-note">{booking.customerNote || 'No additional message.'}</p><small>Submitted {new Date(booking.createdAt).toLocaleString()}</small>
      <div className="creator-request-actions">{['payment_authorized','paid'].includes(booking.status) && <button className="editable-primary-button" type="button" disabled={Boolean(pending) || booking.creatorDecision === 'decline'} onClick={() => void decide(booking.id, 'accept')}>{pending === booking.id ? 'Updating…' : booking.status === 'paid' ? 'Retry calendar confirmation' : 'Accept request'}</button>}
      {(booking.status === 'payment_authorized' || (booking.status === 'declined' && !booking.decisionNotifiedAt)) && <button type="button" disabled={Boolean(pending) || booking.creatorDecision === 'accept'} onClick={() => void decide(booking.id,'decline')}>{booking.status === 'declined' ? 'Retry customer email' : 'Decline'}</button>}</div>
    </article>)}</div></div>;
}
