"use client";

import { CreatorMediaGallery } from "./CreatorMediaGallery";
import { CreatorSeatHowItWorks } from "./CreatorSeatHowItWorks";
import type { EditableCreatorProfile } from "../admin/creator-profile-editor-preview/creator-profile-editor-data";

export function CreatorSetupPagePreview({ profile, compact = false }: { profile: EditableCreatorProfile; compact?: boolean }) {
  const media = profile.mediaItems.length ? profile.mediaItems : profile.image ? [{ id: "profile-photo", source: profile.image, title: `${profile.name} profile`, kind: "photo" as const }] : [];
  const calls = [
    { enabled: profile.seat15Enabled, duration: profile.seat15DurationMinutes, price: profile.seat15PriceAmount },
    { enabled: profile.seat30Enabled, duration: profile.seat30DurationMinutes, price: profile.seat30PriceAmount },
  ].filter((call) => call.enabled);
  return (
    <div className={`creator-profile-template creator-draft-preview${compact ? " is-compact" : ""}`}>
      <section className="amber-profile-hero">
        <div className="amber-hero-copy">
          <span className="test-profile-badge">Take a seat with</span>
          <h2 className="creator-preview-name">{profile.name || "Your name"}</h2>
          <p className="amber-meta">{profile.instagramHandle || profile.tiktokHandle}{profile.location ? ` · ${profile.location}` : ""}</p>
          <div className="help-card creator-conversation-topics"><h2>Pull up a seat for…</h2>
            {profile.helpItems.trim() ? <ul>{profile.helpItems.split("\n").filter((line) => line.trim()).map((line, index) => <li key={index}>{line}</li>)}</ul> : <p>Your conversation topics will appear here.</p>}
          </div>
        </div>
        {media.length ? <CreatorMediaGallery items={media} name={profile.name} showCaptions={false} /> : <div className="creator-gallery-empty"><h2>Your photos go here</h2><p>Add photos to introduce yourself.</p></div>}
      </section>
      <section className="amber-about-section">
        <div className="about-main"><h2>A little about me</h2>{profile.about.trim() ? profile.about.split(/\n+/).map((line, index) => <p key={index}>{line}</p>) : <p>Your introduction will appear here.</p>}</div>
        <aside className="reserve-panel"><h2>Schedule a time to meet</h2><p>Private video call on Google Meet.</p>
          <div className="creator-preview-calls">{calls.length ? calls.map((call, index) => <div key={index}><strong>{call.duration} minutes</strong><span>{Number(call.price) > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: profile.currency }).format(Number(call.price)) : "Add a price"} {profile.currency}</span></div>) : <p>Your call lengths and prices will appear here.</p>}</div>
          <p className="reserve-note">You won&apos;t be charged unless the creator accepts your appointment.</p>
        </aside>
      </section>
      <CreatorSeatHowItWorks />
    </div>
  );
}
