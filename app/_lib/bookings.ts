import { and, eq, sql } from "drizzle-orm";
import { customerBookings } from "../../db/schema";
import {
  getDateValueInTimezone,
  getMatchedAvailabilitySlot,
  getWeekKey,
  localDateTimeToUtc,
} from "./availability";
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
  accepted: "accepted",
  approved: "approved",
  checkoutStarted: "checkout_started",
  paid: "paid",
  paymentAuthorized: "payment_authorized",
  requested: "requested",
} as const;
const CHECKOUT_SLOT_HOLD_MINUTES = 30;
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

export async function isBookingSlotAvailable({
  creator,
  input,
  seat,
  bookings,
}: {
  creator: Creator;
  input: BookingRequestInput;
  seat: Seat;
  bookings?: CustomerBooking[];
}) {
  const matchedSlot = getMatchedAvailabilitySlot({
    appointmentStartAt: input.appointmentStartAt,
    availabilityRules: creator.availabilityRules ?? [],
    creatorId: creator.id,
    seat,
    timezone: input.timezone,
  });

  if (!matchedSlot) {
    return false;
  }

  if (isTestBookingStoreEnabled()) {
    return true;
  }

  const existingBookings = bookings ?? await listCreatorBookings(creator.id);
  const blockingBookings = existingBookings.filter(isBlockingBooking);
  let bookingsOnDay = 0;
  let bookingsInWeek = 0;
  const requestedWeekKey = getWeekKey(matchedSlot.creatorDate);

  for (const booking of blockingBookings) {
    const existingStart = localDateTimeToUtc(
      booking.appointmentStartAt,
      booking.timezone,
    );
    const existingEnd = localDateTimeToUtc(booking.appointmentEndAt, booking.timezone);

    if (!existingStart || !existingEnd) {
      continue;
    }

    if (
      intervalsOverlap(
        matchedSlot.appointmentStartUtc,
        matchedSlot.appointmentEndUtc,
        new Date(existingStart.getTime() - matchedSlot.bufferMinutes * 60_000),
        new Date(existingEnd.getTime() + matchedSlot.bufferMinutes * 60_000),
      )
    ) {
      return false;
    }

    const existingCreatorDate = getDateValueInTimezone(
      existingStart,
      matchedSlot.creatorTimezone,
    );

    if (existingCreatorDate === matchedSlot.creatorDate) {
      bookingsOnDay += 1;
    }

    if (getWeekKey(existingCreatorDate) === requestedWeekKey) {
      bookingsInWeek += 1;
    }
  }

  if (
    matchedSlot.maxBookingsPerDay !== null &&
    bookingsOnDay >= matchedSlot.maxBookingsPerDay
  ) {
    return false;
  }

  if (
    matchedSlot.maxBookingsPerWeek !== null &&
    bookingsInWeek >= matchedSlot.maxBookingsPerWeek
  ) {
    return false;
  }

  return true;
}

export async function createBookingRequest({
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
    status: BOOKING_STATUS.requested,
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

export async function markBookingPaymentAuthorized({
  bookingId,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
}: {
  bookingId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
}) {
  const existingBooking = await getCustomerBooking(bookingId);

  if (
    !existingBooking ||
    existingBooking.stripeCheckoutSessionId !== stripeCheckoutSessionId ||
    ![BOOKING_STATUS.requested, BOOKING_STATUS.paymentAuthorized, BOOKING_STATUS.paid, BOOKING_STATUS.approved].some((status) => status === existingBooking.status)
  ) {
    return null;
  }

  if (existingBooking.status !== BOOKING_STATUS.requested) return existingBooking;

  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .update(customerBookings)
    .set({
      status: BOOKING_STATUS.paymentAuthorized,
      stripePaymentIntentId,
      updatedAt: now,
    })
    .where(
      and(
        eq(customerBookings.id, bookingId),
        eq(customerBookings.stripeCheckoutSessionId, stripeCheckoutSessionId),
        eq(customerBookings.status, BOOKING_STATUS.requested),
      ),
    );

  return getCustomerBooking(bookingId);
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
  const existingBooking = await getCustomerBooking(bookingId);

  if (
    !existingBooking ||
    existingBooking.stripeCheckoutSessionId !== stripeCheckoutSessionId ||
    !(canMarkBookingPaid(existingBooking.status) || existingBooking.status === BOOKING_STATUS.paid || existingBooking.status === BOOKING_STATUS.approved)
  ) {
    return null;
  }

  if (existingBooking.status === BOOKING_STATUS.paid || existingBooking.status === BOOKING_STATUS.approved) return existingBooking;

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
        eq(customerBookings.status, existingBooking.status),
      ),
    );

  return getCustomerBooking(bookingId);
}

export async function markBookingPaymentEnded({ bookingId, sessionId, status }: {
  bookingId: string;
  sessionId: string;
  status: "payment_canceled" | "checkout_expired";
}) {
  const booking = await getCustomerBooking(bookingId);
  if (!booking || booking.stripeCheckoutSessionId !== sessionId ||
    !["requested", "checkout_started", "payment_authorized"].includes(booking.status)) return;
  // Session expiry must never revoke an authorization or a captured payment.
  if (status === "checkout_expired" && booking.status === "payment_authorized") return;
  const { getDb } = await import("../../db");
  await getDb().update(customerBookings).set({ status, updatedAt: new Date().toISOString() })
    .where(and(eq(customerBookings.id, bookingId), eq(customerBookings.stripeCheckoutSessionId, sessionId), eq(customerBookings.status, booking.status)));
}

export async function markBookingAccepted(bookingId: string) {
  const existingBooking = await getCustomerBooking(bookingId);

  if (!existingBooking || existingBooking.status !== BOOKING_STATUS.requested) {
    return existingBooking;
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .update(customerBookings)
    .set({
      status: BOOKING_STATUS.accepted,
      updatedAt: now,
    })
    .where(
      and(
        eq(customerBookings.id, bookingId),
        eq(customerBookings.status, BOOKING_STATUS.requested),
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

async function listCreatorBookings(creatorId: string) {
  const { getDb } = await import("../../db");
  const db = getDb();

  return db
    .select()
    .from(customerBookings)
    .where(eq(customerBookings.creatorId, creatorId));
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

function isBlockingBooking(booking: CustomerBooking) {
  if (
    booking.status === BOOKING_STATUS.accepted ||
    booking.status === BOOKING_STATUS.paymentAuthorized ||
    booking.status === BOOKING_STATUS.paid ||
    booking.status === BOOKING_STATUS.approved
  ) {
    return true;
  }

  if (
    booking.status !== BOOKING_STATUS.checkoutStarted &&
    booking.status !== BOOKING_STATUS.requested
  ) {
    return false;
  }

  // A completed authorization webhook can arrive after Checkout's expiry time.
  // Once a session exists, release only on its verified terminal webhook.
  if (booking.stripeCheckoutSessionId) return true;
  return Date.parse(booking.createdAt) > Date.now() - CHECKOUT_SLOT_HOLD_MINUTES * 60_000;
}

function canMarkBookingPaid(status: string) {
  return (
    status === BOOKING_STATUS.requested ||
    status === BOOKING_STATUS.accepted ||
    status === BOOKING_STATUS.checkoutStarted ||
    status === BOOKING_STATUS.paymentAuthorized
  );
}

function intervalsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
) {
  return firstStart < secondEnd && secondStart < firstEnd;
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

// Optimistic reservation: the availability check and conditional insert share a
// snapshot. D1 executes this INSERT as one statement; competing requests cannot
// both reserve based on the same state. No network request runs inside a lock.
export async function reserveBookingRequest({ creator, input, seat }: {
  creator: Creator; input: BookingRequestInput; seat: Seat;
}) {
  if (isTestBookingStoreEnabled()) return createBookingRequest({ creator, input, seat });
  const bookings = await listCreatorBookings(creator.id);
  if (!await isBookingSlotAvailable({ creator, input, seat, bookings })) return null;
  const slot = getMatchedAvailabilitySlot({ appointmentStartAt: input.appointmentStartAt,
    availabilityRules: creator.availabilityRules ?? [], creatorId: creator.id, seat, timezone: input.timezone });
  if (!slot) return null;
  const { isCreatorCalendarFree } = await import("./google-calendar");
  const padding = slot.bufferMinutes * 60_000;
  if (!await isCreatorCalendarFree(creator.id, new Date(slot.appointmentStartUtc.getTime() - padding),
    new Date(slot.appointmentEndUtc.getTime() + padding))) return null;
  const snapshot = JSON.stringify(bookings.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map((b) => [b.id, b.status, b.updatedAt, b.stripeCheckoutSessionId, b.appointmentStartAt, b.appointmentEndAt, b.timezone]));
  const id = `booking_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const { getDb } = await import("../../db");
  const rows = await getDb().all<{ id: string }>(sql`
    INSERT INTO customer_bookings (id, creator_id, creator_name, seat_id, seat_name,
      customer_name, customer_email, customer_note, appointment_start_at, appointment_end_at,
      timezone, status, created_at, updated_at)
    SELECT ${id}, ${creator.id}, ${creator.name}, ${seat.id}, ${seat.name},
      ${input.customerName}, ${input.customerEmail}, ${input.customerNote}, ${input.appointmentStartAt},
      ${addMinutesToLocalDateTime(input.appointmentStartAt, getSeatDurationMinutes(seat))},
      ${input.timezone}, 'requested', ${now}, ${now}
    WHERE ${snapshot} = (SELECT json_group_array(json_array(id, status, updated_at,
      stripe_checkout_session_id, appointment_start_at, appointment_end_at, timezone))
      FROM (SELECT * FROM customer_bookings WHERE creator_id = ${creator.id} ORDER BY id))
    RETURNING id
  `);
  return rows[0]?.id ?? null;
}
