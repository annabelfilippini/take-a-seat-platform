"use client";

/* eslint-disable @next/next/no-img-element */
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
    name: "Amber Lo",
    title: "Capsule wardrobe and slow fashion creator",
    category: "Style & Beauty",
    status: "booking",
    offer: "Buy It Once",
    price: "$45",
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

const slots = [
  { date: "Wed Sep 2", time: "6:30 PM" },
  { date: "Thu Sep 3", time: "12:15 PM" },
  { date: "Sun Sep 6", time: "10:00 AM" },
];

export function BookingPlatform() {
  const [category, setCategory] = useState("All");
  const [selectedCreator, setSelectedCreator] = useState(creators[0]);
  const [slotIndex, setSlotIndex] = useState(0);
  const [isRequested, setIsRequested] = useState(false);

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

  function selectCreator(creator: Creator) {
    setSelectedCreator(creator);
    setIsRequested(false);
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main className="platform-shell">
      <header className="topbar">
        <a className="brand-mark" href="#top" aria-label="Take a Seat home">
          Take a Seat
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <a href="#browse">Browse</a>
          <a href="#booking">Book</a>
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
            <strong>Take a Seat</strong>
            <span>with the ones to watch</span>
          </h1>
        </div>
      </section>

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
          {visibleCreators.map((creator) => (
            <article className="expert-card" key={creator.id}>
              <button
                aria-label={`View ${creator.name}`}
                className="expert-image-button"
                onClick={() => selectCreator(creator)}
                type="button"
              >
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
              </button>
              <div className="expert-copy">
                <div className="expert-topline">
                  <div>
                    <strong>{creator.name}</strong>
                    <span className="verified" aria-label="Verified creator">
                      &#10003;
                    </span>
                  </div>
                  <span className="rating">
                    <span aria-hidden="true">&#9733;</span> 5.0
                  </span>
                </div>
                <div className="expert-rate">
                  <span>
                    {creator.status === "booking"
                      ? `${creator.category} for ${creator.price} for ${creator.length}`
                      : `${creator.category} opening soon`}
                  </span>
                </div>
                <p>{creator.note}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="booking-section" id="booking">
        <div className="booking-image">
          {selectedCreator.image ? (
            <img
              alt={`${selectedCreator.name} selected profile`}
              src={selectedCreator.image}
              style={{ objectPosition: selectedCreator.objectPosition }}
            />
          ) : (
            <span className={`profile-placeholder profile-${selectedCreator.accent}`}>
              <b>{selectedCreator.name}</b>
            </span>
          )}
        </div>
        <div className="booking-card">
          <span>{selectedCreator.status === "booking" ? "Booking now" : "Opening soon"}</span>
          <h2>{selectedCreator.offer}</h2>
          <p>
            {selectedCreator.name} is offering a private {selectedCreator.length} seat
            for decisions that need a trusted second opinion.
          </p>

          {selectedCreator.status === "booking" ? (
            <div className="booking-flow">
              <div className="slot-grid" aria-label="Available times">
                {slots.map((slot, index) => (
                  <button
                    aria-pressed={slotIndex === index}
                    key={`${slot.date}-${slot.time}`}
                    onClick={() => setSlotIndex(index)}
                    type="button"
                  >
                    <strong>{slot.date}</strong>
                    <span>{slot.time}</span>
                  </button>
                ))}
              </div>
              <button
                className="primary-button"
                onClick={() => setIsRequested(true)}
                type="button"
              >
                {isRequested ? "Request received" : "Request this seat"}
              </button>
            </div>
          ) : (
            <button
              className="secondary-button"
              onClick={() => setSelectedCreator(creators[0])}
              type="button"
            >
              See Amber seat
            </button>
          )}
        </div>
      </section>

      <section className="creator-invite" id="creators">
        <span>For creators</span>
        <h2>Open a few seats. Keep it personal.</h2>
        <p>
          Take a Seat is for specific, human advice: one named offer, a few
          openings a month, and people who already know why they trust you.
        </p>
        <a href="mailto:annabel@takeaseatwith.com">annabel@takeaseatwith.com</a>
      </section>
    </main>
  );
}
