"use client";

/* eslint-disable @next/next/no-img-element */
import { CreatorMediaGallery } from "./CreatorMediaGallery";
import { getProfileImageObjectPosition, getProfileImageTransform } from "../_lib/profile-image";
import type { EditableCreatorProfile } from "../admin/creator-profile-editor-preview/creator-profile-editor-data";

export function CreatorSetupPagePreview({ profile }: { profile: EditableCreatorProfile }) {
  const firstName = profile.name.split(/\s+/u)[0] || "Creator";
  const calls = [
    { enabled: profile.seat15Enabled, duration: profile.seat15DurationMinutes, price: profile.seat15PriceAmount, description: profile.seat15Description },
    { enabled: profile.seat30Enabled, duration: profile.seat30DurationMinutes, price: profile.seat30PriceAmount, description: profile.seat30Description },
  ].filter((call) => call.enabled);
  return (
    <div className="creator-draft-preview ella-draft-preview">
      <section className="amber-profile-hero">
        <div className="amber-hero-copy">
          <span className="creator-headshot-frame">
            {profile.image ? <img alt={profile.name} src={profile.image} style={{ objectPosition: getProfileImageObjectPosition(profile), transform: getProfileImageTransform(profile) }} /> : null}
          </span>
          <h2 className="creator-preview-name">{profile.name || "Your name"}</h2>
          <p className="amber-meta">{profile.instagramHandle || profile.tiktokHandle}</p>
          <p>{profile.profileIntro}</p>
        </div>
        {profile.mediaItems.length ? <CreatorMediaGallery items={profile.mediaItems} name={profile.name} /> : (
          <div className="amber-hero-gallery editable-empty-gallery" aria-label="Empty photo gallery">
            <div className="amber-gallery-track"><span className="amber-gallery-frame" /><span className="amber-gallery-frame" /></div>
          </div>
        )}
      </section>
      <section className="amber-about-section">
        <div className="about-main">
          <h2>About</h2>
          {profile.about.split(/\n+/u).filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
          <div className="help-card">
            <h3>{firstName} <span>can help with</span></h3>
            <ul>{profile.helpItems.split(/\n+/u).filter((line) => line.trim()).map((line, index) => <li key={index}>{line}</li>)}</ul>
          </div>
          <div className="why-card"><h3>Why a 1:1 call?</h3><p>{profile.oneToOneReason}</p></div>
        </div>
        <aside className="reserve-panel">
          <h2>Choose a call</h2><p>Private video call on Google Meet.</p>
          <div className="seat-options">{calls.map((call, index) => (
            <article className="seat-option" key={index}>
              <div className="seat-option-heading"><strong>{call.duration} minutes</strong><strong>{Number(call.price) > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: profile.currency, maximumFractionDigits: 2 }).format(Number(call.price)) : ""}</strong></div>
              <p>{call.description}</p>
            </article>
          ))}</div>
          <button className="seat-primary-button editable-preview-booking-button" disabled type="button">Find availability</button>
          <p className="reserve-note">No account needed.</p>
          <p className="reserve-note">You won&apos;t be charged unless {firstName} accepts your appointment.</p>
        </aside>
      </section>
    </div>
  );
}
