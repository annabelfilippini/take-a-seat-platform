import type { CreatorOnboardingProfile } from "../../_lib/creator-onboarding";

export type EditableCreatorMediaItem = {
  id: string;
  kind: "photo" | "video";
  source: string;
  title: string;
};

export type EditableCreatorProfile = {
  about: string;
  bio: string;
  calendarConnectedAt?: string | null;
  category: string;
  currency: string;
  email?: string | null;
  helpItems: string;
  id: string;
  image: string;
  instagramHandle: string;
  instagramUrl: string;
  location: string;
  mediaItems: EditableCreatorMediaItem[];
  name: string;
  oneToOneReason: string;
  offer: string;
  phone: string;
  profileImagePositionX?: number;
  profileImagePositionY?: number;
  profileImageZoom?: number;
  profileDetails?: string | null;
  profileIntro: string;
  seat15Description: string;
  seat15DurationMinutes: number | string;
  seat15Enabled: boolean;
  seat15PriceAmount: number | string;
  seat30Description: string;
  seat30DurationMinutes: number | string;
  seat30Enabled: boolean;
  seat30PriceAmount: number | string;
  stripeConnectedAt?: string | null;
  tiktokHandle: string;
  tiktokUrl: string;
  timezone: string;
};

export const annabelMockProfile: EditableCreatorProfile = {
  about:
    "I built Take a Seat to make the kind of advice people already ask for in DMs feel easier to book, clearer to prepare for, and more useful in real time. This mock profile lets us pressure-test the exact fields creators will control before Ella and the first accepted creators use them.",
  bio: "Founder test profile for checking the creator editor, pricing, and booking setup.",
  category: "Style & Beauty",
  currency: "USD",
  email: "annabel@example.com",
  helpItems:
    "Shape your public profile copy.\nTest how 15 and 30 minute seat descriptions read.\nCheck whether pricing feels clear before launch.\nReview what customers can ask before booking.\nConfirm the editor has enough control for a creator like Ella.",
  id: "onboard_annabel_mock_profile",
  image: "/amber-headshot.jpg",
  instagramHandle: "@annabelfilippini",
  instagramUrl: "https://www.instagram.com/annabelfilippini",
  location: "Los Angeles, CA",
  mediaItems: [
    {
      id: "amber-reference-trench",
      kind: "photo",
      source: "/amber-reference-trench.png",
      title: "Trench outfit reference",
    },
    {
      id: "amber-reference-brown-door",
      kind: "photo",
      source: "/amber-reference-brown-door.png",
      title: "Brown door outfit reference",
    },
    {
      id: "amber-reference-black-clean",
      kind: "photo",
      source: "/amber-reference-black-clean.png",
      title: "Black outfit reference",
    },
    {
      id: "amber-reference-street-clean",
      kind: "photo",
      source: "/amber-reference-street-clean.png",
      title: "Street outfit reference",
    },
  ],
  name: "Annabel Filippini",
  oneToOneReason:
    "A private call makes the advice specific. Instead of guessing from a post, someone can bring the real question, context, budget, closet, room, cart, or schedule and leave with a sharper next step.",
  offer: "Choose a Time",
  phone: "+1 555 010 0147",
  profileImagePositionX: 50,
  profileImagePositionY: 50,
  profileImageZoom: 135,
  profileDetails:
    "This is a mock accepted creator profile for Annabel. It should demonstrate the editable profile fields that future accepted creators use after claiming their invite.",
  profileIntro:
    "Use this creator editor to tune how a Take a Seat profile explains the person, the offer, the one-to-one value, and the paid seat options.",
  seat15Description:
    "A quick working session for one focused question, one profile section, or one price/package decision.",
  seat15DurationMinutes: 15,
  seat15Enabled: true,
  seat15PriceAmount: 45,
  seat30Description:
    "A fuller profile review with room to refine the offer, edit the about copy, and check how the booking page will feel.",
  seat30DurationMinutes: 30,
  seat30Enabled: true,
  seat30PriceAmount: 80,
  stripeConnectedAt: null,
  tiktokHandle: "",
  tiktokUrl: "",
  timezone: "America/Los_Angeles",
};

export function getEditableCreatorProfile(
  profile: CreatorOnboardingProfile,
): EditableCreatorProfile {
  return {
    about: profile.about || profile.profileDetails || profile.bio,
    bio: profile.bio,
    calendarConnectedAt: profile.calendarConnectedAt,
    category: profile.category,
    currency: profile.currency,
    email: profile.email,
    helpItems: profile.helpItems,
    id: profile.id,
    image: profile.profileImageUrl || "/amber-headshot.jpg",
    instagramHandle: profile.instagramHandle,
    instagramUrl: getSocialUrl(profile.instagramHandle, "instagram"),
    location: profile.location,
    mediaItems: getEditableCreatorMediaItems(profile),
    name: profile.name,
    oneToOneReason: profile.oneToOneReason,
    offer: profile.offer,
    phone: profile.phone,
    profileImagePositionX: 50,
    profileImagePositionY: 50,
    profileImageZoom: 135,
    profileDetails: profile.profileDetails,
    profileIntro: profile.profileIntro,
    seat15Description: profile.seat15Description,
    seat15DurationMinutes: profile.seat15DurationMinutes,
    seat15Enabled: profile.seat15Enabled,
    seat15PriceAmount: getEditablePriceAmount(profile.seat15PriceAmount),
    seat30Description: profile.seat30Description,
    seat30DurationMinutes: profile.seat30DurationMinutes,
    seat30Enabled: profile.seat30Enabled,
    seat30PriceAmount: getEditablePriceAmount(profile.seat30PriceAmount),
    stripeConnectedAt: profile.stripeConnectedAt,
    tiktokHandle: profile.tiktokHandle,
    tiktokUrl: getSocialUrl(profile.tiktokHandle, "tiktok"),
    timezone: profile.timezone,
  };
}

function getEditableCreatorMediaItems(profile: CreatorOnboardingProfile) {
  const sources = profile.profileGallery
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sources.length && profile.profileImageUrl) {
    sources.push(profile.profileImageUrl);
  }

  return sources.map((source, index) => ({
    id: `${profile.id}-media-${index + 1}`,
    kind: isVideoSource(source) ? ("video" as const) : ("photo" as const),
    source,
    title: `${profile.name} media ${index + 1}`,
  }));
}

function getEditablePriceAmount(value: number | null) {
  let amount = Number(value ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  while (amount > 10000) {
    amount /= 100;
  }

  return Number((amount / 100).toFixed(2));
}

function isVideoSource(source: string) {
  return /(?:tiktok\.com|youtube\.com|youtu\.be|vimeo\.com|\.mp4(?:\?|$)|^data:video\/)/i.test(
    source,
  );
}

function getSocialUrl(value: string | null, network: "instagram" | "tiktok") {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const cleanHandle = trimmed.replace(/^@/, "");

  if (!cleanHandle) {
    return "";
  }

  return network === "instagram"
    ? `https://www.instagram.com/${cleanHandle}`
    : `https://www.tiktok.com/@${cleanHandle}`;
}
