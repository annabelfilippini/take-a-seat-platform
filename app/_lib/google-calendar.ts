import { encryptToken, decryptToken } from "./token-encryption";
import { getRuntimeEnv } from "./runtime-env";
import { localDateTimeToUtc } from "./availability";
import { eq } from "drizzle-orm";
import { creatorCalendarConnections } from "../../db/schema";
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
};

type GoogleCalendarEvent = {
  htmlLink?: string;
  id: string;
  status?: string;
  conferenceData?: {
    createRequest?: { status?: { statusCode?: string } };
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
  extendedProperties?: { private?: { bookingId?: string } };
};

type CreatorCalendarConnection = typeof creatorCalendarConnections.$inferSelect;

export async function approveBookingAndSendGoogleInvite(bookingId: string) {
  const booking = await getCustomerBooking(bookingId);

  if (!booking || booking.status === "approved") {
    return booking;
  }

  if (booking.status !== "paid") {
    throw new Error("Booking is not paid.");
  }

  const access = await getCreatorCalendarAccessToken(booking.creatorId);

  if (!access) {
    throw new Error("Creator Google Calendar is not connected.");
  }

  let event = await insertGoogleCalendarEvent({
    accessToken: access.accessToken,
    booking,
    calendarId: access.calendarId,
  });

  // Google creates Meet details asynchronously. Keep a paid booking recoverable
  // until the event has a video link; retries retrieve the same event ID.
  if (!hasVideoConference(event)) {
    const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(access.calendarId)}/events/${event.id}`, {
      headers: { authorization: `Bearer ${access.accessToken}` },
    });
    if (!response.ok) throw new Error("Calendar conference lookup failed.");
    const confirmed = await response.json() as GoogleCalendarEvent;
    if (confirmed.id !== event.id || confirmed.status === "cancelled" || confirmed.extendedProperties?.private?.bookingId !== booking.id) {
      throw new Error("Calendar event does not match the booking.");
    }
    event = confirmed;
  }
  if (!hasVideoConference(event)) throw new Error("Google Meet is not ready. Retry calendar confirmation.");

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
    };
  }

  if (!connection.refreshTokenEncrypted) {
    return null;
  }

  const refreshed = await refreshAccessToken({
    refreshToken: await decryptToken(connection.refreshTokenEncrypted, secret),
  });

  if (!refreshed.access_token || !refreshed.expires_in) {
    return null;
  }

  const now = new Date().toISOString();
  const expiresAtNext = new Date(Date.now() + refreshed.expires_in * 1000);

  await db
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
    .where(eq(creatorCalendarConnections.id, connection.id));

  return {
    accessToken: refreshed.access_token,
    calendarId: connection.calendarId,
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
  const response = await fetch(url, {
    body: JSON.stringify({
      id: eventId,
      extendedProperties: { private: { bookingId: booking.id } },
      attendees: [
        {
          displayName: booking.customerName ?? undefined,
          email: booking.customerEmail,
        },
      ],
      conferenceData: {
        createRequest: {
          requestId: booking.id,
        },
      },
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
    const existing = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
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
  const response = await fetch(GOOGLE_TOKEN_URL, {
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
    booking.customerNote ? `Customer note: ${booking.customerNote}` : null,
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

export async function isCreatorCalendarFree(creatorId: string, start: Date, end: Date) {
  const access = await getCreatorCalendarAccessToken(creatorId);
  if (!access) throw new Error("Connect Google Calendar before accepting bookings.");
  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/freeBusy`, {
    method: "POST",
    headers: { authorization: `Bearer ${access.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin: start.toISOString(), timeMax: end.toISOString(), items: [{ id: access.calendarId }] }),
  });
  if (!response.ok) throw new Error("Calendar availability is temporarily unavailable.");
  const payload = await response.json() as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> };
  const calendar = payload.calendars?.[access.calendarId];
  if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) throw new Error("Calendar availability could not be verified.");
  return !calendar.busy.some((busy) => {
    const from = Date.parse(busy.start), to = Date.parse(busy.end);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new Error("Invalid calendar availability response.");
    return from < end.getTime() && to > start.getTime();
  });
}

export async function canConfirmBookingCalendar(booking: CustomerBooking) {
  const start = localDateTimeToUtc(booking.appointmentStartAt, booking.timezone);
  const end = localDateTimeToUtc(booking.appointmentEndAt, booking.timezone);
  if (!start || !end || start.getTime() <= Date.now()) return false;
  const { listCreatorAvailabilityRules } = await import("./creator-onboarding");
  const rules = await listCreatorAvailabilityRules(booking.creatorId);
  const padding = Math.max(0, ...rules.map((rule) => rule.bufferMinutes)) * 60_000;
  return isCreatorCalendarFree(booking.creatorId, new Date(start.getTime() - padding), new Date(end.getTime() + padding));
}

function hasVideoConference(event: GoogleCalendarEvent) {
  return event.conferenceData?.createRequest?.status?.statusCode !== "failure" &&
    Boolean(event.conferenceData?.entryPoints?.some((entry) => entry.entryPointType === "video" && entry.uri?.startsWith("https://meet.google.com/")));
}
