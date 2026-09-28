import { and, eq, inArray, sql } from 'drizzle-orm';
import { customerBookings, zoomHostReservations } from '../../db/schema';
import { localDateTimeToUtc } from './availability';
import { getCustomerBooking, type CustomerBooking } from './bookings';
import { getRuntimeEnv } from './runtime-env';

type ZoomMeeting = { id: number | string; host_id: string; topic: string; join_url?: string; start_time?: string; duration?: number; settings?: { join_before_host?: boolean; jbh_time?: number; waiting_room?: boolean; meeting_authentication?: boolean } };
const API = 'https://api.zoom.us/v2';
const HOST_PADDING = 15 * 60_000;
function hosts(): string[] {
  const value: unknown = JSON.parse(getRuntimeEnv('ZOOM_HOST_USER_IDS') || '[]');
  if (!Array.isArray(value) || !value.length || value.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id))) throw new Error('Take a Seat Zoom hosts need setup before accepting requests.');
  return [...new Set(value)] as string[];
}
async function token() {
  const account = getRuntimeEnv('ZOOM_ACCOUNT_ID'), client = getRuntimeEnv('ZOOM_CLIENT_ID'), secret = getRuntimeEnv('ZOOM_CLIENT_SECRET');
  if (!account || !client || !secret) throw new Error('Take a Seat Zoom credentials need setup.');
  const response = await fetch('https://zoom.us/oauth/token', { method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { authorization: `Basic ${btoa(`${client}:${secret}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'account_credentials', account_id: account }),
  });
  if (!response.ok) throw new Error('Zoom authorization is temporarily unavailable.');
  const value = await response.json() as { access_token?: string };
  if (!value.access_token) throw new Error('Zoom authorization is unavailable.');
  return value.access_token;
}
async function zoomFetch(path: string, access: string, init: RequestInit = {}) {
  return fetch(API + path, { ...init, signal: AbortSignal.timeout(15000), headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json', ...init.headers } });
}
export function zoomInterval(booking: CustomerBooking) {
  const start = localDateTimeToUtc(booking.appointmentStartAt, booking.timezone)?.getTime();
  const end = localDateTimeToUtc(booking.appointmentEndAt, booking.timezone)?.getTime();
  if (!start || !end || end <= start) throw new Error('Invalid meeting time.');
  return { start, end };
}
function zoomStartTime(start: number) {
  // Zoom's UTC format requires whole seconds. Fractional seconds can be
  // interpreted as local wall time when a timezone is also supplied.
  return new Date(start).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
export async function reserveZoomHost(booking: CustomerBooking) {
  const { getDb } = await import('../../db');
  const db = getDb(), { start, end } = zoomInterval(booking);
  for (const host of booking.zoomHostId ? [booking.zoomHostId] : hosts()) {
    // Atomic across creators and concurrent acceptances/reschedules. One lane per
    // licensed user, including a join/overrun buffer. No unsupported two-host assumption.
    const rows = await db.all<{ booking_id: string }>(sql`
      INSERT INTO zoom_host_reservations (booking_id, host_id, start_at, end_at)
      SELECT ${booking.id}, ${host}, ${start - HOST_PADDING}, ${end + HOST_PADDING}
      WHERE NOT EXISTS (SELECT 1 FROM zoom_host_reservations WHERE booking_id != ${booking.id}
        AND host_id=${host} AND start_at < ${end + HOST_PADDING} AND end_at > ${start - HOST_PADDING})
      ON CONFLICT(booking_id) DO UPDATE SET start_at=excluded.start_at, end_at=excluded.end_at
      RETURNING booking_id`);
    if (rows.length) {
      await db.update(customerBookings).set({ zoomHostId: host }).where(eq(customerBookings.id, booking.id));
      // Verify host access before capture. Licensing/settings must also pass the
      // documented live two-participant rehearsal before production enablement.
      const access = await token();
      const response = await zoomFetch(`/users/${encodeURIComponent(host)}/meetings?type=scheduled&page_size=1`, access);
      if (!response.ok) throw new Error('Zoom host access could not be verified. Payment has not been captured.');
      return host;
    }
  }
  throw new Error('All Take a Seat meeting hosts are reserved at this time. Choose another time or add a licensed host.');
}
export async function releaseZoomHost(bookingId: string) {
  const { getDb } = await import('../../db');
  await getDb().delete(zoomHostReservations).where(eq(zoomHostReservations.bookingId, bookingId));
}
async function topic(bookingId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bookingId));
  return 'Take a Seat ' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function joinUrl(value?: string) {
  if (!value) throw new Error('Zoom did not provide a participant join link.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !(url.hostname === 'zoom.us' || url.hostname.endsWith('.zoom.us')) || !/^\/j\/\d+$/.test(url.pathname) || url.username || url.password || [...url.searchParams.keys()].some(key => key !== 'pwd')) throw new Error('Zoom returned an unsafe participant link.');
  return url.toString();
}
async function verifiedMeeting(id: string, host: string, marker: string, access: string) {
  const response = await zoomFetch(`/meetings/${encodeURIComponent(id)}`, access);
  if (!response.ok) throw new Error('Zoom meeting could not be verified.');
  const meeting = await response.json() as ZoomMeeting;
  if (String(meeting.id) !== id || meeting.host_id !== host || meeting.topic !== marker) throw new Error('Zoom meeting ownership did not match.');
  return meeting;
}
export async function ensureBookingZoom(id: string, guard: () => Promise<void>) {
  const booking = (await getCustomerBooking(id))!;
  if (!['paid', 'approved', 'cancelled'].includes(booking.status) || !booking.zoomHostId) throw new Error('A paid booking and reserved Zoom host are required.');
  if (booking.zoomMeetingId && booking.meetingUrl) return;
  const { getDb } = await import('../../db');
  const db = getDb(), access = await token(), marker = await topic(id);
  let meeting: ZoomMeeting | undefined;
  // Recover a success whose response/write was lost. Zoom has no create idempotency
  // key. Once a POST is uncertain we ONLY reconcile; we never blindly create again.
  if (booking.zoomCreateAttemptAt) {
    let next = '', pages = 0;
    const matches: ZoomMeeting[] = [];
    do {
      const response = await zoomFetch(`/users/${encodeURIComponent(booking.zoomHostId)}/meetings?type=scheduled&page_size=100&next_page_token=${encodeURIComponent(next)}`, access);
      if (!response.ok) throw new Error('Zoom recovery needs a retry.');
      const result = await response.json() as { meetings?: ZoomMeeting[]; next_page_token?: string };
      matches.push(...(result.meetings ?? []).filter(item => item.topic === marker));
      next = result.next_page_token || '';
      if (++pages >= 20 && next) throw new Error('Zoom recovery needs operator review of the host meeting list.');
    } while (next);
    if (matches.length !== 1) throw new Error(matches.length ? 'Duplicate Zoom meetings detected; operator reconciliation required.' : 'Zoom creation outcome is uncertain. Recovery will search again; operator review may be needed.');
    meeting = await verifiedMeeting(String(matches[0].id), booking.zoomHostId, marker, access);
  } else {
    if (booking.status === 'cancelled') return;
    const { start, end } = zoomInterval(booking);
    await guard();
    await db.update(customerBookings).set({ zoomCreateAttemptAt: Date.now() }).where(eq(customerBookings.id, id));
    const response = await zoomFetch(`/users/${encodeURIComponent(booking.zoomHostId)}/meetings`, access, {
      method: 'POST', body: JSON.stringify({ topic: marker, type: 2, start_time: zoomStartTime(start), timezone: booking.timezone,
        duration: (end - start) / 60000, agenda: `Take a Seat session with ${booking.creatorName}`,
        password: crypto.randomUUID().replaceAll('-', '').slice(0, 10),
        settings: { use_pmi: false, join_before_host: true, jbh_time: 5, waiting_room: false, meeting_authentication: false, auto_recording: 'none' },
      }),
    });
    if (!response.ok) {
      // Explicit validation/auth/rate-limit rejection proves no resource was created.
      if ([400, 401, 403, 404, 429].includes(response.status)) await db.update(customerBookings).set({ zoomCreateAttemptAt: null }).where(eq(customerBookings.id, id));
      throw new Error('Zoom meeting setup will retry automatically.');
    }
    const created = await response.json() as ZoomMeeting;
    meeting = await verifiedMeeting(String(created.id), booking.zoomHostId, marker, access);
  }
  if (booking.status !== 'cancelled' && (!meeting.settings?.join_before_host || meeting.settings.waiting_room || meeting.settings.meeting_authentication)) throw new Error('Zoom host settings prevent participants from joining unattended. Correct the account settings; recovery will reuse this meeting.');
  if (booking.status !== 'cancelled' && meeting.settings?.jbh_time !== 5) throw new Error('Zoom must limit early joining to five minutes. Correct the host and meeting settings; recovery will reuse this meeting.');
  const expected = zoomInterval(booking);
  if (booking.status !== 'cancelled' && (Date.parse(meeting.start_time ?? '') !== expected.start || meeting.duration !== (expected.end - expected.start) / 60000)) throw new Error('Zoom meeting time does not match this booking. Operator review is required.');
  await guard();
  await db.update(customerBookings).set({ zoomMeetingId: String(meeting.id), meetingUrl: joinUrl(meeting.join_url), zoomSyncedRevision: JSON.stringify([booking.appointmentStartAt, booking.appointmentEndAt, booking.timezone]) })
    .where(and(eq(customerBookings.id, id), inArray(customerBookings.status, ['paid', 'cancelled'])));
}
export async function syncBookingZoom(booking: CustomerBooking, guard: () => Promise<void>) {
  if (!booking.zoomMeetingId) return; // Historical Meet bookings retain their provider.
  if (!booking.zoomHostId) throw new Error('Zoom host association is missing.');
  const revision = booking.status === 'cancelled' ? 'cancelled' : JSON.stringify([booking.appointmentStartAt, booking.appointmentEndAt, booking.timezone]);
  if (booking.zoomSyncedRevision === revision) return;
  const access = await token(), path = `/meetings/${encodeURIComponent(booking.zoomMeetingId)}`;
  const response = await zoomFetch(path, access);
  if (response.status === 404 && booking.status === 'cancelled') {
    const error = await response.json() as { code?: number };
    if (error.code !== 3001) throw new Error('Zoom deletion could not be verified.');
  } else {
    if (!response.ok) throw new Error('Zoom synchronization needs a retry.');
    const meeting = await response.json() as ZoomMeeting;
    // This ID was persisted only after creation/recovery verified the booking marker.
    // Calendar integrations can rename topics later; identity remains the saved ID + host.
    if (meeting.host_id !== booking.zoomHostId || String(meeting.id) !== booking.zoomMeetingId) throw new Error('Zoom meeting ownership did not match.');
    await guard();
    const { start, end } = zoomInterval(booking);
    const changed = await zoomFetch(path, access, { method: booking.status === 'cancelled' ? 'DELETE' : 'PATCH',
      body: booking.status === 'cancelled' ? undefined : JSON.stringify({ start_time: zoomStartTime(start), duration: (end - start) / 60000, timezone: booking.timezone }),
    });
    if (!changed.ok) throw new Error('Zoom synchronization will retry automatically.');
  }
  const { getDb } = await import('../../db');
  await getDb().update(customerBookings).set({ zoomSyncedRevision: revision }).where(eq(customerBookings.id, booking.id));
}
