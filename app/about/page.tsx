import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../_components/PageHeader";

/* eslint-disable @next/next/no-img-element */

export const metadata: Metadata = {
  title: "Our Mission | Take a Seat",
  description:
    "Take a Seat is your big older sister for getting dressed: private style advice from creators whose taste you already trust.",
};

const missionBelievers = [
  {
    image: "/ella-profile.jpg",
    name: "Ella McLane",
    role: "Outfits, shopping carts, and vacation packing",
    position: "50% 50%",
  },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <PageHeader ctaLabel="Find a Seat" navLabel="Mission page navigation" />

      <section className="about-mission" aria-labelledby="mission-heading">
        <span>Our mission</span>
        <h1 id="mission-heading">
          Take a Seat is your big older sister for getting dressed.
        </h1>
        <p>
          For the nights out, vacations, Nuuly carts, closet spirals, and
          last-minute &quot;is this cute?&quot; moments, book a private seat with
          someone whose taste you already trust.
        </p>
      </section>

      <section className="about-believers" aria-labelledby="believers-heading">
        <div className="about-section-heading">
          <h2 id="believers-heading">First seats</h2>
          <p>
            Start with the girls whose outfits you already save and send to
            your friends.
          </p>
        </div>
        <div className="about-believer-grid">
          {missionBelievers.map((item) => (
            <article className="about-believer-card" key={item.name}>
              <img
                alt=""
                src={item.image}
                style={{ objectPosition: item.position }}
              />
              <strong>{item.name}</strong>
              <span>{item.role}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="about-story" aria-labelledby="story-heading">
        <div className="about-story-heading">
          <h2 id="story-heading">Why we exist</h2>
        </div>
        <div className="about-story-copy">
          <article>
            <h3>The question was already there.</h3>
            <p>
              People already ask creators what to wear, what to buy, what to
              pack, and whether the thing sitting in their cart is actually
              worth it. The useful answer needs context: your closet, your
              plans, your budget, and the exact vibe you are trying to get
              right.
            </p>
          </article>
          <article>
            <h3>A comment thread cannot see the outfit.</h3>
            <p>
              A private seat lets you show the dress, the screenshots, the
              suitcase, the pieces you own but never wear together, or the
              vacation board that somehow became twenty different aesthetics.
              The creator brings the eye you came for. Take a Seat keeps the
              booking details out of the way.
            </p>
          </article>
          <article>
            <h3>Confidence is the whole point.</h3>
            <p>
              We are not here to make everyone dress the same. We are here for
              the moment when you want to feel cute, but your brain has fully
              left the chat. One good seat should feel like an older-sister
              second opinion: honest, specific, and immediately useful.
            </p>
          </article>
        </div>
      </section>

      <section className="about-final-cta" aria-label="Start with Take a Seat">
        <h2>Bring the outfit. Leave feeling cute.</h2>
        <div className="about-cta-actions">
          <Link href="/#browse">Find a Seat</Link>
          <Link href="/creators/onboard">Apply to Inspire</Link>
        </div>
      </section>
    </main>
  );
}
