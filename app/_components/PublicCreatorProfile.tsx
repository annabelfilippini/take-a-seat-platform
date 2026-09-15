"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import { useRef } from "react";
import type {
  EditableCreatorMediaItem,
  EditableCreatorProfile,
} from "../admin/creator-profile-editor-preview/creator-profile-editor-data";
import {
  getProfileImageObjectPosition,
  getProfileImageTransform,
} from "../_lib/profile-image";

const tiktokPlayerOptions = [
  "autoplay=1",
  "muted=1",
  "loop=1",
  "controls=0",
  "play_button=0",
  "volume_control=0",
  "fullscreen_button=0",
  "progress_bar=0",
  "timestamp=0",
  "music_info=0",
  "description=0",
  "rel=0",
  "native_context_menu=0",
  "closed_caption=0",
].join("&");

export function PublicCreatorProfile({
  profile,
}: {
  profile: EditableCreatorProfile;
}) {
  const helpItems = splitProfileLines(profile.helpItems);
  const firstName = profile.name.split(/\s+/u)[0] || "Creator";
  const seats = [
    {
      description: profile.seat15Description,
      durationMinutes: profile.seat15DurationMinutes,
      enabled: profile.seat15Enabled,
      price: profile.seat15PriceAmount,
    },
    {
      description: profile.seat30Description,
      durationMinutes: profile.seat30DurationMinutes,
      enabled: profile.seat30Enabled,
      price: profile.seat30PriceAmount,
    },
  ].filter((seat) => seat.enabled);

  return (
    <main className="platform-shell amber-profile-page public-profile-page">
      <div className="profile-announcement">Now booking on Take a Seat</div>
      <header className="topbar profile-topbar">
        <a className="brand-mark" href="/" aria-label="Take a Seat home">
          Take a Seat
        </a>
        <nav className="profile-nav" aria-label={`${profile.name} profile navigation`}>
          <a href="/creators/onboard">Apply</a>
          <form action="/sign-in" className="nav-action-form" method="get">
            <button className="profile-sign-in-link" type="submit">
              Sign In
            </button>
          </form>
        </nav>
      </header>

      <section className="amber-profile-hero public-profile-hero" id="top">
        <div className="amber-hero-copy">
          <span className="editable-profile-photo-frame public-profile-photo-frame">
            {profile.image ? (
              <img
                alt={`${profile.name} profile`}
                src={profile.image}
                style={{
                  objectPosition: getProfileImageObjectPosition(profile),
                  transform: getProfileImageTransform(profile),
                }}
              />
            ) : (
              <b>{profile.name.slice(0, 2) || "TS"}</b>
            )}
          </span>
          <h1>{profile.name}</h1>
          <p className="amber-meta">
            <SocialProfileLink
              href={profile.instagramUrl}
              icon="instagram"
              label={`Open ${profile.name} on Instagram`}
            />
            <SocialProfileLink
              href={profile.tiktokUrl}
              icon="tiktok"
              label={`Open ${profile.name} on TikTok`}
            />
            {profile.location ? <span>{profile.location}</span> : null}
          </p>
          <p>{profile.profileIntro}</p>
        </div>

        <PublicMediaGallery items={profile.mediaItems} name={profile.name} />
      </section>

      <section className="amber-about-section" id="about">
        <div className="about-main">
          <h2>About</h2>
          {splitProfileParagraphs(profile.about).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          {helpItems.length ? (
            <div className="help-card">
              <h3>{firstName} can help with</h3>
              <ul>
                {helpItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="why-card">
            <h3>Why a 1:1 call?</h3>
            <p>{profile.oneToOneReason}</p>
          </div>
        </div>

        <aside className="reserve-panel" id="reserve" aria-label={`Book ${profile.name}`}>
          <h2>Choose a Time</h2>
          <p>Private video call on Google Meet.</p>
          <div className="seat-options">
            {seats.map((seat) => (
              <article className="seat-option" key={String(seat.durationMinutes)}>
                <div className="seat-option-heading">
                  <h3>{formatDurationLabel(seat.durationMinutes)}</h3>
                  <span>Private video call</span>
                </div>
                <dl className="seat-detail-list">
                  <div>
                    <dt>Host</dt>
                    <dd>{profile.name}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{formatDurationLabel(seat.durationMinutes)}</dd>
                  </div>
                  <div>
                    <dt>Price</dt>
                    <dd>{formatMoney(profile.currency, seat.price)}</dd>
                  </div>
                </dl>
                <p>{seat.description}</p>
                <button className="seat-primary-button" type="button">
                  Book this seat
                </button>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function PublicMediaGallery({
  items,
  name,
}: {
  items: EditableCreatorMediaItem[];
  name: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (!items.length) {
    return null;
  }

  function scrollGallery(direction: -1 | 1) {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const frame = track.querySelector(".amber-gallery-frame");
    const frameWidth = frame?.getBoundingClientRect().width ?? track.clientWidth;

    track.scrollBy({
      behavior: "smooth",
      left: direction * (frameWidth + 2),
    });
  }

  return (
    <div className="amber-hero-gallery" aria-label={`${name} photos and videos`}>
      <button
        aria-label="Show previous media"
        className="gallery-arrow gallery-arrow-prev"
        onClick={() => scrollGallery(-1)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M15 5 8 12l7 7" />
        </svg>
      </button>
      <div className="amber-gallery-track" ref={trackRef}>
        {items.map((item) => (
          <span className="amber-gallery-frame" key={item.id}>
            <MediaItem item={item} />
          </span>
        ))}
      </div>
      <button
        aria-label="Show next media"
        className="gallery-arrow gallery-arrow-next"
        onClick={() => scrollGallery(1)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

function MediaItem({ item }: { item: EditableCreatorMediaItem }) {
  if (item.kind === "video" && isTikTokVideoSource(item.source)) {
    return (
      <iframe
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        src={getVideoEmbedSource(item.source)}
        title={item.title}
      />
    );
  }

  if (item.kind === "video") {
    return (
      <video
        controls
        loop
        muted
        playsInline
        preload="metadata"
        src={item.source}
      />
    );
  }

  if (isSocialMediaUrl(item.source)) {
    return <SocialMediaFrame source={item.source} title={item.title} />;
  }

  return <img alt={item.title} src={item.source} />;
}

function SocialProfileLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: "instagram" | "tiktok";
  label: string;
}) {
  const normalizedHref = normalizeSocialUrlForHref(href);

  if (!normalizedHref) {
    return null;
  }

  return (
    <a aria-label={label} className="profile-social-link" href={normalizedHref}>
      {icon === "instagram" ? <InstagramIcon /> : <TikTokIcon />}
    </a>
  );
}

function SocialMediaFrame({
  source,
  title,
}: {
  source: string;
  title: string;
}) {
  const href = normalizeSocialUrlForHref(source);
  const network = isTikTokUrl(source) ? "TikTok" : "Instagram";

  return href ? (
    <a className="editable-social-media-frame" href={href}>
      {network === "Instagram" ? <InstagramIcon /> : <TikTokIcon />}
      <span>{network}</span>
      <strong>{title}</strong>
    </a>
  ) : (
    <span className="editable-media-empty">{title}</span>
  );
}

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

function formatDurationLabel(value: number | string) {
  const parsed = Number(String(value).trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Set time";
  }

  const minutes = Math.round(parsed);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function formatMoney(currency: string, amount: number | string) {
  const cleanAmount = String(amount).trim();
  const parsedAmount = Number(cleanAmount);

  if (!cleanAmount || !Number.isFinite(parsedAmount)) {
    return "Set price";
  }

  const symbol = currency.toUpperCase() === "USD" ? "$" : `${currency.toUpperCase()} `;
  return `${symbol}${parsedAmount}`;
}

function splitProfileParagraphs(value: string) {
  return splitProfileLines(value).length
    ? splitProfileLines(value)
    : ["Bring the real question and leave with a clearer next step."];
}

function splitProfileLines(value: string | null | undefined) {
  return (value ?? "")
    .split(/\n+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSocialUrlForHref(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );

    if (!isInstagramHost(url.hostname) && !isTikTokHost(url.hostname)) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function isSocialMediaUrl(source: string) {
  return isInstagramUrl(source) || isTikTokUrl(source);
}

function isInstagramUrl(source: string) {
  const href = normalizeSocialUrlForHref(source);

  if (!href) {
    return false;
  }

  return isInstagramHost(new URL(href).hostname);
}

function isTikTokUrl(source: string) {
  const href = normalizeSocialUrlForHref(source);

  if (!href) {
    return false;
  }

  return isTikTokHost(new URL(href).hostname);
}

function isInstagramHost(hostname: string) {
  return /(^|\.)instagram\.com$/i.test(hostname);
}

function isTikTokHost(hostname: string) {
  return /(^|\.)tiktok\.com$/i.test(hostname);
}

function isTikTokVideoSource(source: string) {
  return Boolean(getTikTokVideoId(source));
}

function getVideoEmbedSource(source: string) {
  const trimmed = source.trim();
  const id = getTikTokVideoId(trimmed);

  if (id) {
    return `https://www.tiktok.com/player/v1/${id}?${tiktokPlayerOptions}`;
  }

  return trimmed;
}

function getTikTokVideoId(source: string) {
  const trimmed = source.trim();
  const bareId = trimmed.match(/^(\d{10,})$/)?.[1];

  if (bareId) {
    return bareId;
  }

  try {
    const url = new URL(trimmed);

    if (!/(^|\.)tiktok\.com$/i.test(url.hostname)) {
      return null;
    }

    return url.pathname.match(/\/video\/(\d{10,})/)?.[1] ?? null;
  } catch {
    return null;
  }
}
