import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../_components/PageHeader";

export const metadata: Metadata = {
  title: "About | Take a Seat",
  description:
    "Take a Seat helps you meet 1:1 with influencers whose style, beauty, and brand knowledge you already trust.",
};

export default function AboutPage() {
  return (
    <main className="about-page">
      <PageHeader ctaLabel="Find a Seat" navLabel="About page navigation" />

      <section className="about-mission" aria-labelledby="mission-heading">
        <span>Take a Seat</span>
        <h1 id="mission-heading">
          A platform built to make you feel cute, confident, and inspired.
        </h1>
        <p>Come take a seat with us.</p>
      </section>

      <section className="about-story" aria-labelledby="story-heading">
        <div className="about-story-heading">
          <h2 id="story-heading">The idea</h2>
        </div>
        <div className="about-story-copy">
          <article>
            <h3>Influencers know the good stuff.</h3>
            <p>
              Influencers are at the forefront of new brands, trends,
              skincare, makeup, outfits, and all the tiny details that make
              something worth trying. So much of that knowledge lives in their
              heads. They share a lot with everyone, but it is not always
              catered to you.
            </p>
          </article>
          <article>
            <h3>Your question deserves context.</h3>
            <p>
              Take a Seat lets you have a moment with the people you already
              trust. Tell them where you are going, what you are doing, what
              you own, or what you are thinking about buying. They can help you
              feel comfortable and look cute, pair clothes you did not know
              went together, and turn pieces you already have into outfits you
              never quite executed.
            </p>
          </article>
          <article>
            <h3>Cute is the mission.</h3>
            <p>
              Isn&apos;t the goal to look cute so you feel confident and more
              yourself? That is what we thought too. Take a Seat is our way of
              making that easier: meet 1:1 with the people whose knowledge you
              look up to, lean on them as your fashion committee, makeup
              committee, skincare committee, or whatever committee you need,
              and leave feeling cute and confident.
            </p>
          </article>
        </div>
      </section>

      <section className="about-final-cta" aria-label="Start with Take a Seat">
        <h2>Meet your committee.</h2>
        <div className="about-cta-actions">
          <Link href="/#browse">Find a Seat</Link>
          <Link href="/creators/onboard">Apply to Inspire</Link>
        </div>
      </section>
    </main>
  );
}
