/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Take a Seat with Amber May Lowe",
  description:
    "Book Amber May Lowe for a private capsule wardrobe and slow fashion style seat.",
};

const helpItems = [
  "Deciding if a piece is actually worth buying.",
  "Finding the missing basic in a small capsule wardrobe.",
  "Choosing between two versions of the same thing.",
  "Using what you already own before adding more.",
  "Talking through an outfit for work, travel, dinner, or an event.",
  "Spotting the thing you keep buying because the real gap is unclear.",
];

const seats = [
  {
    name: "Buy It Once",
    price: "£45",
    length: "15 minutes with Amber Lowe",
    description:
      "A practical second opinion before you spend on one piece, one gap, or one almost-right outfit.",
  },
  {
    name: "Wardrobe Pass",
    price: "£80",
    length: "30 minutes with Amber Lowe",
    description:
      "More room to talk through a capsule gap, a few open tabs, or an outfit you want to get right.",
  },
];

export default function AmberProfile() {
  return (
    <main className="platform-shell amber-profile-page">
      <header className="topbar profile-topbar">
        <Link className="brand-mark" href="/" aria-label="Take a Seat home">
          Take a Seat
        </Link>
        <nav className="profile-nav" aria-label="Amber profile navigation">
          <a href="https://www.instagram.com/ambermaylowe/">@ambermaylowe</a>
          <a className="reserve-nav-button" href="#reserve">
            Reserve your seat
          </a>
        </nav>
      </header>

      <section className="amber-profile-hero">
        <div className="amber-hero-copy">
          <img
            alt="Amber May Lowe headshot"
            className="amber-headshot"
            src="/amber-headshot.jpg"
          />
          <h1>Amber May Lowe</h1>
          <p className="amber-meta">
            <span>Birmingham, UK</span>
            <span>@ambermaylowe</span>
          </p>
          <p>
            A short private call for the thing sitting in your basket, the gap
            in your capsule, or the outfit you keep nearly getting right.
          </p>
          <p>
            Bring the links, the photos, or the wardrobe question. Amber will
            help you decide what actually earns a place.
          </p>
          <a className="profile-primary-button" href="#reserve">
            Reserve your seat
          </a>
        </div>

        <div className="amber-hero-gallery" aria-label="Amber's capsule wardrobe style">
          <span className="amber-gallery-frame">
            <img
              alt="Amber May Lowe in a chocolate brown capsule outfit"
              src="/amber-style.jpg"
            />
          </span>
          <span className="amber-gallery-frame">
            <img
              alt="Amber May Lowe wearing black tailoring against a wood door"
              src="/amber-card.png"
            />
          </span>
        </div>
      </section>

      <section className="amber-about-section" id="about">
        <div className="about-main">
          <h2>About</h2>
          <p>
            Amber has a calm way of making clothes feel simpler. Her feed is
            all warm neutrals, useful basics, denim, linen, black tailoring, and
            the pieces you actually reach for after the package arrives.
          </p>
          <p>
            This is not a full styling session. It is a private fifteen minutes
            for one decision: buy it, skip it, wait, or look for something
            better. The point is to leave the call with less noise and a cleaner
            next move.
          </p>

          <div className="help-card">
            <h3>
              Amber <span>can help with</span>
            </h3>
            <ul>
              {helpItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="why-card">
            <h3>Why a 1:1 call?</h3>
            <p>
              Sometimes you do not need a moodboard. You need someone whose
              taste you trust to look at the real options in front of you and
              help you choose the simplest next move.
            </p>
          </div>
        </div>

        <aside className="reserve-panel" id="reserve" aria-label="Reserve a seat with Amber">
          <h2>Choose a call</h2>
          <p>Private video call on Google Meet.</p>
          <div className="seat-options">
            {seats.map((seat) => (
              <article className="seat-option" key={seat.name}>
                <div>
                  <h3>{seat.name}</h3>
                  <strong>{seat.price}</strong>
                </div>
                <span>{seat.length}</span>
                <p>{seat.description}</p>
              </article>
            ))}
          </div>
          <a
            className="profile-primary-button"
            href="mailto:annabel@takeaseatwith.com?subject=Request%20Amber%20May%20Lowe%20seat"
          >
            Show availability
          </a>
          <p className="reserve-note">
            Amber reviews every request before you are charged. Free
            cancellation up to 24 hours before.
          </p>
        </aside>
      </section>
    </main>
  );
}
