import { and, eq } from "drizzle-orm";
import { customerBookings } from "../../db/schema";
import type { Creator, Seat } from "./creators";

export type CustomerBooking = typeof customerBookings.$inferSelect;

export type BookingRequestInput = {
  appointmentStartAt: string;
  customerEmail: string;
  customerName: string | null;
  customerNote: string | null;
  timezone: string;
};

const BOOKING_STATUS = {
  approved: "approved",
  checkoutStarted: "checkout_started",
  paid: "paid",
} as const;
const TEST_BOOKINGS_ENV = "TAKE_A_SEAT_TEST_BOOKINGS";

export function getBookingRequestInput(
  payload: Record<string, unknown>,
): BookingRequestInput | null {
  const customerEmail = cleanEmail(payload.customerEmail);
  const appointmentStartAt = cleanLocalDateTime(payload.appointmentStartAt);

  if (!customerEmail || !appointmentStartAt) {
    return null;
  }

  return {
    appointmentStartAt,
    customerEmail,
    customerName: cleanField(payload.customerName),
    customerNote: cleanField(payload.customerNote),
    timezone: cleanTimezone(payload.timezone),
  };
}

export async function createCheckoutBooking({
  creator,
  input,
  seat,
}: {
  creator: Creator;
  input: BookingRequestInput;
  seat: Seat;
}) {
  const now = new Date().toISOString();
  const bookingId = `booking_${crypto.randomUUID()}`;

  if (isTestBookingStoreEnabled()) {
    return bookingId;
  }

  const { getDb } = await import("../../db");
  const db = getDb();

  await db.insert(customerBookings).values({
    appointmentEndAt: addMinutesToLocalDateTime(
      input.appointmentStartAt,
      getSeatDurationMinutes(seat),
    ),
    appointmentStartAt: input.appointmentStartAt,
    createdAt: now,
    creatorId: creator.id,
    creatorName: creator.name,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    customerNote: input.customerNote,
    id: bookingId,
    seatId: seat.id,
    seatName: seat.name,
    status: BOOKING_STATUS.checkoutStarted,
    timezone: input.timezone,
    updatedAt: now,
  });

  return bookingId;
}

export async function attachStripeCheckoutSession(
  bookingId: string,
  stripeCheckoutSessionId: string,
) {
  if (isTestBookingStoreEnabled()) {
    return;
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .update(customerBookings)
    .set({ stripeCheckoutSessionId, updatedAt: now })
    .where(eq(customerBookings.id, bookingId));
}

export async function markBookingPaid({
  bookingId,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
}: {
  bookingId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
}) {
  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .update(customerBookings)
    .set({
      status: BOOKING_STATUS.paid,
      stripePaymentIntentId,
      updatedAt: now,
    })
    .where(
      and(
        eq(customerBookings.id, bookingId),
        eq(customerBookings.stripeCheckoutSessionId, stripeCheckoutSessionId),
      ),
    );

  return getCustomerBooking(bookingId);
}

export async function getCustomerBooking(bookingId: string) {
  if (!isBookingId(bookingId)) {
    return null;
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const [booking] = await db
    .select()
    .from(customerBookings)
    .where(eq(customerBookings.id, bookingId))
    .limit(1);

  return booking ?? null;
}

export async function markBookingApprovedWithCalendar({
  bookingId,
  googleCalendarEventId,
  googleCalendarHtmlLink,
}: {
  bookingId: string;
  googleCalendarEventId: string;
  googleCalendarHtmlLink: string | null;
}) {
  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .update(customerBookings)
    .set({
      approvedAt: now,
      googleCalendarEventId,
      googleCalendarHtmlLink,
      status: BOOKING_STATUS.approved,
      updatedAt: now,
    })
    .where(eq(customerBookings.id, bookingId));
}

export function getCustomerCalendarFilename(booking: CustomerBooking) {
  return `${booking.id}.ics`;
}

export function createCustomerCalendarIcs(booking: CustomerBooking) {
  const start = formatLocalDateTimeForIcs(booking.appointmentStartAt);
  const end = formatLocalDateTimeForIcs(booking.appointmentEndAt);
  const created = formatUtcDateTimeForIcs(new Date(booking.createdAt));
  const updated = formatUtcDateTimeForIcs(new Date(booking.updatedAt));
  const summary = `${booking.seatName} with ${booking.creatorName}`;
  const description = [
    "Take a Seat booking request.",
    booking.customerNote ? `Customer note: ${booking.customerNote}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Take a Seat//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.id}@takeaseatwith.com`,
    `DTSTAMP:${updated}`,
    `CREATED:${created}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `DTSTART;TZID=${escapeIcsText(booking.timezone)}:${start}`,
    `DTEND;TZID=${escapeIcsText(booking.timezone)}:${end}`,
    "STATUS:TENTATIVE",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function formatBookingDateTime(booking: CustomerBooking) {
  const match = booking.appointmentStartAt.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u,
  );

  if (!match) {
    return `${booking.appointmentStartAt} ${booking.timezone}`;
  }

  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const dateLabel = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
  const hourNumber = Number(hour);
  const hour12 = hourNumber % 12 || 12;
  const period = hourNumber >= 12 ? "PM" : "AM";

  return `${dateLabel}, ${hour12}:${minute} ${period} ${booking.timezone}`;
}

function cleanField(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

function cleanEmail(value: unknown) {
  const email = cleanField(value)?.toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    return null;
  }

  return email.slice(0, 254);
}

function cleanLocalDateTime(value: unknown) {
  const trimmed = cleanField(value);

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.length === 16 ? `${trimmed}:00` : trimmed;

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u.test(normalized)) {
    return null;
  }

  return normalized;
}

function cleanTimezone(value: unknown) {
  const timezone = cleanField(value);

  if (!timezone || !/^[A-Za-z_]+\/[A-Za-z0-9_+\-/]+$/u.test(timezone)) {
    return "America/Los_Angeles";
  }

  return timezone.slice(0, 80);
}

function getSeatDurationMinutes(seat: Seat) {
  const match = seat.name.match(/\d+/u);
  const duration = match ? Number(match[0]) : 30;
  return Number.isSafeInteger(duration) && duration > 0 ? duration : 30;
}

function addMinutesToLocalDateTime(value: string, minutes: number) {
  const date = new Date(`${value}Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString().slice(0, 19);
}

function formatLocalDateTimeForIcs(value: string) {
  return value.replace(/[-:]/g, "");
}

function formatUtcDateTimeForIcs(date: Date) {
  if (Number.isNaN(date.getTime())) {
    return formatUtcDateTimeForIcs(new Date());
  }

  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/u, "Z");
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function isBookingId(value: string) {
  return /^booking_[A-Za-z0-9-]+$/u.test(value);
}

function isTestBookingStoreEnabled() {
  return process.env[TEST_BOOKINGS_ENV] === "true";
}
