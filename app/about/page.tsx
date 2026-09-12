import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../_components/PageHeader";

export const metadata: Metadata = {
  title: "Our Mission | Take a Seat",
  description:
    "Take a Seat is a platform built to make you feel cute, confident, and inspired through private advice from creators you already trust.",
};

export default function AboutPage() {
  return (
    <main className="about-page">
      <PageHeader ctaLabel="Find a Seat" navLabel="Mission page navigation" />

      <section className="about-mission" aria-labelledby="mission-heading">
        <h1 id="mission-heading">
          A platform built to make you feel cute, confident, and inspired.
        </h1>
        <p>Come take a seat with us.</p>
      </section>

      <section className="about-story" aria-labelledby="story-heading">
        <div className="about-story-heading">
          <h2 id="story-heading">Why we exist</h2>
        </div>
        <div className="about-story-copy">
          <article>
            <h3>Influencers know the good stuff.</h3>
            <p>
              Influencers are at the forefront when it comes to new brands,
              trends, different skincare products, outfits, and all the little
              things worth trying. Their knowledge lives in their heads, and
              while a lot of it is shared with fans, it is not always catered
              to an individual.
            </p>
          </article>
          <article>
            <h3>Your question deserves context.</h3>
            <p>
              Take a Seat is an opportunity to engage with influencers, pick
              their brain about what you are interested in, or ask for advice
              on whatever it may be. Tell them where you are going and what you
              are doing, and they can help you feel comfortable and look cute.
              They can help you pair clothes you never knew went together and
              make new outfits from pieces you had but never executed properly.
            </p>
          </article>
          <article>
            <h3>Cute is the mission.</h3>
            <p>
              Isn&apos;t the goal in life to look cute so you feel confident
              and more yourself? That&apos;s what we thought too :). Take a Seat
              lets you have a moment with the people you already trust the
              most. Meet 1:1 with the people whose knowledge you already look
              up to, lean on them to be your fashion committee, makeup
              committee, or whatever committee you need, and leave feeling cute
              and confident.
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
