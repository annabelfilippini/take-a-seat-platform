import { eq } from 'drizzle-orm';
import { bookingDeliveries } from '../../db/schema';
import { formatBookingDateTime, type CustomerBooking } from './bookings';
import { sendEmail } from './email';

export async function deliverBookingEmail(booking: CustomerBooking, kind: 'confirmed' | 'declined' | 'expired' | 'cancelled' | 'rescheduled', guard: () => Promise<void>) {
  if (kind === 'confirmed' && (booking.status !== 'approved' || !booking.meetingUrl)) throw new Error('Confirmation is not ready.');
  const revision = kind === 'rescheduled' ? `-${booking.updatedAt}` : '';
  const id = `booking-${booking.id}-${kind}${revision}`;
  const { getDb } = await import('../../db');
  const db = getDb();
  let [delivery] = await db.select().from(bookingDeliveries).where(eq(bookingDeliveries.id, id));
  if (!delivery) {
    const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: booking.offeringCurrency || 'usd' }).format((booking.offeringUnitAmount ?? 0) / 100);
    const paymentAmount = booking.offeringUnitAmount === null ? 'your payment' : `your payment of ${amount}`;
    const opening = kind === 'confirmed' ? `Great news! ${booking.creatorName} accepted your request. Your session is confirmed and ${paymentAmount} has been processed.`
      : kind === 'rescheduled' ? 'Your Take a Seat session has been rescheduled. Your existing meeting link stays the same.'
      : kind === 'cancelled' ? `Your creator cancelled this session. The full amount of ${paymentAmount} has been refunded. Your bank may take several days to show the refund.`
      : `Your Take a Seat request ${kind === 'expired' ? 'expired before it could be confirmed' : 'could not be accepted'}. Your payment authorization has been cancelled. No payment was captured; your bank controls when the hold disappears.`;
    const invitation = ['confirmed', 'rescheduled'].includes(kind) ? `Accept the Google Calendar invitation to add the session to your calendar. Calendar visibility depends on your invitation settings.\nJoin Zoom: ${booking.meetingUrl}` : '';
    const text = `${opening}\n\n${booking.seatName} with ${booking.creatorName}\n${formatBookingDateTime(booking)}\n\n${invitation}`;
    const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#26332b"><p style="font-size:24px;font-weight:bold">Take a Seat</p><h1 style="font-size:26px">${kind === 'confirmed' ? 'Your session is confirmed' : 'Your session update'}</h1><p>${escape(opening)}</p><p><strong>${escape(booking.seatName)}</strong><br>${escape(formatBookingDateTime(booking))}</p>${invitation ? `<p>Accept the Google Calendar invitation to add the session to your calendar.</p><p><a style="display:inline-block;padding:14px 24px;background:#273f33;color:white;border-radius:8px" href="${escape(booking.meetingUrl!)}">Join Zoom</a></p>` : ''}</div>`;
    const payload = { to: booking.customerEmail, subject: kind === 'confirmed' ? `${booking.creatorName} accepted your Take a Seat request` : `Your Take a Seat session: ${kind}`, text, html, idempotencyKey: id };
    await db.insert(bookingDeliveries).values({ id, bookingId: booking.id, firstAttemptAt: Date.now(), payload: JSON.stringify(payload) }).onConflictDoNothing();
    [delivery] = await db.select().from(bookingDeliveries).where(eq(bookingDeliveries.id, id));
  }
  if (delivery.sentAt) return;
  // Resend retains keys for 24 hours. After an ambiguous send, never resend past
  // that window: operators must reconcile delivery instead of risking duplicate mail.
  if (Date.now() - delivery.firstAttemptAt > 23 * 3600_000) throw new Error('Email delivery needs operator reconciliation; its safe retry window ended.');
  await guard();
  const result = await sendEmail(JSON.parse(delivery.payload));
  if (result.status !== 'sent') throw new Error('Customer email will retry automatically.');
  await db.update(bookingDeliveries).set({ sentAt: Date.now() }).where(eq(bookingDeliveries.id, id));
}
