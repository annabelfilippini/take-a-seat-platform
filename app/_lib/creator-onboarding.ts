import { and, desc, eq, or } from "drizzle-orm";
import {
  creatorAvailabilityRules,
  creatorAccounts,
  creatorCalendarConnections,
  creatorInvites,
  creatorNotificationPreferences,
  creatorNotifications,
  creatorOnboardingProfiles,
  creatorStripeConnections,
  customerBookings,
} from "../../db/schema";
import {
  creators,
  getCreatorById,
  getCreatorBySlug,
  type Creator,
  type CreatorMediaItem,
  type Seat,
} from "./creators";
import {
  normalizePhoneIdentity,
  type TakeASeatClerkUser,
} from "./clerk-auth";

export type CreatorOnboardingInput = {
  bio: string;
  email: string;
  instagramHandle: string;
  instagramPlatform: string;
  name: string;
  phone: string;
  profileDetails: string;
  tiktokHandle: string;
};

export type CreatorProfileSettingsInput = CreatorOnboardingInput & {
  about: string;
  category: string;
  currency: string;
  helpItems: string;
  location: string;
  oneToOneReason: string;
  offer: string;
  profileGallery: string;
  profileImageUrl: string;
  profileIntro: string;
  reviewSubmitted: boolean;
  seat15DurationMinutes: number;
  seat15Enabled: boolean;
  seat15PriceAmount: number;
  seat15Description: string;
  seat30DurationMinutes: number;
  seat30Enabled: boolean;
  seat30PriceAmount: number;
  seat30Description: string;
  timezone: string;
};

export type CreatorAvailabilityInput = {
  bufferMinutes: number;
  creatorId: string;
  maxBookingsPerDay: number | null;
  maxBookingsPerWeek: number | null;
  minNoticeMinutes: number;
  rules: CreatorAvailabilityRuleInput[];
  timezone: string;
};

type CreatorAvailabilityRuleInput = {
  dayOfWeek: number;
  endTime: string;
  startTime: string;
};

export type CreatorAvailabilityRule =
  typeof creatorAvailabilityRules.$inferSelect;

export type CreatorOnboardingProfile =
  typeof creatorOnboardingProfiles.$inferSelect;

export class CreatorPublishError extends Error {
  constructor(public readonly code: "public-id-invalid" | "public-id-taken") {
    super(code);
  }
}

export type CreatorDashboardAccount =
  | {
      availabilityRules: CreatorAvailabilityRule[];
      profile: CreatorOnboardingProfile;
      status: "linked" | "matched";
    }
  | {
      email: string | null;
      phone: string | null;
      status: "claimed" | "needs-invite";
    };

export type CreatorInviteClaimResult =
  | {
      profile: CreatorOnboardingProfile;
      status: "claimed" | "already-claimed";
    }
  | {
      email?: string | null;
      expectedEmail?: string;
      expectedPhone?: string | null;
      phone?: string | null;
      status:
        | "account-mismatch"
        | "claimed"
        | "identity-mismatch"
        | "expired"
        | "invalid"
        | "needs-identity";
    };

export function getCreatorOnboardingInput(url: URL): CreatorOnboardingInput | null {
  const name = cleanField(url.searchParams.get("name"));
  const email = cleanEmail(url.searchParams.get("email"));
  const instagramHandle = cleanField(url.searchParams.get("instagramHandle")) ?? "";
  const phone = cleanPhone(url.searchParams.get("phone"));
  const tiktokHandle = cleanField(url.searchParams.get("tiktokHandle")) ?? "";
  const instagramPlatform =
    cleanField(url.searchParams.get("instagramPlatform")) ??
    (instagramHandle || tiktokHandle);
  const profileDetails =
    cleanField(url.searchParams.get("profileDetails")) ??
    cleanField(url.searchParams.get("about"));
  const bio =
    cleanField(url.searchParams.get("bio")) ??
    profileDetails?.slice(0, 240);

  if (!name || !email || !phone || !profileDetails || !bio) {
    return null;
  }

  return {
    bio,
    email,
    instagramHandle,
    instagramPlatform,
    name,
    phone,
    profileDetails,
    tiktokHandle,
  };
}

export async function getCreatorProfileSettingsInput(
  formData: FormData,
): Promise<CreatorProfileSettingsInput | null> {
  const name =
    cleanField(getString(formData, "name")) ??
    getNameFromParts(formData);
  const email = cleanEmail(getString(formData, "email"));
  const instagramHandle = cleanField(getString(formData, "instagramHandle")) ?? "";
  const phone = cleanPhone(getString(formData, "phone"));
  const tiktokHandle = cleanField(getString(formData, "tiktokHandle")) ?? "";
  const instagramPlatform =
    cleanField(getString(formData, "instagramPlatform")) ??
    (instagramHandle || tiktokHandle);
  const profileDetails =
    cleanField(getString(formData, "profileDetails")) ??
    cleanField(getString(formData, "about"));
  const about = cleanField(getString(formData, "about")) ?? "";
  const profileIntro = cleanField(getString(formData, "profileIntro")) ?? "";
  const bio =
    cleanField(getString(formData, "bio")) ??
    createCreatorCardSummary(profileIntro, about, profileDetails);
  const uploadedProfileImage = await cleanUploadedProfileImage(
    formData.get("profileImageFile"),
  );

  if (!name || !email || !phone || !profileDetails || !bio) {
    return null;
  }

  return {
    about,
    bio,
    category: cleanField(getString(formData, "category")) ?? "Style & Beauty",
    currency: cleanCurrency(getString(formData, "currency")),
    email,
    helpItems: cleanHelpItems(getString(formData, "helpItems")),
    instagramHandle,
    instagramPlatform,
    location: cleanField(getString(formData, "location")) ?? "",
    name,
    oneToOneReason: cleanField(getString(formData, "oneToOneReason")) ?? "",
    offer: cleanField(getString(formData, "offer")) ?? "",
    phone,
    profileGallery: cleanProfileGallery(getString(formData, "profileGallery")),
    profileDetails,
    profileImageUrl:
      uploadedProfileImage ?? cleanProfileImageUrl(getString(formData, "profileImageUrl")) ?? "",
    profileIntro,
    reviewSubmitted: formData.get("reviewSubmittedAt") === "true",
    seat15Description:
      cleanField(getString(formData, "seat15Description")) ??
      "A quick second opinion before someone commits.",
    seat15DurationMinutes: cleanDurationMinutes(
      getString(formData, "seat15DurationMinutes"),
      15,
    ),
    seat15Enabled: formData.get("seat15Enabled") === "on",
    seat15PriceAmount: cleanMoneyAmount(getString(formData, "seat15PriceAmount")),
    seat30Description:
      cleanField(getString(formData, "seat30Description")) ??
      "A longer private call with room to talk through the full question.",
    seat30DurationMinutes: cleanDurationMinutes(
      getString(formData, "seat30DurationMinutes"),
      30,
    ),
    seat30Enabled: formData.get("seat30Enabled") === "on",
    seat30PriceAmount: cleanMoneyAmount(getString(formData, "seat30PriceAmount")),
    tiktokHandle,
    timezone: cleanTimezone(getString(formData, "timezone")),
  };
}

function getNameFromParts(formData: FormData) {
  const firstName = cleanField(getString(formData, "firstName"));
  const lastName = cleanField(getString(formData, "lastName"));
  return cleanField([firstName, lastName].filter(Boolean).join(" "));
}

export function getCreatorAvailabilityInput(
  formData: FormData,
): CreatorAvailabilityInput | null {
  const creatorId = getCreatorSettingsId(formData);
  const timezone = cleanTimezone(getString(formData, "timezone"));
  const rules = getAvailabilityRules(getString(formData, "availabilitySlots"));

  if (!creatorId || rules.length === 0) {
    return null;
  }

  return {
    bufferMinutes: cleanInteger(getString(formData, "bufferMinutes"), 0, 240, 15),
    creatorId,
    maxBookingsPerDay: cleanOptionalInteger(
      getString(formData, "maxBookingsPerDay"),
      1,
      24,
    ),
    maxBookingsPerWeek: cleanOptionalInteger(
      getString(formData, "maxBookingsPerWeek"),
      1,
      80,
    ),
    minNoticeMinutes: cleanInteger(
      getString(formData, "minNoticeMinutes"),
      0,
      10080,
      1440,
    ),
    rules,
    timezone,
  };
}

export function getCreatorOnboardingProfileId(url: URL) {
  const creatorId = url.searchParams.get("creatorId")?.trim() ?? "";

  if (!isCreatorSettingsId(creatorId)) {
    return null;
  }

  return creatorId.slice(0, 120);
}

export function getCreatorSettingsId(formData: FormData) {
  const creatorId = getString(formData, "creatorId")?.trim() ?? "";
  return isCreatorSettingsId(creatorId) ? creatorId.slice(0, 120) : null;
}

export async function createCreatorOnboardingProfile(
  input: CreatorOnboardingInput,
  requestedId?: string | null,
) {
  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();
  const id = requestedId ?? `onboard_${crypto.randomUUID()}`;

  await db
    .insert(creatorOnboardingProfiles)
    .values({
      bio: input.bio,
      createdAt: now,
      email: input.email,
      id,
      instagramHandle: input.instagramHandle,
      instagramPlatform: input.instagramPlatform,
      name: input.name,
      originalApplicationId: id,
      phone: input.phone,
      profileDetails: input.profileDetails,
      tiktokHandle: input.tiktokHandle,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        bio: input.bio,
        email: input.email,
        instagramHandle: input.instagramHandle,
        instagramPlatform: input.instagramPlatform,
        name: input.name,
        originalApplicationId: id,
        phone: input.phone,
        profileDetails: input.profileDetails,
        tiktokHandle: input.tiktokHandle,
        updatedAt: now,
      },
      target: creatorOnboardingProfiles.id,
    });

  return id;
}

export async function saveCreatorProfileSettings(
  creatorId: string,
  input: CreatorProfileSettingsInput,
) {
  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();
  const applicationStatus = input.reviewSubmitted ? "in_review" : "draft";
  const reviewSubmittedAt = input.reviewSubmitted ? now : undefined;

  await db
    .insert(creatorOnboardingProfiles)
    .values({
      about: input.about,
      bio: input.bio,
      calendarConnectedAt: undefined,
      category: input.category,
      createdAt: now,
      currency: input.currency,
      email: input.email,
      helpItems: input.helpItems,
      instagramHandle: input.instagramHandle,
      id: creatorId,
      instagramPlatform: input.instagramPlatform,
      location: input.location,
      name: input.name,
      oneToOneReason: input.oneToOneReason,
      originalApplicationId: creatorId,
      offer: input.offer,
      phone: input.phone,
      profileGallery: input.profileGallery,
      profileDetails: input.profileDetails,
      profileImageUrl: input.profileImageUrl,
      profileIntro: input.profileIntro,
      applicationStatus,
      reviewSubmittedAt,
      seat15Description: input.seat15Description,
      seat15DurationMinutes: input.seat15DurationMinutes,
      seat15Enabled: input.seat15Enabled,
      seat15PriceAmount: input.seat15PriceAmount,
      seat30Description: input.seat30Description,
      seat30DurationMinutes: input.seat30DurationMinutes,
      seat30Enabled: input.seat30Enabled,
      seat30PriceAmount: input.seat30PriceAmount,
      stripeConnectedAt: undefined,
      tiktokHandle: input.tiktokHandle,
      timezone: input.timezone,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        about: input.about,
        bio: input.bio,
        category: input.category,
        currency: input.currency,
        email: input.email,
        helpItems: input.helpItems,
        instagramHandle: input.instagramHandle,
        instagramPlatform: input.instagramPlatform,
        location: input.location,
        name: input.name,
        oneToOneReason: input.oneToOneReason,
        offer: input.offer,
        profileGallery: input.profileGallery,
        phone: input.phone,
        profileDetails: input.profileDetails,
        profileImageUrl: input.profileImageUrl,
        profileIntro: input.profileIntro,
        ...(input.reviewSubmitted ? { applicationStatus } : {}),
        reviewSubmittedAt,
        seat15Description: input.seat15Description,
        seat15DurationMinutes: input.seat15DurationMinutes,
        seat15Enabled: input.seat15Enabled,
        seat15PriceAmount: input.seat15PriceAmount,
        seat30Description: input.seat30Description,
        seat30DurationMinutes: input.seat30DurationMinutes,
        seat30Enabled: input.seat30Enabled,
        seat30PriceAmount: input.seat30PriceAmount,
        tiktokHandle: input.tiktokHandle,
        timezone: input.timezone,
        updatedAt: now,
      },
      target: creatorOnboardingProfiles.id,
    });
}

export async function listCreatorApplications() {
  const { getDb } = await import("../../db");
  const db = getDb();

  return db
    .select()
    .from(creatorOnboardingProfiles)
    .orderBy(
      desc(creatorOnboardingProfiles.reviewSubmittedAt),
      desc(creatorOnboardingProfiles.createdAt),
    );
}

export async function getCreatorApplication(creatorId: string) {
  if (!isCreatorSettingsId(creatorId)) {
    return null;
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const cleanCreatorId = creatorId.slice(0, 120);
  const [profile] = await db
    .select()
    .from(creatorOnboardingProfiles)
    .where(
      or(
        eq(creatorOnboardingProfiles.id, cleanCreatorId),
        eq(creatorOnboardingProfiles.originalApplicationId, cleanCreatorId),
        eq(creatorOnboardingProfiles.publicSlug, cleanCreatorId),
      ),
    )
    .orderBy(desc(creatorOnboardingProfiles.updatedAt))
    .limit(1);

  return profile ?? null;
}

export async function getCreatorDashboardAccount(
  user: TakeASeatClerkUser,
): Promise<CreatorDashboardAccount> {
  const { getDb } = await import("../../db");
  const db = getDb();

  const [existingAccount] = await db
    .select()
    .from(creatorAccounts)
    .where(eq(creatorAccounts.clerkUserId, user.userId))
    .limit(1);

  if (existingAccount) {
    const profile = await getCreatorApplication(existingAccount.creatorId);

    if (profile) {
      const availabilityRules = await listCreatorAvailabilityRules(profile.id);
      return { availabilityRules, profile, status: "linked" };
    }
  }

  const acceptedProfile = await getAcceptedCreatorProfileForUser(user);

  if (!acceptedProfile) {
    return { email: user.email, phone: user.phone, status: "needs-invite" };
  }

  const [creatorOwner] = await db
    .select()
    .from(creatorAccounts)
    .where(eq(creatorAccounts.creatorId, acceptedProfile.id))
    .limit(1);

  if (creatorOwner && creatorOwner.clerkUserId !== user.userId) {
    return { email: user.email, phone: user.phone, status: "claimed" };
  }

  if (!creatorOwner) {
    const now = new Date().toISOString();

    await db
      .insert(creatorAccounts)
      .values({
        acceptedInviteId: null,
        createdAt: now,
        creatorId: acceptedProfile.id,
        clerkUserId: user.userId,
        email: (user.email ?? acceptedProfile.email ?? user.userId).toLowerCase(),
        updatedAt: now,
      })
      .onConflictDoNothing({ target: creatorAccounts.creatorId });

    const [linkedOwner] = await db
      .select()
      .from(creatorAccounts)
      .where(eq(creatorAccounts.creatorId, acceptedProfile.id))
      .limit(1);

    if (linkedOwner?.clerkUserId !== user.userId) {
      return { email: user.email, phone: user.phone, status: "claimed" };
    }

    const availabilityRules = await listCreatorAvailabilityRules(acceptedProfile.id);

    return { availabilityRules, profile: acceptedProfile, status: "matched" };
  }

  const availabilityRules = await listCreatorAvailabilityRules(acceptedProfile.id);

  return { availabilityRules, profile: acceptedProfile, status: "linked" };
}

export async function acceptCreatorApplication(
  creatorId: string,
  requestedPublicId?: string | null,
) {
  const profile = await getCreatorApplication(creatorId);

  if (!profile) {
    return null;
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();
  const publicId =
    normalizeCreatorPublicId(requestedPublicId) ??
    getSuggestedCreatorPublicId(profile) ??
    normalizeCreatorPublicId(profile.id);

  if (!publicId) {
    throw new CreatorPublishError("public-id-invalid");
  }

  const [existingPublicSlug] = await db
    .select({ id: creatorOnboardingProfiles.id })
    .from(creatorOnboardingProfiles)
    .where(eq(creatorOnboardingProfiles.publicSlug, publicId))
    .limit(1);

  if (existingPublicSlug && existingPublicSlug.id !== profile.id) {
    throw new CreatorPublishError("public-id-taken");
  }

  if (publicId !== profile.id) {
    const existing = await getCreatorApplication(publicId);

    if (existing) {
      throw new CreatorPublishError("public-id-taken");
    }

    await db
      .update(creatorOnboardingProfiles)
      .set({
        applicationStatus: "accepted",
        id: publicId,
        originalApplicationId: profile.originalApplicationId ?? profile.id,
        publicSlug: publicId,
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(creatorOnboardingProfiles.id, profile.id));

    await Promise.all([
      db
        .update(creatorAvailabilityRules)
        .set({ creatorId: publicId, updatedAt: now })
        .where(eq(creatorAvailabilityRules.creatorId, profile.id)),
      db
        .update(creatorAccounts)
        .set({ creatorId: publicId, updatedAt: now })
        .where(eq(creatorAccounts.creatorId, profile.id)),
      db
        .update(creatorCalendarConnections)
        .set({ creatorId: publicId, updatedAt: now })
        .where(eq(creatorCalendarConnections.creatorId, profile.id)),
      db
        .update(creatorInvites)
        .set({ creatorId: publicId, updatedAt: now })
        .where(eq(creatorInvites.creatorId, profile.id)),
      db
        .update(creatorNotificationPreferences)
        .set({ creatorId: publicId, updatedAt: now })
        .where(eq(creatorNotificationPreferences.creatorId, profile.id)),
      db
        .update(creatorNotifications)
        .set({ creatorId: publicId })
        .where(eq(creatorNotifications.creatorId, profile.id)),
      db
        .update(creatorStripeConnections)
        .set({ creatorId: publicId, updatedAt: now })
        .where(eq(creatorStripeConnections.creatorId, profile.id)),
      db
        .update(customerBookings)
        .set({ creatorId: publicId, updatedAt: now })
        .where(eq(customerBookings.creatorId, profile.id)),
    ]);

    return {
      ...profile,
      applicationStatus: "accepted",
      id: publicId,
      originalApplicationId: profile.originalApplicationId ?? profile.id,
      publicSlug: publicId,
      publishedAt: now,
      updatedAt: now,
    };
  }

  await db
    .update(creatorOnboardingProfiles)
    .set({
      applicationStatus: "accepted",
      originalApplicationId: profile.originalApplicationId ?? profile.id,
      publicSlug: publicId,
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(creatorOnboardingProfiles.id, profile.id));

  return {
    ...profile,
    applicationStatus: "accepted",
    originalApplicationId: profile.originalApplicationId ?? profile.id,
    publicSlug: publicId,
    publishedAt: now,
    updatedAt: now,
  };
}

export function getSuggestedCreatorPublicId(profile: Pick<CreatorOnboardingProfile, "id" | "instagramHandle" | "instagramPlatform" | "name" | "tiktokHandle">) {
  if (isPublicCreatorId(profile.id)) {
    return profile.id;
  }

  const socialValues = [
    profile.instagramHandle,
    profile.tiktokHandle,
    profile.instagramPlatform,
  ]
    .map(normalizeSocialHandle)
    .filter(Boolean);
  const matchingStaticCreator = creators.find((creator) => {
    const staticHandles = [
      creator.instagramHandle,
      creator.tiktokHandle,
      creator.instagramUrl,
      creator.tiktokUrl,
    ]
      .map(normalizeSocialHandle)
      .filter(Boolean);

    return socialValues.some((value) => staticHandles.includes(value));
  });

  return matchingStaticCreator?.id ?? slugifyCreatorValue(profile.name);
}

export async function getAvailableCreatorPublicIdSuggestion(
  profile: Pick<
    CreatorOnboardingProfile,
    | "id"
    | "instagramHandle"
    | "instagramPlatform"
    | "name"
    | "publicSlug"
    | "tiktokHandle"
  >,
) {
  const currentPublicSlug = normalizeCreatorPublicId(profile.publicSlug);

  if (currentPublicSlug) {
    return currentPublicSlug;
  }

  const basePublicId = getSuggestedCreatorPublicId(profile);

  if (!basePublicId) {
    return "";
  }

  for (let suffix = 1; suffix <= 99; suffix += 1) {
    const candidate = suffix === 1 ? basePublicId : `${basePublicId}-${suffix}`;

    if (!(await isCreatorPublicIdTaken(candidate, profile.id))) {
      return candidate;
    }
  }

  return basePublicId;
}

async function isCreatorPublicIdTaken(publicId: string, currentCreatorId: string) {
  const { getDb } = await import("../../db");
  const db = getDb();
  const [existing] = await db
    .select({ id: creatorOnboardingProfiles.id })
    .from(creatorOnboardingProfiles)
    .where(
      or(
        eq(creatorOnboardingProfiles.id, publicId),
        eq(creatorOnboardingProfiles.originalApplicationId, publicId),
        eq(creatorOnboardingProfiles.publicSlug, publicId),
      ),
    )
    .limit(1);

  return Boolean(existing && existing.id !== currentCreatorId);
}

export function normalizeCreatorPublicId(value: string | null | undefined) {
  const slug = slugifyCreatorValue(value);

  return slug && isPublicCreatorId(slug) ? slug : null;
}

export async function getPublishedCreatorBySlug(slug: string) {
  const publicSlug = normalizeCreatorPublicId(slug);

  if (!publicSlug) {
    return null;
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const [profile] = await db
    .select()
    .from(creatorOnboardingProfiles)
    .where(
      and(
        eq(creatorOnboardingProfiles.applicationStatus, "accepted"),
        or(
          eq(creatorOnboardingProfiles.publicSlug, publicSlug),
          eq(creatorOnboardingProfiles.id, publicSlug),
        ),
      ),
    )
    .orderBy(desc(creatorOnboardingProfiles.publishedAt))
    .limit(1);

  if (!profile) {
    return null;
  }

  const availabilityRules = await listCreatorAvailabilityRules(profile.id);

  return createPublishedCreator(profile, availabilityRules);
}

export async function getPublicCreatorBySlug(slug: string) {
  try {
    const publishedCreator = await getPublishedCreatorBySlug(slug);

    if (publishedCreator) {
      return publishedCreator;
    }
  } catch {
    // D1 may be absent or not migrated in local/build contexts. Static profiles
    // remain the safe fallback until remote migrations are applied.
  }

  return getCreatorBySlug(slug) ?? null;
}

export async function getBookableCreatorById(creatorId: string) {
  if (!isCreatorSettingsId(creatorId)) {
    return null;
  }

  try {
    const publishedCreator = await getPublishedCreatorBySlug(creatorId);

    if (publishedCreator?.seats.length) {
      return publishedCreator;
    }
  } catch {
    // Fall back to checked-in creator records when D1 is unavailable.
  }

  return getCreatorById(creatorId) ?? null;
}

export async function createCreatorInvite(
  profile: CreatorOnboardingProfile,
): Promise<{ emailNonce: string; expiresAt: string; token: string }> {
  if (!profile.email) {
    throw new Error("Creator invite requires an email address.");
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const token = createInviteToken();
  const tokenHash = await hashInviteToken(token);

  await db
    .insert(creatorInvites)
    .values({
      createdAt: now,
      creatorId: profile.id,
      email: profile.email,
      expiresAt,
      id: `invite_${crypto.randomUUID()}`,
      revokedAt: null,
      tokenHash,
      updatedAt: now,
      usedAt: null,
    })
    .onConflictDoUpdate({
      set: {
        email: profile.email,
        expiresAt,
        revokedAt: null,
        tokenHash,
        updatedAt: now,
        usedAt: null,
      },
      target: creatorInvites.creatorId,
    });

  return { emailNonce: tokenHash.slice(0, 16), expiresAt, token };
}

export async function getCreatorInvitePreview(token: string) {
  const invite = await getValidCreatorInvite(token);

  if (!invite) {
    return null;
  }

  if (Date.parse(invite.expiresAt) <= Date.now()) {
    return null;
  }

  const profile = await getCreatorApplication(invite.creatorId);

  if (!profile || profile.applicationStatus !== "accepted") {
    return null;
  }

  return {
    email: invite.email,
    expiresAt: invite.expiresAt,
    profile,
    usedAt: invite.usedAt,
  };
}

export async function claimCreatorInvite(
  token: string,
  user: TakeASeatClerkUser,
): Promise<CreatorInviteClaimResult> {
  const invite = await getValidCreatorInvite(token);

  if (!invite) {
    return { status: "invalid" };
  }

  if (invite.usedAt || invite.revokedAt) {
    return { status: "claimed" };
  }

  if (Date.parse(invite.expiresAt) <= Date.now()) {
    return { status: "expired" };
  }

  const profile = await getCreatorApplication(invite.creatorId);

  if (!profile || profile.applicationStatus !== "accepted") {
    return { status: "invalid" };
  }

  if (!creatorIdentityMatchesProfile(user, profile, invite.email)) {
    if (!user.email && !user.phone) {
      return {
        expectedEmail: invite.email,
        expectedPhone: profile.phone,
        status: "needs-identity",
      };
    }

    return {
      email: user.email,
      expectedEmail: invite.email,
      expectedPhone: profile.phone,
      phone: user.phone,
      status: "identity-mismatch",
    };
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();
  const [existingUserAccount] = await db
    .select()
    .from(creatorAccounts)
    .where(eq(creatorAccounts.clerkUserId, user.userId))
    .limit(1);

  if (existingUserAccount && existingUserAccount.creatorId !== profile.id) {
    return { email: user.email, phone: user.phone, status: "account-mismatch" };
  }

  const [existingCreatorAccount] = await db
    .select()
    .from(creatorAccounts)
    .where(eq(creatorAccounts.creatorId, profile.id))
    .limit(1);

  if (
    existingCreatorAccount &&
    existingCreatorAccount.clerkUserId !== user.userId
  ) {
    return { email: user.email, phone: user.phone, status: "claimed" };
  }

  if (!existingCreatorAccount) {
    await db.insert(creatorAccounts).values({
      acceptedInviteId: invite.id,
      createdAt: now,
      creatorId: profile.id,
      clerkUserId: user.userId,
      email: user.email ?? invite.email.toLowerCase(),
      updatedAt: now,
    });
  }

  await db
    .update(creatorInvites)
    .set({ usedAt: invite.usedAt ?? now, updatedAt: now })
    .where(eq(creatorInvites.id, invite.id));

  return {
    profile,
    status: existingCreatorAccount ? "already-claimed" : "claimed",
  };
}

async function getAcceptedCreatorProfileForUser(user: TakeASeatClerkUser) {
  const { getDb } = await import("../../db");
  const db = getDb();

  if (user.email) {
    const [acceptedProfile] = await db
      .select()
      .from(creatorOnboardingProfiles)
      .where(
        and(
          eq(creatorOnboardingProfiles.email, user.email),
          eq(creatorOnboardingProfiles.applicationStatus, "accepted"),
        ),
      )
      .orderBy(desc(creatorOnboardingProfiles.updatedAt))
      .limit(1);

    if (acceptedProfile) {
      return acceptedProfile;
    }
  }

  if (!user.phone) {
    return null;
  }

  const acceptedProfiles = await db
    .select()
    .from(creatorOnboardingProfiles)
    .where(eq(creatorOnboardingProfiles.applicationStatus, "accepted"))
    .orderBy(desc(creatorOnboardingProfiles.updatedAt));

  return (
    acceptedProfiles.find(
      (profile) => normalizePhoneIdentity(profile.phone) === user.phone,
    ) ?? null
  );
}

function creatorIdentityMatchesProfile(
  user: TakeASeatClerkUser,
  profile: CreatorOnboardingProfile,
  inviteEmail: string,
) {
  const expectedEmail = (profile.email ?? inviteEmail).toLowerCase();
  const expectedPhone = normalizePhoneIdentity(profile.phone);

  return Boolean(
    (user.email && user.email === expectedEmail) ||
      (user.phone && expectedPhone && user.phone === expectedPhone),
  );
}

export async function canManageCreatorProfile(
  creatorId: string,
  user: TakeASeatClerkUser,
) {
  if (!isCreatorSettingsId(creatorId)) {
    return false;
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const [account] = await db
    .select()
    .from(creatorAccounts)
    .where(
      and(
        eq(creatorAccounts.creatorId, creatorId.slice(0, 120)),
        eq(creatorAccounts.clerkUserId, user.userId),
      ),
    )
    .limit(1);

  return Boolean(account);
}

export function createPublishedCreator(
  profile: CreatorOnboardingProfile,
  availabilityRules: CreatorAvailabilityRule[] = [],
): Creator {
  const seats = createPublishedSeats(profile);
  const firstSeat = seats[0] ?? null;
  const publicSlug = normalizeCreatorPublicId(profile.publicSlug) ?? profile.id;
  const intro = profile.profileIntro || profile.bio;
  const about = splitProfileParagraphs(
    profile.about || profile.profileDetails || profile.bio,
  );
  const helpItems = splitProfileLines(profile.helpItems);
  const firstName = profile.name.split(/\s+/u)[0] || profile.name;

  return {
    accent: getCreatorAccent(profile.category),
    availabilityRules: availabilityRules.map((rule) => ({
      bufferMinutes: rule.bufferMinutes,
      dayOfWeek: rule.dayOfWeek,
      enabled: rule.enabled,
      endTime: rule.endTime,
      maxBookingsPerDay: rule.maxBookingsPerDay,
      maxBookingsPerWeek: rule.maxBookingsPerWeek,
      minNoticeMinutes: rule.minNoticeMinutes,
      startTime: rule.startTime,
      timezone: rule.timezone,
    })),
    category: profile.category || "Style & Beauty",
    id: profile.id,
    image: profile.profileImageUrl || null,
    instagramHandle: profile.instagramHandle || undefined,
    instagramUrl: getSocialUrl("instagram", profile.instagramHandle),
    length: firstSeat?.name ?? "Opening soon",
    location: profile.location || undefined,
    mediaItems: getPublishedCreatorMediaItems(profile),
    name: profile.name,
    note: firstSeat?.description ?? profile.bio,
    objectPosition: "50% 50%",
    offer: profile.offer || firstSeat?.name || "Private advice seat",
    price: firstSeat?.price ?? "Soon",
    profile: {
      about,
      announcement: "Now booking on Take a Seat",
      helpHeading: helpItems.length
        ? `${firstName} can help with`
        : "Good questions to bring",
      helpItems,
      intro,
      waitlistSubject: `Book ${profile.name} on Take a Seat`,
      whyBody:
        profile.oneToOneReason ||
        "A private call makes the advice specific to the person, question, timing, and context.",
      whyTitle: "Why a 1:1 call?",
    },
    seats,
    slug: publicSlug,
    status: seats.length ? "booking" : "soon",
    tiktokHandle: profile.tiktokHandle || undefined,
    tiktokUrl: getSocialUrl("tiktok", profile.tiktokHandle),
    title: intro,
  };
}

function createPublishedSeats(profile: CreatorOnboardingProfile): Seat[] {
  return [
    createPublishedSeat(profile, 15),
    createPublishedSeat(profile, 30),
  ].filter((seat): seat is Seat => Boolean(seat));
}

function createPublishedSeat(
  profile: CreatorOnboardingProfile,
  duration: 15 | 30,
): Seat | null {
  const enabled =
    duration === 15 ? profile.seat15Enabled : profile.seat30Enabled;
  const durationMinutes =
    duration === 15
      ? profile.seat15DurationMinutes
      : profile.seat30DurationMinutes;
  const unitAmount =
    duration === 15 ? profile.seat15PriceAmount : profile.seat30PriceAmount;
  const description =
    duration === 15 ? profile.seat15Description : profile.seat30Description;

  if (!enabled || !unitAmount || unitAmount <= 0) {
    return null;
  }

  const minutes = durationMinutes || duration;

  return {
    description:
      description || `A ${minutes} minute private call with ${profile.name}.`,
    format: "Private video call",
    host: profile.name,
    id: `${profile.id}-${minutes}`,
    name: `${minutes} minutes`,
    price: formatSeatPrice(unitAmount, profile.currency || "USD"),
    stripePriceEnv: getSeatPriceEnvName(profile.id, minutes),
    unitAmount,
  };
}

function getSeatPriceEnvName(creatorId: string, minutes: number) {
  const envSafeCreatorId = creatorId
    .replace(/[^a-z0-9]+/giu, "_")
    .replace(/^_+|_+$/gu, "")
    .toUpperCase();

  return `STRIPE_PRICE_${envSafeCreatorId}_${minutes}`;
}

function formatSeatPrice(unitAmount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      currency,
      maximumFractionDigits: Number.isInteger(unitAmount / 100) ? 0 : 2,
      style: "currency",
    }).format(unitAmount / 100);
  } catch {
    return `$${Math.round(unitAmount / 100)}`;
  }
}

function splitProfileParagraphs(value: string | null) {
  const paragraphs = splitProfileLines(value);
  return paragraphs.length
    ? paragraphs
    : ["Bring the real question and leave with a clearer next step."];
}

function splitProfileLines(value: string | null) {
  return (value ?? "")
    .split(/\n+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPublishedCreatorMediaItems(
  profile: CreatorOnboardingProfile,
): CreatorMediaItem[] {
  return splitProfileLines(profile.profileGallery).map((source, index) => ({
    id: `${profile.id}-media-${index + 1}`,
    kind: isVideoMediaSource(source) ? "video" : "photo",
    source,
    title: `${profile.name} media ${index + 1}`,
  }));
}

function isVideoMediaSource(source: string) {
  return (
    /^data:video\//i.test(source) ||
    /(?:\.m4v|\.mov|\.mp4|\.webm)(?:[?#].*)?$/i.test(source)
  );
}

function getCreatorAccent(category: string | null) {
  const normalized = (category ?? "").toLowerCase();

  if (normalized.includes("home") || normalized.includes("interior")) {
    return "home";
  }

  if (normalized.includes("wellness") || normalized.includes("fitness")) {
    return "wellness";
  }

  if (normalized.includes("food")) {
    return "food";
  }

  if (normalized.includes("beauty")) {
    return "beauty";
  }

  return "style";
}

function getSocialUrl(platform: "instagram" | "tiktok", handle: string | null) {
  const normalized = normalizeSocialHandle(handle);

  if (!normalized) {
    return undefined;
  }

  return platform === "instagram"
    ? `https://www.instagram.com/${normalized}/`
    : `https://www.tiktok.com/@${normalized}`;
}

export async function saveCreatorAvailability(input: CreatorAvailabilityInput) {
  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .delete(creatorAvailabilityRules)
    .where(eq(creatorAvailabilityRules.creatorId, input.creatorId));

  await db.insert(creatorAvailabilityRules).values(
    input.rules.map((rule) => ({
      bufferMinutes: input.bufferMinutes,
      createdAt: now,
      creatorId: input.creatorId,
      dayOfWeek: rule.dayOfWeek,
      enabled: true,
      endTime: rule.endTime,
      maxBookingsPerDay: input.maxBookingsPerDay,
      maxBookingsPerWeek: input.maxBookingsPerWeek,
      minNoticeMinutes: input.minNoticeMinutes,
      startTime: rule.startTime,
      timezone: input.timezone,
      updatedAt: now,
    })),
  );
}

export async function listCreatorAvailabilityRules(creatorId: string) {
  if (!isCreatorSettingsId(creatorId)) {
    return [];
  }

  const { getDb } = await import("../../db");
  const db = getDb();

  return db
    .select()
    .from(creatorAvailabilityRules)
    .where(eq(creatorAvailabilityRules.creatorId, creatorId.slice(0, 120)))
    .orderBy(
      creatorAvailabilityRules.dayOfWeek,
      creatorAvailabilityRules.startTime,
    );
}

export async function markCalendarConnected(creatorId: string) {
  if (!isCreatorSettingsId(creatorId)) {
    return;
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .update(creatorOnboardingProfiles)
    .set({ calendarConnectedAt: now, updatedAt: now })
    .where(eq(creatorOnboardingProfiles.id, creatorId));
}

export async function markStripeConnected(creatorId: string) {
  if (!isCreatorSettingsId(creatorId)) {
    return;
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .update(creatorOnboardingProfiles)
    .set({ stripeConnectedAt: now, updatedAt: now })
    .where(eq(creatorOnboardingProfiles.id, creatorId));
}

function cleanField(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.slice(0, 1000) : null;
}

async function getValidCreatorInvite(token: string) {
  const cleanToken = token.trim();

  if (!cleanToken || cleanToken.length > 240) {
    return null;
  }

  const { getDb } = await import("../../db");
  const db = getDb();
  const tokenHash = await hashInviteToken(cleanToken);
  const [invite] = await db
    .select()
    .from(creatorInvites)
    .where(eq(creatorInvites.tokenHash, tokenHash))
    .limit(1);

  return invite ?? null;
}

function createInviteToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function hashInviteToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function cleanEmail(value: string | null) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed.includes("@") ? trimmed.slice(0, 320) : "";
}

function cleanPhone(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.slice(0, 40) : "";
}

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

function isCreatorSettingsId(creatorId: string) {
  return (
    creatorId.startsWith("onboard_") ||
    Boolean(getCreatorById(creatorId)) ||
    isPublicCreatorId(creatorId)
  );
}

function cleanCurrency(value: string | null) {
  const trimmed = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : "USD";
}

function cleanHelpItems(value: string | null) {
  return (value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join("\n");
}

function cleanProfileGallery(value: string | null) {
  return (value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join("\n");
}

function cleanProfileImageUrl(value: string | null) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  if (/^data:image\//i.test(trimmed)) {
    return trimmed;
  }

  return cleanField(trimmed);
}

async function cleanUploadedProfileImage(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string" || !isFileLike(value)) {
    return null;
  }

  if (!value.size || value.size > 750_000 || !value.type.startsWith("image/")) {
    return null;
  }

  const bytes = new Uint8Array(await value.arrayBuffer());
  return `data:${value.type};base64,${base64Encode(bytes)}`;
}

function isFileLike(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "size" in value &&
    typeof value.size === "number" &&
    "type" in value &&
    typeof value.type === "string"
  );
}

function createCreatorCardSummary(...values: Array<string | null | undefined>) {
  const source =
    values
      .map((value) => value?.replace(/\s+/g, " ").trim() ?? "")
      .find(Boolean) ?? "";

  if (source.length <= 240) {
    return source;
  }

  return `${source.slice(0, 237).trim()}...`;
}

function base64Encode(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary);
}

function slugifyCreatorValue(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/^@/u, "")
    .replace(/https?:\/\/(?:www\.)?(?:instagram\.com|tiktok\.com)\//u, "")
    .replace(/^@/u, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 120);
}

function normalizeSocialHandle(value: string | null | undefined) {
  return slugifyCreatorValue(value).replace(/-/gu, "");
}

function isPublicCreatorId(creatorId: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/u.test(creatorId);
}

function getAvailabilityRules(value: string | null): CreatorAvailabilityRuleInput[] {
  if (!value) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const slotsByDay = new Map<number, string[]>();

  for (const slot of parsed) {
    if (!slot || typeof slot !== "object") {
      continue;
    }

    const dayOfWeek = Number((slot as { dayOfWeek?: unknown }).dayOfWeek);
    const startTime = cleanTime(
      typeof (slot as { startTime?: unknown }).startTime === "string"
        ? (slot as { startTime: string }).startTime
        : null,
    );

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !startTime) {
      continue;
    }

    const daySlots = slotsByDay.get(dayOfWeek) ?? [];
    daySlots.push(startTime);
    slotsByDay.set(dayOfWeek, daySlots);
  }

  const rules: CreatorAvailabilityRuleInput[] = [];

  for (const [dayOfWeek, slots] of slotsByDay) {
    const sortedSlots = Array.from(new Set(slots)).sort();
    if (sortedSlots.length === 0) {
      continue;
    }

    let rangeStart = sortedSlots[0];
    let previousSlot = sortedSlots[0];

    for (const slot of sortedSlots.slice(1)) {
      if (slot !== addMinutes(previousSlot, 30)) {
        rules.push({
          dayOfWeek,
          endTime: addMinutes(previousSlot, 30),
          startTime: rangeStart,
        });
        rangeStart = slot;
      }

      previousSlot = slot;
    }

    if (rangeStart && previousSlot) {
      rules.push({
        dayOfWeek,
        endTime: addMinutes(previousSlot, 30),
        startTime: rangeStart,
      });
    }
  }

  return rules.sort((left, right) =>
    left.dayOfWeek === right.dayOfWeek
      ? left.startTime.localeCompare(right.startTime)
      : left.dayOfWeek - right.dayOfWeek,
  );
}

function cleanInteger(
  value: string | null,
  min: number,
  max: number,
  fallback: number,
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function cleanOptionalInteger(value: string | null, min: number, max: number) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  return cleanInteger(trimmed, min, max, min);
}

function cleanMoneyAmount(value: string | null) {
  const cleaned = value?.replace(/[$£€,]/g, "").trim() ?? "";
  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function cleanDurationMinutes(value: string | null, fallback: number) {
  const parsed = Number(value?.trim() ?? "");

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(240, Math.max(5, Math.round(parsed)));
}

function cleanTime(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : null;
}

function addMinutes(value: string, minutes: number) {
  const [hours, currentMinutes] = value.split(":").map(Number);
  const totalMinutes = hours * 60 + currentMinutes + minutes;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(
    totalMinutes % 60,
  ).padStart(2, "0")}`;
}

function cleanTimezone(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return /^[A-Za-z0-9_+\-/]+$/.test(trimmed) ? trimmed.slice(0, 80) : "America/Los_Angeles";
}
