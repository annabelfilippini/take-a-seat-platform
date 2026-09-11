/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import Link from "next/link";
import { BookingRequestFields } from "../../_components/BookingRequestForm";
import { getCreatorById } from "../../_lib/creators";

export const metadata: Metadata = {
  title: "Take a Seat with Annabel Filippini",
  description:
    "Test a private Take a Seat booking with Annabel Filippini.",
};

const helpItems = [
  "Check whether Google Calendar blocks busy time.",
  "Confirm Stripe Checkout starts correctly.",
  "See how 15 and 30 minute seats read to customers.",
  "Make sure the creator backend fields feel editable enough.",
];

export default function AnnabelProfile() {
  const creator = getCreatorById("annabel");

  if (!creator) {
    return null;
  }

  return (
    <main className="platform-shell amber-profile-page test-profile-page">
      <div className="profile-announcement">
        Founder test profile for booking flow QA
      </div>
      <header className="topbar profile-topbar">
        <a className="brand-mark" href="/" aria-label="Take a Seat home">
          Take a Seat
        </a>
        <nav className="profile-nav" aria-label="Annabel profile navigation">
          <Link href="/creators/onboard">Sign up</Link>
          <a className="reserve-nav-button" href="#reserve">
            Test booking
          </a>
          <Link className="profile-sign-in-link" href="/sign-in">
            Sign In
          </Link>
        </nav>
      </header>

      <section className="amber-profile-hero">
        <div className="amber-hero-copy">
          <span className="test-profile-badge">Test creator</span>
          <h1>{creator.name}</h1>
          <p className="amber-meta">
            <span>{creator.location}</span>
            <span>{creator.instagramHandle}</span>
          </p>
          <p>
            A private test profile for proving the booking path before creators
            use it.
          </p>
          <p>
            Use this section to connect Annabel&apos;s calendar, attach Stripe
            payouts, create test prices, and run a low-stakes booking through
            Checkout.
          </p>
          <a className="profile-primary-button" href="#reserve">
            Test a seat
          </a>
        </div>

        <div className="test-profile-preview" aria-label="Annabel test profile preview">
          <span>Annabel Filippini</span>
          <strong>Calendar + checkout test</strong>
          <p>15 and 30 minute private video calls</p>
        </div>
      </section>

      <section className="amber-about-section" id="about">
        <div className="about-main">
          <h2>About</h2>
          <p>
            This is the internal Take a Seat test creator. The goal is to make
            sure one real person can connect Google Calendar, set availability,
            connect Stripe, and see whether the public booking flow feels clear.
          </p>
          <p>
            For invited creators like Ella, the same fields become their public
            about section, helper list, seat descriptions, pricing, and weekly
            availability.
          </p>

          <div className="help-card">
            <h3>
              Annabel <span>can test</span>
            </h3>
            <ul>
              {helpItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="reserve-panel" id="reserve" aria-label="Test a booking with Annabel">
          <h2>Choose a test call</h2>
          <p>Private video call on Google Meet.</p>
          <div className="seat-options">
            {creator.seats.map((seat) => (
              <article className="seat-option" key={seat.id}>
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
                <form action="/api/stripe/checkout" method="post">
                  <input name="creatorId" type="hidden" value={creator.id} />
                  <input name="seatId" type="hidden" value={seat.id} />
                  <input name="returnTo" type="hidden" value="/with/annabel" />
                  <BookingRequestFields defaultTimezone="America/Los_Angeles" />
                  <button className="seat-primary-button" type="submit">
                    Pay and reserve test
                  </button>
                </form>
              </article>
            ))}
          </div>
          <p className="reserve-note">
            This test button starts Checkout after Stripe Price IDs and Annabel&apos;s
            connected account are configured.
          </p>
        </aside>
      </section>
    </main>
  );
}
