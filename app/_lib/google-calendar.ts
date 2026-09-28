import { bookingAvailabilityRevision, readBookingAvailabilityRevision } from "./booking-revalidation";
import { encryptToken, decryptToken } from "./token-encryption";
import { getRuntimeEnv } from "./runtime-env";
import { localDateTimeToUtc } from "./availability";
import { and, eq, or, isNull, lt } from "drizzle-orm";
import { creatorCalendarConnections, creatorOnboardingProfiles, googleOAuthAttempts, customerBookings, zoomHostReservations } from "../../db/schema";
import {
  getCustomerBooking,
  markBookingApprovedWithCalendar,
  type CustomerBooking,
} from "./bookings";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
};

type GoogleCalendarEvent = {
  htmlLink?: string;
  id: string;
  status?: string;
  etag?: string;
  organizer?: { email?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  summary?: string;
  description?: string;
  location?: string;
  conferenceData?: {
    createRequest?: { status?: { statusCode?: string } };
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
  extendedProperties?: { private?: { bookingId?: string } };
};

type CreatorCalendarConnection = typeof creatorCalendarConnections.$inferSelect;

export async function approveBookingAndSendGoogleInvite(bookingId: string, guard: () => Promise<void> = async () => {}) {
  let booking = await getCustomerBooking(bookingId);

  if (!booking || booking.status === "approved") {
    return booking;
  }

  if (booking.status !== "paid") {
    throw new Error("Booking is not paid.");
  }

  if (booking.workflowStep && !booking.zoomMeetingId) throw new Error("Zoom setup must finish before the invitation.");
  const access = await getCreatorCalendarAccessToken(booking.creatorId);

  if (!access) {
    throw new Error("Creator Google Calendar is not connected.");
  }

  const { getDb } = await import("../../db");
  // Bind the attempt before the external write. After an account reconnect, an
  // uncertain previous insertion may be recovered, but never recreated elsewhere.
  if (!booking.googleCalendarEventId) {
    await getDb().update(customerBookings).set({
      googleCalendarEventId: await getBookingEventId(booking.id), googleCalendarId: access.calendarId,
      googleCalendarConnectionId: access.connectionKey,
    }).where(and(eq(customerBookings.id, booking.id), isNull(customerBookings.googleCalendarEventId)));
    booking = (await getCustomerBooking(booking.id))!;
  }
  if (booking.googleCalendarEventId !== await getBookingEventId(booking.id)) throw new Error("Invalid booking calendar association.");
  let event: GoogleCalendarEvent;
  if (booking.googleCalendarConnectionId !== access.connectionKey && booking.googleCalendarId === "primary") {
    const existing = await googleFetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${booking.googleCalendarEventId}`, {
      headers: { authorization: `Bearer ${access.accessToken}` },
    });
    if (!existing.ok) throw new Error("Reconnect the original Google account to recover this booking event.");
    event = await existing.json() as GoogleCalendarEvent;
    if (event.id !== booking.googleCalendarEventId || event.status === "cancelled" || event.extendedProperties?.private?.bookingId !== booking.id) throw new Error("Calendar event does not match the booking.");
  } else {
    event = await insertGoogleCalendarEvent({ accessToken: access.accessToken, booking, calendarId: booking.googleCalendarId ?? access.calendarId });
  }

  // Persist the association before waiting for asynchronous meeting creation.
  // The organizer's real calendar ID avoids targeting a different primary on reconnect.
  await getDb().update(customerBookings).set({ googleCalendarEventId: event.id,
    googleCalendarId: event.organizer?.email ?? booking.googleCalendarId ?? access.calendarId,
    googleCalendarHtmlLink: event.htmlLink ?? null,
  }).where(and(eq(customerBookings.id, booking.id), eq(customerBookings.status, "paid")));

  // Google creates Meet details asynchronously. Keep a paid booking recoverable
  // until the event has a video link; retries retrieve the same event ID.
  if (!safeMeetingUrl(booking.meetingUrl) && !hasVideoConference(event)) {
    const response = await googleFetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(booking.googleCalendarId ?? access.calendarId)}/events/${event.id}`, {
      headers: { authorization: `Bearer ${access.accessToken}` },
    });
    if (!response.ok) throw new Error("Calendar conference lookup failed.");
    const confirmed = await response.json() as GoogleCalendarEvent;
    if (confirmed.id !== event.id || confirmed.status === "cancelled" || confirmed.extendedProperties?.private?.bookingId !== booking.id) {
      throw new Error("Calendar event does not match the booking.");
    }
    event = confirmed;
  }
  if (!safeMeetingUrl(booking.meetingUrl) && !hasVideoConference(event)) throw new Error("Google Meet is not ready. Retry calendar confirmation.");

  await guard();
  await markBookingApprovedWithCalendar({
    bookingId: booking.id,
    googleCalendarEventId: event.id,
    googleCalendarHtmlLink: event.htmlLink ?? null,
  });

  return getCustomerBooking(booking.id);
}

async function getCreatorCalendarAccessToken(creatorId: string) {
  const { getDb } = await import("../../db");
  const db = getDb();
  const [connection] = await db
    .select()
    .from(creatorCalendarConnections)
    .where(eq(creatorCalendarConnections.creatorId, creatorId))
    .limit(1);

  if (!connection) {
    return null;
  }

  const secret = getTokenEncryptionSecret();
  const expiresAt = getConnectionExpiresAt(connection);

  if (expiresAt.getTime() > Date.now() + 60 * 1000) {
    return {
      accessToken: await decryptToken(connection.accessTokenEncrypted, secret),
      calendarId: connection.calendarId,
      connectionKey: `${connection.id}:${connection.connectedAt}`,
    };
  }

  if (!connection.refreshTokenEncrypted) {
    return null;
  }

  const refreshed = await refreshAccessToken({
    refreshToken: await decryptToken(connection.refreshTokenEncrypted, secret),
  });

  if (refreshed.scope && !["https://www.googleapis.com/auth/calendar.freebusy", "https://www.googleapis.com/auth/calendar.events.owned"].every(scope => refreshed.scope!.split(" ").includes(scope))) throw new Error("Reconnect Google Calendar with both permissions.");
  if (!refreshed.access_token || !refreshed.expires_in) {
    return null;
  }

  const now = new Date().toISOString();
  const expiresAtNext = new Date(Date.now() + refreshed.expires_in * 1000);

  const updated = await db
    .update(creatorCalendarConnections)
    .set({
      accessTokenEncrypted: await encryptToken(refreshed.access_token, secret),
      expiresAt: expiresAtNext,
      refreshTokenEncrypted: refreshed.refresh_token
        ? await encryptToken(refreshed.refresh_token, secret)
        : connection.refreshTokenEncrypted,
      tokenType: refreshed.token_type ?? connection.tokenType,
      updatedAt: now,
    })
    .where(and(eq(creatorCalendarConnections.id, connection.id), eq(creatorCalendarConnections.updatedAt, connection.updatedAt), eq(creatorCalendarConnections.accessTokenEncrypted, connection.accessTokenEncrypted)))
    .returning({ id: creatorCalendarConnections.id });

  const [current] = await db.select().from(creatorCalendarConnections).where(eq(creatorCalendarConnections.id, connection.id));
  if (!updated.length || !current || current.updatedAt !== now) throw new Error("Calendar connection changed. Please retry.");
  return {
    accessToken: refreshed.access_token,
    calendarId: connection.calendarId,
    connectionKey: `${connection.id}:${connection.connectedAt}`,
  };
}

async function insertGoogleCalendarEvent({
  accessToken,
  booking,
  calendarId,
}: {
  accessToken: string;
  booking: CustomerBooking;
  calendarId: string;
}) {
  const url = new URL(
    `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  url.searchParams.set("conferenceDataVersion", "1");
  url.searchParams.set("sendUpdates", "all");

  const eventId = await getBookingEventId(booking.id);
  const response = await googleFetch(url, {
    body: JSON.stringify({
      id: eventId,
      extendedProperties: { private: { bookingId: booking.id } },
      attendees: [
        {
          displayName: booking.customerName ?? undefined,
          email: booking.customerEmail,
        },
      ],
      conferenceData: safeMeetingUrl(booking.meetingUrl) ? undefined : { createRequest: { requestId: booking.id } },
      location: safeMeetingUrl(booking.meetingUrl),
      description: buildEventDescription(booking),
      end: {
        dateTime: booking.appointmentEndAt,
        timeZone: booking.timezone,
      },
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
      start: {
        dateTime: booking.appointmentStartAt,
        timeZone: booking.timezone,
      },
      summary: `${booking.seatName} with ${booking.creatorName}`,
    }),
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  // A retry after Google succeeded but persistence/network failed reuses the
  // same event. Never send a second invitation for the same booking.
  if (response.status === 409) {
    const existing = await googleFetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!existing.ok) throw new Error("Calendar event recovery failed.");
    const event = await existing.json() as GoogleCalendarEvent;
    if (event.id !== eventId || event.status === "cancelled" || event.extendedProperties?.private?.bookingId !== booking.id) {
      throw new Error("Calendar event does not match the booking.");
    }
    return event;
  }
  if (!response.ok) throw new Error(`Google Calendar insert failed with ${response.status}`);
  const event = await response.json() as GoogleCalendarEvent;
  if (event.id !== eventId) throw new Error("Google did not confirm the requested event.");
  return event;
}

async function refreshAccessToken({
  refreshToken,
}: {
  refreshToken: string;
}) {
  const clientId = getRuntimeEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getRuntimeEnv("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return {};
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await googleFetch(GOOGLE_TOKEN_URL, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!response.ok) {
    return {};
  }

  return (await response.json()) as GoogleTokenResponse;
}

function buildEventDescription(booking: CustomerBooking) {
  return [
    "Take a Seat booking.",
    safeMeetingUrl(booking.meetingUrl) ? `Join your session: ${booking.meetingUrl}` : null,

  ]
    .filter(Boolean)
    .join("\n\n");
}

function getConnectionExpiresAt(connection: CreatorCalendarConnection) {
  return connection.expiresAt instanceof Date
    ? connection.expiresAt
    : new Date(connection.expiresAt);
}

function getTokenEncryptionSecret() {
  const clientSecret = getRuntimeEnv("GOOGLE_CLIENT_SECRET");
  const tokenSecret = getRuntimeEnv("GOOGLE_TOKEN_ENCRYPTION_KEY");

  if (!tokenSecret && !clientSecret) {
    throw new Error("Google token encryption key is not configured.");
  }

  return tokenSecret ?? clientSecret ?? "";
}

export async function getBookingEventId(bookingId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bookingId));
  return `tas${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export type CalendarState = "connected" | "needs-attention" | "not-connected";
type CalendarAccess = { accessToken: string; calendarId: string };

export async function getCreatorCalendarState(creatorId: string): Promise<CalendarState> {
  const { getDb } = await import("../../db");
  const [connection] = await getDb().select().from(creatorCalendarConnections).where(eq(creatorCalendarConnections.creatorId, creatorId));
  if (!connection) return "not-connected";
  if (!connection.refreshTokenEncrypted || ![
    "https://www.googleapis.com/auth/calendar.freebusy",
    "https://www.googleapis.com/auth/calendar.events.owned",
  ].every(scope => connection.scopes.split(" ").includes(scope))) return "needs-attention";
  try {
    const access = await getCreatorCalendarAccessToken(creatorId);
    if (!access) return "needs-attention";
    await readGoogleBusyPeriods(access, new Date(), new Date(Date.now() + 60_000));
    return "connected";
  } catch { return "needs-attention"; }
}

// Only intervals leave this boundary. Never list or return private event content.
export async function readGoogleBusyPeriods(access: CalendarAccess, start: Date, end: Date) {
  const response = await googleFetch(`${GOOGLE_CALENDAR_API_BASE}/freeBusy`, {
    method: "POST",
    headers: { authorization: `Bearer ${access.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin: start.toISOString(), timeMax: end.toISOString(), items: [{ id: access.calendarId }] }),
  });
  if (!response.ok) throw new Error("Calendar availability is temporarily unavailable.");
  const payload = await response.json() as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> };
  const calendar = payload.calendars?.[access.calendarId];
  if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) throw new Error("Calendar availability could not be verified.");
  return calendar.busy.map((busy) => {
    const start = Date.parse(busy.start), end = Date.parse(busy.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error("Invalid calendar availability response.");
    return { start, end };
  });
}

export async function getCreatorBusyPeriods(creatorId: string, start: Date, end: Date) {
  const access = await getCreatorCalendarAccessToken(creatorId);
  if (!access) throw new Error("Connect Google Calendar before accepting bookings.");
  return readGoogleBusyPeriods(access, start, end);
}

export async function isCreatorCalendarFree(creatorId: string, start: Date, end: Date) {
  return !(await getCreatorBusyPeriods(creatorId, start, end)).some(busy => busy.start < end.getTime() && busy.end > start.getTime());
}

export async function disconnectCreatorCalendar(creatorId: string) {
  const { getDb } = await import("../../db");
  const db = getDb();
  const [connection] = await db.select().from(creatorCalendarConnections).where(eq(creatorCalendarConnections.creatorId, creatorId));
  await db.batch([
    db.delete(creatorCalendarConnections).where(eq(creatorCalendarConnections.creatorId, creatorId)),
    db.delete(googleOAuthAttempts).where(eq(googleOAuthAttempts.creatorId, creatorId)),
    db.update(creatorOnboardingProfiles).set({ calendarConnectedAt: null }).where(eq(creatorOnboardingProfiles.id, creatorId)),
  ]);
  if (!connection) return true;
  try {
    const token = await decryptToken(connection.refreshTokenEncrypted ?? connection.accessTokenEncrypted, getTokenEncryptionSecret());
    const response = await googleFetch("https://oauth2.googleapis.com/revoke", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }),
    });
    // Already invalid tokens are no longer usable either.
    if (response.ok) return true;
    const error = await response.json() as { error?: string };
    return response.status === 400 && error.error === "invalid_token";
  } catch { return false; }
}

export async function canConfirmBookingCalendar(booking: CustomerBooking) {
  const start = localDateTimeToUtc(booking.appointmentStartAt, booking.timezone);
  const end = localDateTimeToUtc(booking.appointmentEndAt, booking.timezone);
  if (!start || !end || start.getTime() <= Date.now()) return false;
  const { getBookableCreatorById } = await import("./creator-onboarding");
  const { isBookingSlotAvailable, listCreatorBookings } = await import("./bookings");
  const { getMatchedAvailabilitySlot } = await import("./availability");
  const creator = await getBookableCreatorById(booking.creatorId);
  if (!creator) return false;
  // Historical duration is authoritative even if the creator renamed/edited it.
  const seat = { id: booking.seatId, name: booking.seatName, price: "", description: "", unitAmount: booking.offeringUnitAmount ?? 0, format: "Video", host: booking.creatorName, stripePriceEnv: "", durationMinutes: booking.offeringDurationMinutes ?? Math.round((end.getTime() - start.getTime()) / 60_000) };
  const input = { appointmentStartAt: booking.appointmentStartAt, timezone: booking.timezone, customerEmail: booking.customerEmail, customerName: booking.customerName, customerNote: booking.customerNote };
  const bookings = (await listCreatorBookings(booking.creatorId)).filter(item => item.id !== booking.id);
  if (!await isBookingSlotAvailable({ creator, input, seat, bookings })) return false;
  const slot = getMatchedAvailabilitySlot({ ...input, creatorId: creator.id, availabilityRules: creator.availabilityRules ?? [], seat });
  if (!slot) return false;
  const padding = slot.bufferMinutes * 60_000;
  return isCreatorCalendarFree(booking.creatorId, new Date(start.getTime() - padding), new Date(end.getTime() + padding));
}

function hasVideoConference(event: GoogleCalendarEvent) {
  return event.conferenceData?.createRequest?.status?.statusCode !== "failure" &&
    Boolean(event.conferenceData?.entryPoints?.some((entry) => entry.entryPointType === "video" && entry.uri?.startsWith("https://meet.google.com/")));
}

async function googleFetch(url: string | URL, init: RequestInit = {}) {
  let response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  if (init.method !== "PATCH" && init.method !== "DELETE" && (response.status === 429 || response.status >= 500)) {
    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    if (retryAfter > 1) return response;
    await new Promise(resolve => setTimeout(resolve, 250));
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  }
  return response;
}

function safeMeetingUrl(value: string | null) {
  if (!value) return undefined;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.toString() : undefined; }
  catch { return undefined; }
}

// Calendar is a destination for committed booking data. This boundary deliberately
// does not make payment/refund decisions. A cancellation workflow must first commit
// the authoritative cancelled state; a reschedule must validate and commit its time.
export async function syncBookingCalendar(bookingId: string) {
  return withCalendarSyncLock(bookingId, () => syncBookingCalendarUnlocked(bookingId));
}

async function syncBookingCalendarUnlocked(bookingId: string) {
  const booking = await getCustomerBooking(bookingId);
  if (!booking || !["approved", "cancelled"].includes(booking.status)) throw new Error("Booking is not ready for calendar synchronization.");
  if (!booking.googleCalendarEventId || booking.googleCalendarEventId !== await getBookingEventId(booking.id)) throw new Error("Booking calendar association is missing or invalid.");
  const revision = JSON.stringify([booking.status, booking.appointmentStartAt, booking.appointmentEndAt, booking.timezone, booking.meetingUrl, booking.seatName]);
  if (booking.calendarSyncedRevision === revision) return;
  const access = await getCreatorCalendarAccessToken(booking.creatorId);
  if (!access) throw new Error("Reconnect Google Calendar to synchronize this booking.");
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(booking.googleCalendarId ?? access.calendarId)}/events/${encodeURIComponent(booking.googleCalendarEventId)}`;
  const response = await googleFetch(url, { headers: { authorization: `Bearer ${access.accessToken}` } });
  // A 404 after reconnect can mean the new account cannot access the original
  // calendar, not that the old invitation was deleted. Never report that as synced.
  if (response.status === 404 && booking.googleCalendarConnectionId !== access.connectionKey) throw new Error("The original booking calendar could not be verified.");
  if (!(booking.status === "cancelled" && [404, 410].includes(response.status))) {
    if (!response.ok) throw new Error("Calendar event could not be verified.");
    const event = await response.json() as GoogleCalendarEvent;
    if (event.id !== booking.googleCalendarEventId || (event.status !== "cancelled" && event.extendedProperties?.private?.bookingId !== booking.id)) throw new Error("Calendar event does not match the booking.");
    const matches = event.start?.dateTime && event.end?.dateTime &&
      eventInstant(event.start) === localDateTimeToUtc(booking.appointmentStartAt, booking.timezone)?.getTime() &&
      eventInstant(event.end) === localDateTimeToUtc(booking.appointmentEndAt, booking.timezone)?.getTime() &&
      event.summary === `${booking.seatName} with ${booking.creatorName}` &&
      (event.description ?? "") === buildEventDescription(booking) && (event.location ?? "") === (safeMeetingUrl(booking.meetingUrl) ?? "");
    if (event.status !== "cancelled" && !(booking.status === "approved" && matches)) {
      // ETag prevents concurrent sync calls from sending conflicting updates.
      if (!event.etag) throw new Error("Calendar event revision is missing.");
      const updated = await googleFetch(`${url}?sendUpdates=all`, {
        method: booking.status === "cancelled" ? "DELETE" : "PATCH",
        headers: { authorization: `Bearer ${access.accessToken}`, "content-type": "application/json", "if-match": event.etag },
        body: booking.status === "cancelled" ? undefined : JSON.stringify({
          start: { dateTime: booking.appointmentStartAt, timeZone: booking.timezone },
          end: { dateTime: booking.appointmentEndAt, timeZone: booking.timezone },
          summary: `${booking.seatName} with ${booking.creatorName}`,
          description: buildEventDescription(booking), location: safeMeetingUrl(booking.meetingUrl),
        }),
      });
      if (!updated.ok && !(booking.status === "cancelled" && [404, 410].includes(updated.status))) throw new Error("Calendar update needs a retry.");
    } else if (event.status === "cancelled" && booking.status !== "cancelled") throw new Error("Booking event was removed from Google Calendar.");
  }
  const { getDb } = await import("../../db");
  await getDb().update(customerBookings).set({ calendarSyncedRevision: revision }).where(and(
    eq(customerBookings.id, booking.id), eq(customerBookings.updatedAt, booking.updatedAt), eq(customerBookings.status, booking.status),
  ));
}

// Prepared service boundary for a future reschedule UI. It preserves the booking
// and event IDs and commits D1 first. A failed sync can be retried via the creator
// calendar endpoint without repeating the reschedule or creating another event.
export async function rescheduleConfirmedBooking(bookingId: string, appointmentStartAt: string, timezone: string) {
  const { withBookingLock } = await import('./booking-lock');
  return withBookingLock(bookingId, () => withCalendarSyncLock(bookingId, () => rescheduleConfirmedBookingUnlocked(bookingId, appointmentStartAt, timezone)));
}

async function rescheduleConfirmedBookingUnlocked(bookingId: string, appointmentStartAt: string, timezone: string) {
  const booking = await getCustomerBooking(bookingId);
  if (!booking || booking.status !== "approved") throw new Error("Only confirmed bookings can be rescheduled.");
  const start = localDateTimeToUtc(appointmentStartAt, timezone);
  const oldStart = localDateTimeToUtc(booking.appointmentStartAt, booking.timezone);
  const oldEnd = localDateTimeToUtc(booking.appointmentEndAt, booking.timezone);
  if (!start || !oldStart || !oldEnd) throw new Error("Invalid appointment time.");
  const duration = booking.offeringDurationMinutes ?? (oldEnd.getTime() - oldStart.getTime()) / 60000;
  // Store wall-clock time in the supplied IANA timezone, preserving the real duration.
  const end = new Date(start.getTime() + duration * 60000);
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(end).replace(" ", "T");
  const candidate = { ...booking, appointmentStartAt, appointmentEndAt: parts, timezone };
  const { getDb } = await import("../../db");
  const db = getDb();
  const { sql } = await import("drizzle-orm");
  const snapshot = bookingAvailabilityRevision(booking.creatorId);
  const version = await readBookingAvailabilityRevision(booking.creatorId);
  if (!await canConfirmBookingCalendar(candidate)) throw new Error("That time is no longer available. Please choose another time.");
  const values = { workflowStep: 'reschedule', workflowRetryAt: Date.now(), appointmentStartAt, appointmentEndAt: parts, timezone, calendarSyncedRevision: null, updatedAt: new Date().toISOString() };
  let updated: { id: string }[];
  if (booking.zoomMeetingId) {
    if (!booking.zoomHostId) throw new Error('Zoom host association is missing.');
    const { zoomInterval } = await import('./zoom');
    const times = zoomInterval(candidate), startAt = times.start - 15 * 60000, endAt = times.end + 15 * 60000;
    // D1 batch is transactional: the reservation and booking move together, or
    // neither moves. A process crash cannot leave capacity on the wrong time.
    const results = await db.batch([
      db.update(zoomHostReservations).set({ startAt, endAt }).where(and(
        eq(zoomHostReservations.bookingId, booking.id), sql`${version} = (${snapshot})`,
        sql`NOT EXISTS (SELECT 1 FROM zoom_host_reservations WHERE host_id=${booking.zoomHostId} AND booking_id!=${booking.id} AND start_at < ${endAt} AND end_at > ${startAt})`,
      )).returning({ id: zoomHostReservations.bookingId }),
      db.update(customerBookings).set(values).where(and(eq(customerBookings.id, booking.id), eq(customerBookings.status, 'approved'), sql`${version} = (${snapshot})`,
        sql`EXISTS (SELECT 1 FROM zoom_host_reservations WHERE booking_id=${booking.id} AND start_at=${startAt} AND end_at=${endAt})`,
      )).returning({ id: customerBookings.id }),
    ]);
    updated = results[1];
  } else {
    updated = await db.update(customerBookings).set(values).where(and(eq(customerBookings.id, booking.id), eq(customerBookings.status, 'approved'), sql`${version} = (${snapshot})`)).returning({ id: customerBookings.id });
  }
  if (!updated.length) throw new Error('That time or Zoom host is no longer available. Please choose another time.');
  // D1 is the outbox: the scheduler updates this same Zoom meeting, same Google
  // event, then emails the customer. No second meeting/invitation is created.
  if (!booking.zoomMeetingId) await syncBookingCalendarUnlocked(booking.id);
}

// Serializes this booking's committed reschedules and outgoing sync operations.
// An abandoned request recovers after two minutes; all provider calls are bounded.
async function withCalendarSyncLock<T>(bookingId: string, operation: () => Promise<T>) {
  const { getDb } = await import("../../db");
  const db = getDb(), lock = crypto.randomUUID();
  const acquired = await db.update(customerBookings).set({ calendarSyncLock: lock, calendarSyncLockExpiresAt: Date.now() + 120_000 }).where(and(
    eq(customerBookings.id, bookingId), or(isNull(customerBookings.calendarSyncLock), lt(customerBookings.calendarSyncLockExpiresAt, Date.now())),
  )).returning({ id: customerBookings.id });
  if (!acquired.length) throw new Error("Calendar synchronization is already in progress. Please retry shortly.");
  try { return await operation(); }
  finally { await db.update(customerBookings).set({ calendarSyncLock: null, calendarSyncLockExpiresAt: null }).where(and(eq(customerBookings.id, bookingId), eq(customerBookings.calendarSyncLock, lock))); }
}

function eventInstant(value: { dateTime?: string; timeZone?: string }) {
  if (!value.dateTime) return NaN;
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value.dateTime) ? Date.parse(value.dateTime)
    : localDateTimeToUtc(value.dateTime, value.timeZone ?? "UTC")?.getTime();
}
