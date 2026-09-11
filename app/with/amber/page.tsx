/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import type { Metadata } from "next";
import { AmberGallery } from "./AmberGallery";

export const metadata: Metadata = {
  title: "Take a Seat with Amber May Lowe",
  description:
    "Book Amber May Lowe for a private capsule wardrobe and slow fashion style seat.",
};

const helpItems = [
  "Decide if a piece is worth buying.",
  "Find the basic your capsule wardrobe is missing.",
  "Choose between two versions of the same thing.",
  "Use what you already own before adding more.",
  "Talk through an outfit for work, travel, dinner, or an event.",
  "Notice what you keep buying because the real gap is unclear.",
];

const seats = [
  {
    name: "15 minutes",
    price: "£45",
    format: "Private video call",
    host: "Amber Lowe",
    description:
      "A quick second opinion before you spend on one piece, one gap, or one almost-right outfit.",
  },
  {
    name: "30 minutes",
    price: "£80",
    format: "Private video call",
    host: "Amber Lowe",
    description:
      "More room to talk through a capsule gap, a few open tabs, or an outfit you want to get right.",
  },
];

export default function AmberProfile() {
  return (
    <main className="platform-shell amber-profile-page">
      <div className="profile-announcement">
        Four private seats open with Amber this month
      </div>
      <header className="topbar profile-topbar">
        <a className="brand-mark" href="/" aria-label="Take a Seat home">
          Take a Seat
        </a>
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
        </div>

        <AmberGallery />
      </section>

      <section className="amber-about-section" id="about">
        <div className="about-main">
          <h2>About</h2>
          <p>
            Amber knows capsule wardrobes. Her feed moves between warm neutrals,
            useful basics, denim, linen, and black tailoring.
          </p>
          <p>
            She knows how to style classics in a way that gives you a wardrobe
            you can keep and wear for years.
          </p>
          <p>
            If you have a question for Amber, bring it to the call. It can be an
            outfit you need help with, a piece you are trying to style, or the
            next thing you are thinking about ordering. Choose 15 or 30 minutes
            and get her full attention.
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
              Sometimes you do not need a moodboard. You need someone with
              taste you trust to look at the real options in front of you and
              help you choose the next move.
            </p>
          </div>
        </div>

        <aside className="reserve-panel" id="reserve" aria-label="Reserve a seat with Amber">
          <h2>Choose a call</h2>
          <p>Private video call on Google Meet.</p>
          <div className="seat-options">
            {seats.map((seat) => (
              <article className="seat-option" key={seat.name}>
                <div className="seat-option-heading">
                  <h3>{seat.name}</h3>
                  <span>{seat.format}</span>
                </div>
                <dl className="seat-detail-list">
                  <div>
                    <dt>Host</dt>
                    <dd>{seat.host}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{seat.name}</dd>
                  </div>
                  <div>
                    <dt>Price</dt>
                    <dd>{seat.price}</dd>
                  </div>
                </dl>
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
