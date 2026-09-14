/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import type { Metadata } from "next";
import { getCreatorById } from "../../_lib/creators";
import { getPublishedCreatorBySlug } from "../../_lib/creator-onboarding";
import {
  getProfileImageObjectPosition,
  getProfileImageTransform,
} from "../../_lib/profile-image";
import { CustomerBookingFlow } from "../../_components/CustomerBookingFlow";
import { BookingEntryLink } from "../../_components/BookingEntryLink";
import { EllaGallery } from "./EllaGallery";

export const metadata: Metadata = {
  title: "Take a Seat with Ella McLane",
  description:
    "Book Ella McLane for a private college lifestyle, outfit, and shopping advice seat.",
};

export const dynamic = "force-dynamic";

const helpItems = [
  "Choose what to wear for a night out, trip, class, or event.",
  "Put together the clothes you already own.",
  "See what will actually look good together.",
  "Style the pieces you own but do not know how to wear together.",
  "Pick the best Nuuly pieces for your month.",
  "Turn a shopping session into a productive, useful cart.",
  "Pack looks for a weekend or vacation without overthinking every option.",
];

function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" />
      <circle cx="12" cy="12" r="4.1" />
      <path d="M17.35 6.7h.01" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M14.2 3v11.25a4.25 4.25 0 1 1-4.25-4.25c.42 0 .84.06 1.22.18v3.05a1.48 1.48 0 1 0 1.02 1.42V3h2.01Z" />
      <path d="M14.2 3c.48 2.92 2.12 4.7 5.05 5.12v3.05c-1.98-.08-3.68-.72-5.05-1.9" />
    </svg>
  );
}

const fallbackIntro =
  "Ella McLane has a timeless, classy approach to fashion. Her outfits are curated to give an old-money feel, with pieces that look thought out and intentional.";
const fallbackAbout = [
  "Ella has a strong eye for making everyday pieces feel elevated, classic, and put-together. Her style leans polished and old-money, but never feels overdone.",
  "Across TikTok, Instagram, and her curated shopping links, she mixes classic wardrobe staples with pretty, current finds so outfits feel like the perfect balance between classy and trendy.",
  "A one-on-one with Ella is helpful because she can style the clothes you already own but do not know how to put together. A lot of the time, you have the clothes, you just need someone with a sharp eye to show you what works together. Ella can help with that.",
  "If you need new clothes, book Ella for a productive shopping session. Do you do Nuuly? Ella can help you pick out the best pieces for your month.",
];

type EllaProfileProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function EllaProfile({ searchParams }: EllaProfileProps) {
  const publishedCreator = await getPublishedEllaCreator();
  const creator = publishedCreator ?? getCreatorById("ella");

  if (!creator) {
    return null;
  }

  const profile = creator.profile;
  const intro = profile?.intro ?? fallbackIntro;
  const about = profile ? profile.about : fallbackAbout;
  const profileHelpItems = profile ? profile.helpItems : helpItems;
  const firstName = creator.name.split(/\s+/u)[0] || "Ella";
  const whyTitle = profile?.whyTitle ?? "Why a 1:1 call?";
  const whyBody =
    profile?.whyBody ??
    "Ella's strength is making your clothes feel easier to use. Use the call to put outfits together from what you already own, choose better pieces for your month, or make a shopping cart feel more intentional before you buy.";
  const bookingNotice = getBookingNotice(searchParams);

  return (
    <main className="platform-shell amber-profile-page">
      <div className="profile-announcement">
        {profile?.announcement ?? "Profile preview for Ella's first Take a Seat mockup"}
      </div>
      <header className="topbar profile-topbar">
        <a className="brand-mark" href="/" aria-label="Take a Seat home">
          Take a Seat
        </a>
        <nav className="profile-nav" aria-label={`${creator.name} profile navigation`}>
          {creator.instagramUrl ? (
            <a href={creator.instagramUrl}>
              {creator.instagramHandle ?? creator.name}
            </a>
          ) : null}
          <form action="/sign-in" className="nav-action-form" method="get">
            <button className="profile-sign-in-link" type="submit">
              Sign In
            </button>
          </form>
        </nav>
      </header>

      <section className="amber-profile-hero">
        <div className="amber-hero-copy">
          <span className="creator-headshot-frame">
            {creator.image ? (
            <img
              alt={creator.name}
              src={creator.image}
              style={{
                objectPosition: getProfileImageObjectPosition(creator),
                transform: getProfileImageTransform(creator),
              }}
            />
            ) : null}
          </span>
          <h1>{creator.name}</h1>
          <p className="amber-meta">
            {creator.instagramUrl ? (
              <a
                aria-label={`Open ${creator.name} on Instagram`}
                className="profile-social-link"
                href={creator.instagramUrl}
              >
                <InstagramIcon />
              </a>
            ) : null}
            {creator.tiktokUrl ? (
              <a
                aria-label={`Open ${creator.name} on TikTok`}
                className="profile-social-link"
                href={creator.tiktokUrl}
              >
                <TikTokIcon />
              </a>
            ) : null}
          </p>
          <p>{intro}</p>
          <BookingEntryLink seats={creator.seats} />
        </div>

        <EllaGallery items={publishedCreator ? creator.mediaItems ?? [] : creator.mediaItems?.length ? creator.mediaItems : undefined} />
      </section>

      <section className="amber-about-section" id="about">
        <div className="about-main">
          <h2>About</h2>
          {about.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <div className="help-card">
            <h3>
              {firstName} <span>can help with</span>
            </h3>
            <ul>
              {profileHelpItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="why-card">
            <h3>{whyTitle}</h3>
            <p>{whyBody}</p>
          </div>
        </div>

        <aside className="reserve-panel" id="reserve" aria-label="Reserve a seat with Ella">
          <h2>Choose a call</h2>
          <p>Private video call on Google Meet.</p>
          {bookingNotice ? (
            <p className="booking-notice booking-status-notice">
              {bookingNotice}
            </p>
          ) : null}
          <CustomerBookingFlow
            availabilityRules={creator.availabilityRules}
            creatorId={creator.id}
            creatorName={creator.name}
            returnTo={`/with/${creator.slug}`}
            seats={creator.seats}
          />
          <p className="reserve-note">
            You won&apos;t be charged unless Ella accepts your appointment.
          </p>
        </aside>
      </section>
    </main>
  );
}

async function getPublishedEllaCreator() {
  try {
    return await getPublishedCreatorBySlug("ella");
  } catch {
    return null;
  }
}

function getBookingNotice(
  searchParams: EllaProfileProps["searchParams"],
) {
  const status = getSingleSearchParam(searchParams?.booking);
  const detail = getSingleSearchParam(searchParams?.detail);

  if (!status) {
    return null;
  }

  if (status === "setup-needed") {
    return getSetupNeededBookingMessage(detail);
  }

  if (status === "error") {
    return "Payment could not start. Check the booking details and try again.";
  }

  if (status === "cancelled") {
    return "Payment was cancelled. You can choose another time when you are ready.";
  }

  if (status === "authorized") {
    return "Your payment information was received. You won't be charged unless Ella accepts your appointment.";
  }

  if (status === "requested") {
    return "Your request was sent. You won't be charged unless Ella accepts your appointment.";
  }

  return null;
}

function getSetupNeededBookingMessage(detail: string | null) {
  switch (detail) {
    case "stripe-secret":
      return "Stripe is not connected yet, so payment cannot start.";
    case "stripe-price":
      return "This seat needs a Stripe price before payment can start.";
    case "platform-fee":
      return "The platform fee setting is missing before payment can start.";
    case "stripe-connect":
      return "This creator needs Stripe Connect before payment can start.";
    case "stripe-onboarding":
      return "This creator needs to finish Stripe onboarding before payment can start.";
    case "stripe-transfers":
      return "Stripe transfers are not active for this creator yet.";
    case "d1":
      return "The booking database is not available yet.";
    default:
      return "Stripe setup is not complete yet, so payment cannot start.";
  }
}

function getSingleSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}
