"use client";

/* eslint-disable @next/next/no-img-element */
import { useId, useState } from "react";
import { CreatorDirectory } from "./CreatorDirectory";

export function BookingPlatform() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navId = useId();

  return (
    <main className="platform-shell">
      <header className={`topbar home-topbar${isMobileMenuOpen ? " mobile-nav-open" : ""}`}>
        <form action="/take-a-seat" className="nav-action-form" method="get">
          <button className="brand-mark home-hero-brand" type="submit" aria-label="Take a Seat creators">
            Take a Seat
          </button>
        </form>
        <div className="home-mobile-actions">
          <form action="/take-a-seat" className="nav-action-form" method="get">
            <button className="hero-search-control hero-search-link" type="submit" aria-label="Search creators">
              <span>Search creators</span>
            </button>
          </form>
          <button
            aria-controls={navId}
            aria-expanded={isMobileMenuOpen}
            aria-label="Open navigation"
            className="mobile-nav-toggle"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            type="button"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
        <nav className="topnav" id={navId} aria-label="Primary navigation">
          <form action="/creators/onboard" className="nav-action-form" method="get">
            <button type="submit">Apply to Inspire</button>
          </form>
          <form action="/about" className="nav-action-form" method="get">
            <button type="submit">Our Mission</button>
          </form>
          <form action="/take-a-seat" className="nav-action-form home-desktop-search-action" method="get">
            <button className="hero-search-control hero-search-link" type="submit" aria-label="Search creators">
              <span>Search creators</span>
            </button>
          </form>
          <form action="/sign-in" className="nav-action-form" method="get">
            <button className="topnav-sign-in-button" type="submit">
              Sign In
            </button>
          </form>
        </nav>
      </header>

      <section className="hero" id="top">
        <img
          alt="A person applying makeup at a bathroom vanity with a towel wrapped around their hair"
          className="hero-image"
          src="/home-vanity-hero.png"
        />
        <div className="hero-copy">
          <h1>Meet Your Personal Styling Committee</h1>
          <form action="/take-a-seat" className="nav-action-form" method="get">
            <button className="hero-cta" type="submit">
              Take a Seat
            </button>
          </form>
        </div>
      </section>

      <div className="below-hero-bar home-intro-bar">
        <form action="/take-a-seat" className="nav-action-form" method="get">
          <button className="below-hero-brand" type="submit" aria-label="Take a Seat creators">
            Take a Seat
          </button>
        </form>
      </div>

      <CreatorDirectory />

      <section className="creator-invite" id="creators">
        <form action="/creators/onboard" className="nav-action-form" method="get">
          <button type="submit">
            Apply to Inspire
          </button>
        </form>
        <form action="/take-a-seat" className="nav-action-form" method="get">
          <button className="creator-onboarding-link" type="submit">
            Take a Seat
          </button>
        </form>
      </section>
    </main>
  );
}
