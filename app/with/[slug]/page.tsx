/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorMediaGallery } from "../../_components/CreatorMediaGallery";
import { CreatorSeatHowItWorks } from "../../_components/CreatorSeatHowItWorks";
import { creators } from "../../_lib/creators";
import { getPublicCreatorBySlug } from "../../_lib/creator-onboarding";
import {
  getProfileImageObjectPosition,
  getProfileImageTransform,
} from "../../_lib/profile-image";
import { CustomerBookingFlow } from "../../_components/CustomerBookingFlow";

type CreatorProfilePageProps = {
  params: {
    slug: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

export const dynamic = "force-dynamic";

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

export function generateStaticParams() {
  return creators
    .filter((creator) => Boolean(creator.profile))
    .map((creator) => ({ slug: creator.slug }));
}

export async function generateMetadata({
  params,
}: CreatorProfilePageProps): Promise<Metadata> {
  const creator = await getPublicCreatorBySlug(params.slug);

  if (!creator?.profile) {
    return {
      title: "Creator profile | Take a Seat",
    };
  }

  return {
    title: `Take a Seat with ${creator.name}`,
    description: creator.profile.about[0]?.slice(0, 160) ?? creator.title,
  };
}

export default async function CreatorProfilePage({
  params,
  searchParams,
}: CreatorProfilePageProps) {
  const creator = await getPublicCreatorBySlug(params.slug);
  const profile = creator?.profile;

  if (!creator || !profile) {
    notFound();
  }

  const socialLabel = creator.tiktokHandle ?? creator.instagramHandle ?? creator.name;
  const waitlistHref = `mailto:annabel@takeaseatwith.com?subject=${encodeURIComponent(
    profile.waitlistSubject,
  )}`;
  const isBookable = creator.status === "booking" && creator.seats.length > 0;
  const bookingNotice = getBookingNotice(searchParams, creator.name);

  return (
    <main className="platform-shell amber-profile-page creator-profile-template">
      <div className="profile-announcement">{profile.announcement}</div>
      <header className="topbar profile-topbar">
        <a className="brand-mark" href="/" aria-label="Take a Seat home">
          Take a Seat
        </a>
        <nav className="profile-nav" aria-label={`${creator.name} profile navigation`}>
          {creator.tiktokUrl ? <a href={creator.tiktokUrl}>{creator.tiktokHandle}</a> : null}
          <form action="/sign-in" className="nav-action-form" method="get">
            <button className="profile-sign-in-link" type="submit">
              Sign In
            </button>
          </form>
        </nav>
      </header>

      <section className="amber-profile-hero">
        <div className="amber-hero-copy">
          <span className="test-profile-badge">
            {isBookable ? "Now booking" : "Opening soon"}
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
            <span>{socialLabel}</span>
            {creator.location ? <span>{creator.location}</span> : null}
          </p>
          {profile.helpItems.length ? (
            <div className="help-card creator-conversation-topics">
              <h2>Pull up a seat for…</h2>
              <ul>
                {profile.helpItems.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {creator.mediaItems?.length ? (
          <CreatorMediaGallery items={creator.mediaItems} name={creator.name} showCaptions={false} />
        ) : (
          <div
            className={`test-profile-preview profile-concept-preview profile-${creator.accent}${
              creator.image ? " profile-concept-preview-image" : ""
            }`}
            aria-label={`${creator.name} profile preview`}
          >
            {creator.image ? (
              <img
                alt={`${creator.name} profile`}
                src={creator.image}
                style={{
                  objectPosition: getProfileImageObjectPosition(creator),
                  transform: getProfileImageTransform(creator),
                }}
              />
            ) : null}
            <span>{creator.category}</span>
            <strong>{creator.offer}</strong>
            <p>{creator.title}</p>
          </div>
        )}
      </section>

      <section className="amber-about-section" id="about">
        <div className="about-main">
          <h2>A little about me</h2>
          {profile.about.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

        </div>

        <aside className="reserve-panel" id="reserve" aria-label={`Reserve with ${creator.name}`}>
          {isBookable ? (
            <>
              <h2>Schedule a time to meet</h2>
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
                showDescriptions={false}
              />
              <p className="reserve-note">
                You won&apos;t be charged unless the creator accepts your
                appointment.
              </p>
            </>
          ) : (
            <>
              <h2>Opening soon</h2>
              <p>
                This creator is a candidate profile. Pricing, availability, and
                booking links can be added after onboarding.
              </p>
              <div className="booking-notice">
                <strong>{creator.offer}</strong>
                <p>{creator.note}</p>
              </div>
              <a className="seat-primary-button" href={waitlistHref}>
                Request invite
              </a>
              <p className="reserve-note">
                No payment is collected from concept profiles.
              </p>
            </>
          )}
        </aside>
      </section>
      <CreatorSeatHowItWorks />
    </main>
  );
}

function getBookingNotice(
  searchParams: CreatorProfilePageProps["searchParams"],
  creatorName: string,
) {
  const status = getSingleSearchParam(searchParams?.booking);
  const detail = getSingleSearchParam(searchParams?.detail);
  const firstName = creatorName.split(/\s+/u)[0] || creatorName;

  if (!status) {
    return null;
  }

  if (status === "requested") {
    return `Your request was sent. You won't be charged unless ${firstName} accepts your appointment.`;
  }

  if (status === "authorized") {
    return `Your payment information was received. You won't be charged unless ${firstName} accepts your appointment.`;
  }

  if (status === "setup-needed") {
    return "Booking setup is not finished yet, so payment cannot start.";
  }

  if (status === "error" && detail === "booking-details") {
    return "The request needs a valid time and email address.";
  }

  if (status === "error") {
    return "The request could not be sent. Check the details and try again.";
  }

  if (status === "cancelled") {
    return "Payment was cancelled. You can choose another time when you are ready.";
  }

  return null;
}

function getSingleSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
