import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const creatorOnboardingProfiles = sqliteTable("creator_onboarding_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  instagramPlatform: text("instagram_platform").notNull(),
  bio: text("bio").notNull(),
  handle: text("handle"),
  instagramHandle: text("instagram_handle"),
  tiktokHandle: text("tiktok_handle"),
  category: text("category"),
  location: text("location"),
  offer: text("offer"),
  profileImageUrl: text("profile_image_url"),
  profileImagePositionX: integer("profile_image_position_x"),
  profileImagePositionY: integer("profile_image_position_y"),
  profileImageZoom: integer("profile_image_zoom"),
  profileGallery: text("profile_gallery"),
  profileDetails: text("profile_details"),
  profileIntro: text("profile_intro"),
  about: text("about"),
  helpItems: text("help_items"),
  oneToOneReason: text("one_to_one_reason"),
  currency: text("currency"),
  seat15DurationMinutes: integer("seat_15_duration_minutes"),
  seat15Enabled: integer("seat_15_enabled", { mode: "boolean" }),
  seat15PriceAmount: integer("seat_15_price_amount"),
  seat15Description: text("seat_15_description"),
  seat30DurationMinutes: integer("seat_30_duration_minutes"),
  seat30Enabled: integer("seat_30_enabled", { mode: "boolean" }),
  seat30PriceAmount: integer("seat_30_price_amount"),
  seat30Description: text("seat_30_description"),
  timezone: text("timezone"),
  publicSlug: text("public_slug"),
  originalApplicationId: text("original_application_id"),
  publishedAt: text("published_at"),
  profileSavedAt: text("profile_saved_at"),
  profileDraft: text("profile_draft"),
  sessionOfferings: text("session_offerings"),
  draftSavedAt: text("draft_saved_at"),
  applicationStatus: text("application_status").notNull().default("draft"),
  reviewSubmittedAt: text("review_submitted_at"),
  calendarConnectedAt: text("calendar_connected_at"),
  stripeConnectedAt: text("stripe_connected_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  publicSlugIdx: uniqueIndex("creator_onboarding_profiles_public_slug_idx").on(
    table.publicSlug,
  ),
  originalApplicationIdIdx: uniqueIndex("creator_onboarding_profiles_original_application_id_idx").on(
    table.originalApplicationId,
  ),
}));

export const creatorStripeConnections = sqliteTable(
  "creator_stripe_connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    creatorId: text("creator_id").notNull(),
    stripeAccountId: text("stripe_account_id").notNull(),
    livemode: integer("livemode", { mode: "boolean" }).notNull().default(false),
    accountCountry: text("account_country").notNull(),
    dashboard: text("dashboard").notNull().default("express"),
    onboardingStartedAt: text("onboarding_started_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    connectedAt: text("connected_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    creatorIdx: uniqueIndex("creator_stripe_connections_creator_idx").on(
      table.creatorId,
    ),
    stripeAccountIdx: uniqueIndex("creator_stripe_connections_account_idx").on(
      table.stripeAccountId,
    ),
  }),
);

export const creatorCalendarConnections = sqliteTable(
  "creator_calendar_connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    creatorId: text("creator_id").notNull(),
    provider: text("provider").notNull().default("google"),
    calendarId: text("calendar_id").notNull().default("primary"),
    scopes: text("scopes").notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenType: text("token_type").notNull().default("Bearer"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    connectedAt: text("connected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    creatorProviderIdx: uniqueIndex("creator_calendar_connections_creator_provider_idx").on(
      table.creatorId,
      table.provider,
    ),
  }),
);

export const creatorAvailabilityRules = sqliteTable("creator_availability_rules", {
  weekStart: text("week_start"),
  id: integer("id").primaryKey({ autoIncrement: true }),
  creatorId: text("creator_id").notNull(),
  timezone: text("timezone").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  bufferMinutes: integer("buffer_minutes").notNull().default(15),
  minNoticeMinutes: integer("min_notice_minutes").notNull().default(1440),
  maxBookingsPerDay: integer("max_bookings_per_day"),
  maxBookingsPerWeek: integer("max_bookings_per_week"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const creatorNotificationPreferences = sqliteTable(
  "creator_notification_preferences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    creatorId: text("creator_id").notNull(),
    bookingEmailEnabled: integer("booking_email_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    bookingSmsEnabled: integer("booking_sms_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    bookingProfileEnabled: integer("booking_profile_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    creatorIdx: uniqueIndex("creator_notification_preferences_creator_idx").on(
      table.creatorId,
    ),
  }),
);

export const creatorNotifications = sqliteTable(
  "creator_notifications",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id").notNull(),
    bookingId: text("booking_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    bookingTypeIdx: uniqueIndex("creator_notifications_booking_type_idx").on(
      table.bookingId,
      table.type,
    ),
  }),
);

export const customerBookings = sqliteTable(
  "customer_bookings",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id").notNull(),
    creatorName: text("creator_name").notNull(),
    seatId: text("seat_id").notNull(),
    seatName: text("seat_name").notNull(),
    offeringDurationMinutes: integer("offering_duration_minutes"),
    offeringUnitAmount: integer("offering_unit_amount"),
    offeringCurrency: text("offering_currency"),
    offeringDescription: text("offering_description"),
    creatorDecision: text("creator_decision"),
    respondBy: integer("respond_by"),
    captureBefore: integer("capture_before"),
    workflowStep: text("workflow_step"),
    workflowRetryAt: integer("workflow_retry_at"),
    workflowAttempts: integer("workflow_attempts").notNull().default(0),
    workflowError: text("workflow_error"),
    workflowLock: text("workflow_lock"),
    workflowLockUntil: integer("workflow_lock_until"),
    zoomHostId: text("zoom_host_id"),
    zoomMeetingId: text("zoom_meeting_id"),
    zoomCreateAttemptAt: integer("zoom_create_attempt_at"),
    zoomSyncedRevision: text("zoom_synced_revision"),
    stripeRefundId: text("stripe_refund_id"),
    decisionNotifiedAt: text("decision_notified_at"),
    customerName: text("customer_name"),
    customerEmail: text("customer_email").notNull(),
    customerNote: text("customer_note"),
    appointmentStartAt: text("appointment_start_at").notNull(),
    appointmentEndAt: text("appointment_end_at").notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull().default("checkout_started"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    googleCalendarEventId: text("google_calendar_event_id"),
    googleCalendarId: text("google_calendar_id"),
    googleCalendarConnectionId: text("google_calendar_connection_id"),
    calendarSyncedRevision: text("calendar_synced_revision"),
    calendarSyncLock: text("calendar_sync_lock"),
    calendarSyncLockExpiresAt: integer("calendar_sync_lock_expires_at"),
    meetingUrl: text("meeting_url"),
    googleCalendarHtmlLink: text("google_calendar_html_link"),
    approvedAt: text("approved_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    stripeCheckoutSessionIdx: uniqueIndex("customer_bookings_stripe_checkout_session_idx").on(
      table.stripeCheckoutSessionId,
    ),
  }),
);

export const creatorInvites = sqliteTable(
  "creator_invites",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id").notNull(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    creatorIdx: uniqueIndex("creator_invites_creator_idx").on(table.creatorId),
    tokenHashIdx: uniqueIndex("creator_invites_token_hash_idx").on(table.tokenHash),
  }),
);

export const creatorAccounts = sqliteTable(
  "creator_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    creatorId: text("creator_id").notNull(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    acceptedInviteId: text("accepted_invite_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    clerkUserIdx: uniqueIndex("creator_accounts_clerk_user_idx").on(
      table.clerkUserId,
    ),
    creatorIdx: uniqueIndex("creator_accounts_creator_idx").on(table.creatorId),
  }),
);

// Bounded original media lives separately from the draft/public profile row.
export const creatorMedia = sqliteTable('creator_media', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id').notNull(),
  mime: text('mime').notNull(),
  bytes: integer('bytes').notNull(),
  createdAt: text('created_at').notNull(),
});
export const creatorMediaChunks = sqliteTable('creator_media_chunks', {
  mediaId: text('media_id').notNull(),
  position: integer('position').notNull(),
  content: text('content').notNull(),
}, (table) => ({ chunkIdx: uniqueIndex('creator_media_chunk_idx').on(table.mediaId, table.position) }));

// One-use OAuth attempts bind a browser nonce to the authenticated actor.
export const googleOAuthAttempts = sqliteTable("google_oauth_attempts", {
  nonce: text("nonce").primaryKey(),
  creatorId: text("creator_id").notNull(),
  actorId: text("actor_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

// One reserved interval per booking, assigned atomically across all creators.
export const zoomHostReservations = sqliteTable("zoom_host_reservations", {
  bookingId: text("booking_id").primaryKey(),
  hostId: text("host_id").notNull(),
  startAt: integer("start_at").notNull(),
  endAt: integer("end_at").notNull(),
});
export const bookingDeliveries = sqliteTable("booking_deliveries", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  firstAttemptAt: integer("first_attempt_at").notNull(),
  sentAt: integer("sent_at"),
  payload: text("payload").notNull(),
});
