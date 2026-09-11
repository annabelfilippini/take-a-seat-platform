import { desc, eq } from "drizzle-orm";
import {
  creatorNotificationPreferences,
  creatorNotifications,
  creatorOnboardingProfiles,
} from "../db/schema";
import type { CustomerBooking } from "./bookings";

const BOOKING_NOTIFICATION_TYPE = "booking_paid";
const ACCEPTED_NOTIFICATION_TYPE = "application_accepted";

export type CreatorNotificationPreference =
  typeof creatorNotificationPreferences.$inferSelect;
export type CreatorNotification = typeof creatorNotifications.$inferSelect;

export type CreatorNotificationPreferenceInput = {
  bookingEmailEnabled: boolean;
  bookingProfileEnabled: boolean;
  bookingSmsEnabled: boolean;
};

const defaultCreatorNotificationPreference = {
  bookingEmailEnabled: true,
  bookingProfileEnabled: true,
  bookingSmsEnabled: true,
};

export function getDefaultCreatorNotificationPreference() {
  return defaultCreatorNotificationPreference;
}

export async function getCreatorNotificationPreferences(creatorId: string) {
  const { getDb } = await import("../db");
  const db = getDb();
  const [preferences] = await db
    .select()
    .from(creatorNotificationPreferences)
    .where(eq(creatorNotificationPreferences.creatorId, creatorId))
    .limit(1);

  return preferences ?? {
    createdAt: "",
    creatorId,
    id: 0,
    updatedAt: "",
    ...defaultCreatorNotificationPreference,
  };
}

export async function saveCreatorNotificationPreferences(
  creatorId: string,
  input: CreatorNotificationPreferenceInput,
) {
  const { getDb } = await import("../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .insert(creatorNotificationPreferences)
    .values({
      bookingEmailEnabled: input.bookingEmailEnabled,
      bookingProfileEnabled: input.bookingProfileEnabled,
      bookingSmsEnabled: input.bookingSmsEnabled,
      createdAt: now,
      creatorId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        bookingEmailEnabled: input.bookingEmailEnabled,
        bookingProfileEnabled: input.bookingProfileEnabled,
        bookingSmsEnabled: input.bookingSmsEnabled,
        updatedAt: now,
      },
      target: creatorNotificationPreferences.creatorId,
    });

  return getCreatorNotificationPreferences(creatorId);
}

export async function listCreatorNotifications(creatorId: string) {
  const { getDb } = await import("../db");
  const db = getDb();

  return db
    .select()
    .from(creatorNotifications)
    .where(eq(creatorNotifications.creatorId, creatorId))
    .orderBy(desc(creatorNotifications.createdAt))
    .limit(20);
}

export async function notifyCreatorBookingPaid({
  booking,
  request,
}: {
  booking: CustomerBooking;
  request: Request;
}) {
  const preferences = await getCreatorNotificationPreferences(booking.creatorId);
  const profile = await getCreatorNotificationProfile(booking.creatorId);

  if (preferences.bookingProfileEnabled) {
    await createCreatorBookingNotification(booking);
  }

  if (preferences.bookingEmailEnabled && profile?.email) {
    const { sendCreatorBookingEmail } = await import("./email");

    await sendCreatorBookingEmail({
      booking,
      request,
      to: profile.email,
    });
  }

  if (preferences.bookingSmsEnabled && profile?.phone) {
    const { sendCreatorBookingSms } = await import("./email");

    await sendCreatorBookingSms({
      booking,
      request,
      to: profile.phone,
    });
  }
}

export async function createCreatorAcceptedNotification({
  creatorId,
  creatorName,
}: {
  creatorId: string;
  creatorName: string;
}) {
  const { getDb } = await import("../db");
  const db = getDb();
  const now = new Date().toISOString();
  const firstName = creatorName.trim().split(/\s+/u)[0] || "there";
  const body = `Hi ${firstName}, your application was accepted. Build your profile, choose your offer, and finish booking setup before your page goes live.`;

  await db
    .insert(creatorNotifications)
    .values({
      body,
      bookingId: `application_${creatorId}`,
      createdAt: now,
      creatorId,
      id: `notification_${crypto.randomUUID()}`,
      readAt: null,
      title: "Application accepted",
      type: ACCEPTED_NOTIFICATION_TYPE,
    })
    .onConflictDoUpdate({
      set: {
        body,
        createdAt: now,
        readAt: null,
        title: "Application accepted",
      },
      target: [creatorNotifications.bookingId, creatorNotifications.type],
    });
}

export function getCreatorNotificationPreferenceInput(
  payload: Record<string, unknown>,
): CreatorNotificationPreferenceInput | null {
  const bookingEmailEnabled = getBoolean(payload.bookingEmailEnabled);
  const bookingSmsEnabled = getBoolean(payload.bookingSmsEnabled);
  const bookingProfileEnabled = getBoolean(payload.bookingProfileEnabled);

  if (
    bookingEmailEnabled === null ||
    bookingSmsEnabled === null ||
    bookingProfileEnabled === null
  ) {
    return null;
  }

  return {
    bookingEmailEnabled,
    bookingProfileEnabled,
    bookingSmsEnabled,
  };
}

async function createCreatorBookingNotification(booking: CustomerBooking) {
  const { getDb } = await import("../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .insert(creatorNotifications)
    .values({
      body: `${booking.customerName ?? booking.customerEmail} booked ${booking.seatName} for ${formatBookingNotificationTime(booking)}.`,
      bookingId: booking.id,
      createdAt: now,
      creatorId: booking.creatorId,
      id: `notification_${crypto.randomUUID()}`,
      readAt: null,
      title: "New paid booking",
      type: BOOKING_NOTIFICATION_TYPE,
    })
    .onConflictDoNothing({
      target: [creatorNotifications.bookingId, creatorNotifications.type],
    });
}

async function getCreatorNotificationProfile(creatorId: string) {
  const { getDb } = await import("../db");
  const db = getDb();
  const [profile] = await db
    .select({
      email: creatorOnboardingProfiles.email,
      phone: creatorOnboardingProfiles.phone,
    })
    .from(creatorOnboardingProfiles)
    .where(eq(creatorOnboardingProfiles.id, creatorId))
    .limit(1);

  return profile ?? null;
}

function formatBookingNotificationTime(booking: CustomerBooking) {
  const match = booking.appointmentStartAt.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u,
  );

  if (!match) {
    return booking.appointmentStartAt;
  }

  const [, year, month, day, hour, minute] = match;
  return `${month}/${day}/${year} at ${formatHour(Number(hour), minute)} ${booking.timezone}`;
}

function formatHour(hour: number, minute: string) {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${period}`;
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}
