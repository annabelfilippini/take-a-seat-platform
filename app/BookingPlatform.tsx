"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useState } from "react";

type CreatorStatus = "booking" | "soon";

type Creator = {
  id: string;
  name: string;
  title: string;
  category: string;
  status: CreatorStatus;
  offer: string;
  price: string;
  length: string;
  note: string;
  image: string | null;
  objectPosition: string;
  accent: string;
};

const creators: Creator[] = [
  {
    id: "amber",
    name: "Amber May Lowe",
    title: "Capsule wardrobe and slow fashion creator",
    category: "Style & Beauty",
    status: "booking",
    offer: "Buy It Once",
    price: "£45",
    length: "15 minutes",
    note: "She helps people figure out how to put classic outfits together.",
    image: "/amber-card.png",
    objectPosition: "50% 18%",
    accent: "amber",
  },
  {
    id: "abby",
    name: "Abby Catlin",
    title: "Founding creator preview",
    category: "Style & Beauty",
    status: "soon",
    offer: "Closet Clarity",
    price: "Soon",
    length: "15 minutes",
    note: "A preview seat for everyday outfits, event looks, and better repeat pieces.",
    image: null,
    objectPosition: "50% 16%",
    accent: "style",
  },
  {
    id: "alex",
    name: "Alex Earl",
    title: "Founding creator preview",
    category: "Style & Beauty",
    status: "soon",
    offer: "Get Ready Edit",
    price: "Soon",
    length: "15 minutes",
    note: "A sample card showing how another influencer profile will sit next to Amber.",
    image: null,
    objectPosition: "50% 50%",
    accent: "beauty",
  },
  {
    id: "rented-flat",
    name: "Rented Flat Edit",
    title: "Warm minimal home advice",
    category: "Home Interiors",
    status: "soon",
    offer: "Rented, Not Ruined",
    price: "Soon",
    length: "20 min",
    note: "What to change, what to leave, and what you will actually get your deposit back on.",
    image: null,
    objectPosition: "50% 50%",
    accent: "home",
  },
  {
    id: "wellness-preview",
    name: "Wellness Edit",
    title: "Founding creator preview",
    category: "Wellness",
    status: "soon",
    offer: "Routine Reset",
    price: "Soon",
    length: "15 minutes",
    note: "A placeholder profile for wellness creators joining the platform later.",
    image: null,
    objectPosition: "50% 50%",
    accent: "wellness",
  },
  {
    id: "food-preview",
    name: "Food Edit",
    title: "Founding creator preview",
    category: "Food",
    status: "soon",
    offer: "Weeknight Plan",
    price: "Soon",
    length: "15 minutes",
    note: "A placeholder profile for food creators and practical meal planning seats.",
    image: null,
    objectPosition: "50% 50%",
    accent: "food",
  },
];

const categories = [
  { label: "Top Experts", filter: "All", image: "/category-top-experts.png", position: "62% 48%" },
  { label: "Style & Beauty", filter: "Style & Beauty", image: "/category-style.png", position: "50% 48%" },
  { label: "Home Interiors", filter: "Home Interiors", image: "/category-home-interiors.png", position: "50% 50%" },
  { label: "Wellness", filter: "Wellness", image: "/category-wellness.png", position: "50% 52%" },
  { label: "Food", filter: "Food", image: "/category-food.png", position: "66% 48%" },
];

export function BookingPlatform() {
  const [category, setCategory] = useState("All");

  const visibleCreators = useMemo(() => {
    return creators.filter((creator) => {
      if (category === "All") {
        return true;
      }

      if (category === "Booking now") {
        return creator.status === "booking";
      }

      return creator.category === category;
    });
  }, [category]);

  return (
    <main className="platform-shell">
      <header className="topbar home-topbar">
        <a className="brand-mark home-hero-brand" href="#top" aria-label="Take a Seat home">
          Take a Seat
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <a href="#browse">Browse</a>
          <a href="#creators">Creators</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <img
          alt="A warm dressing room with a woven chair facing built-in closet shelves"
          className="hero-image"
          src="/hero-chair.png"
        />
        <div className="hero-copy">
          <h1>
            <span>Experience passion from the influential</span>
            <strong>Take a Seat</strong>
          </h1>
        </div>
      </section>

      <div className="below-hero-bar">
        <a className="below-hero-brand" href="#top" aria-label="Take a Seat home">
          Take a Seat
        </a>
      </div>

      <section className="category-band" aria-label="Browse by category">
        {categories.map((item) => (
          <button
            aria-pressed={category === item.filter}
            className="category-button"
            key={item.label}
            onClick={() => setCategory(item.filter)}
            type="button"
          >
            <span className="category-orb">
              <img
                alt=""
                src={item.image}
                style={{ objectPosition: item.position }}
              />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </section>

      <section className="browse-section" id="browse">
        <div className="expert-grid">
          {visibleCreators.map((creator) => {
            const card = (
              <article className="expert-card">
                <div className="expert-image-frame">
                  {creator.image ? (
                    <img
                      alt={`${creator.name} profile`}
                      src={creator.image}
                      style={{ objectPosition: creator.objectPosition }}
                    />
                  ) : (
                    <span className={`profile-placeholder profile-${creator.accent}`}>
                      <b>{creator.name}</b>
                    </span>
                  )}
                </div>
                <div className="expert-copy">
                  <div className="expert-topline">
                    <strong>{creator.name}</strong>
                    <span className="rating">
                      <span aria-hidden="true">&#9733;</span> 5.0
                    </span>
                  </div>
                  <span className="expert-category">{creator.category}</span>
                  <span className="expert-rate">
                    {creator.status === "booking"
                      ? `${creator.price} • ${creator.length}`
                      : "Opening soon"}
                  </span>
                  <p className="expert-note">{creator.note}</p>
                  {creator.id === "amber" ? (
                    <span className="profile-link">View profile</span>
                  ) : null}
                </div>
              </article>
            );

            if (creator.id === "amber") {
              return (
                <Link
                  aria-label="View Amber May Lowe profile"
                  className="expert-card-link"
                  href="/with/amber/"
                  key={creator.id}
                >
                  {card}
                </Link>
              );
            }

            return <div key={creator.id}>{card}</div>;
          })}
        </div>
      </section>

      <section className="creator-invite" id="creators">
        <h2>
          <span>For creators</span>
          <strong>That crave a stronger community.</strong>
        </h2>
        <p>
          Open a few private seats for followers who want your eye on something
          specific. It is a simple way to know them better and share the advice
          they already come to you for.
        </p>
        <a href="mailto:annabel@takeaseatwith.com?subject=Creator%20application">
          Apply to become a creator
        </a>
      </section>
    </main>
  );
}
