import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../_components/PageHeader";

/* eslint-disable @next/next/no-img-element */

export const metadata: Metadata = {
  title: "Our Mission | Take a Seat",
  description:
    "Take a Seat gives followers private Office Hours with creators whose taste and judgment they trust.",
};

const missionBelievers = [
  {
    image: "/ella-profile.jpg",
    name: "Ella McLane",
    role: "College style and shopping advice",
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
          To give everyone private access to the people whose
          <br />
          taste, ideas, and judgment they trust.
        </h1>
      </section>

      <section className="about-believers" aria-labelledby="believers-heading">
        <div className="about-section-heading">
          <h2 id="believers-heading">First seats</h2>
          <p>The first person opening a private seat.</p>
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
          <h2 id="story-heading">Our story</h2>
        </div>
        <div className="about-story-copy">
          <article>
            <h3>The advice was happening.</h3>
            <p>
              People ask creators what to wear, what to buy, how to make
              a room feel better, where to start, and whether something is worth it.
              The most useful answer usually needs a few minutes of context, not
              another comment thread.
            </p>
          </article>
          <article>
            <h3>A private seat makes it real.</h3>
            <p>
              Take a Seat turns that trust into a short, personal video call.
              The follower brings the question. The creator brings the eye they
              are known for. The booking, calendar, payment, and approval path
              stay out of the way.
            </p>
          </article>
          <article>
            <h3>The point is useful access.</h3>
            <p>
              A great creator can help someone choose the dress, fix the corner
              of the room, pack for the trip, or make one decision with more
              confidence. One good seat should feel personal, specific, and
              immediately useful.
            </p>
          </article>
        </div>
      </section>

      <section className="about-final-cta" aria-label="Start with Take a Seat">
        <h2>Book the creator whose advice you keep saving.</h2>
        <div className="about-cta-actions">
          <Link href="/#browse">Find a Seat</Link>
          <Link href="/creators/onboard">Become an Inspiration</Link>
        </div>
      </section>
    </main>
  );
}
