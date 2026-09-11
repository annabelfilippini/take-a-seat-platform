import { eq } from "drizzle-orm";
import { creatorCalendarConnections } from "../db/schema";
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
};

type CreatorCalendarConnection = typeof creatorCalendarConnections.$inferSelect;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

  const event = await insertGoogleCalendarEvent({
    accessToken: access.accessToken,
    booking,
    calendarId: access.calendarId,
  });

  await markBookingApprovedWithCalendar({
    bookingId: booking.id,
    googleCalendarEventId: event.id,
    googleCalendarHtmlLink: event.htmlLink ?? null,
  });

  return getCustomerBooking(booking.id);
}

async function getCreatorCalendarAccessToken(creatorId: string) {
  const { getDb } = await import("../db");
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

  const response = await fetch(url, {
    body: JSON.stringify({
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

  if (!response.ok) {
    throw new Error(`Google Calendar insert failed with ${response.status}`);
  }

  return (await response.json()) as GoogleCalendarEvent;
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

async function encryptToken(value: string, secret: string) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await getTokenEncryptionKey(secret);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ iv, name: "AES-GCM" }, key, encoder.encode(value)),
  );

  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(ciphertext)}`;
}

async function decryptToken(value: string, secret: string) {
  const [, encodedIv, encodedCiphertext] = value.split(".");

  if (!encodedIv || !encodedCiphertext) {
    throw new Error("Unsupported encrypted token format.");
  }

  const key = await getTokenEncryptionKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { iv: base64UrlDecode(encodedIv), name: "AES-GCM" },
    key,
    base64UrlDecode(encodedCiphertext),
  );

  return decoder.decode(plaintext);
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

function getRuntimeEnv(name: string) {
  const processValue = process.env[name];
  return typeof processValue === "string" && processValue.trim()
    ? processValue.trim()
    : null;
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
