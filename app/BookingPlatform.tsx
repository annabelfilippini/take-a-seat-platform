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
  image: string;
  objectPosition: string;
};

const creators: Creator[] = [
  {
    id: "amber",
    name: "Amber Lowe",
    title: "Capsule wardrobe and slow fashion creator",
    category: "Style & Beauty",
    status: "booking",
    offer: "Buy It Once",
    price: "$45",
    length: "15 min",
    note: "Show Amber the piece, basket, or gap in your capsule. Leave knowing what earns a place.",
    image: "/amber-profile.jpg",
    objectPosition: "16% 17%",
  },
  {
    id: "style-edit",
    name: "The Style Edit",
    title: "Founding creator search",
    category: "Style & Beauty",
    status: "soon",
    offer: "Closet Clarity",
    price: "Soon",
    length: "20 min",
    note: "For outfits, events, repeat buys, and the pieces you keep almost returning.",
    image: "/amber-style.jpg",
    objectPosition: "50% 16%",
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
    image: "/chair-hero.png",
    objectPosition: "51% 58%",
  },
  {
    id: "sleep-first",
    name: "Evening Routine Audit",
    title: "Simple wellness systems",
    category: "Wellness",
    status: "soon",
    offer: "Sleep First",
    price: "Soon",
    length: "15 min",
    note: "Find the one part of your evening that keeps stealing the next morning.",
    image: "/amber-grid.jpg",
    objectPosition: "50% 16%",
  },
  {
    id: "one-pan",
    name: "Weeknight Food Person",
    title: "Low-lift dinner advice",
    category: "Food",
    status: "soon",
    offer: "One Pan, Four Dinners",
    price: "Soon",
    length: "15 min",
    note: "Tell them what is in the fridge and what time you get home. Leave with a week you will cook.",
    image: "/amber-linen-set.jpg",
    objectPosition: "48% 22%",
  },
  {
    id: "home-layers",
    name: "Home Layers",
    title: "Texture, lighting, and shelf help",
    category: "Home Interiors",
    status: "soon",
    offer: "Room Reset",
    price: "Soon",
    length: "20 min",
    note: "A quick edit for the corner, shelf, wall, or room that never quite comes together.",
    image: "/chair-hero.png",
    objectPosition: "46% 45%",
  },
];

const categories = [
  { label: "Top Experts", filter: "All", image: "/amber-profile.jpg", position: "16% 17%" },
  { label: "Booking Now", filter: "Booking now", image: "/amber-linen-set.jpg", position: "48% 22%" },
  { label: "Style & Beauty", filter: "Style & Beauty", image: "/amber-style.jpg", position: "50% 16%" },
  { label: "Home Interiors", filter: "Home Interiors", image: "/chair-hero.png", position: "50% 54%" },
  { label: "Wellness", filter: "Wellness", image: "/amber-grid.jpg", position: "50% 16%" },
  { label: "Food", filter: "Food", image: "/amber-linen-set.jpg", position: "48% 60%" },
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
        <p className="hero-blurb">
          Take a seat with your favorite influencers or with the people that
          you trust the most.
        </p>
        <div className="hero-image-wrap">
          <h1>Take a Seat</h1>
          <img
            alt="A warm interior with a sculptural white chair facing built-in shelves"
            className="hero-image"
            src="/chair-hero.png"
          />
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
        <div className="section-heading">
          <span>Top Experts</span>
          <h2>Access to the people you already trust</h2>
        </div>

        <div className="expert-grid">
          {visibleCreators.map((creator) => (
            <article className="expert-card" key={creator.id}>
              <button
                aria-label={`View ${creator.name}`}
                className="expert-image-button"
                onClick={() => selectCreator(creator)}
                type="button"
              >
                <img
                  alt={`${creator.name} profile`}
                  src={creator.image}
                  style={{ objectPosition: creator.objectPosition }}
                />
                <span>{creator.status === "booking" ? "Book now" : "Opening soon"}</span>
              </button>
              <div className="expert-copy">
                <div className="expert-topline">
                  <strong>{creator.name}</strong>
                  <span>5.0</span>
                </div>
                <p>{creator.title}</p>
                <h3>{creator.offer}</h3>
                <p>{creator.note}</p>
                <div className="expert-footer">
                  <span>{creator.category}</span>
                  <b>
                    {creator.price} <small>{creator.length}</small>
                  </b>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="booking-section" id="booking">
        <div className="booking-image">
          <img
            alt={`${selectedCreator.name} selected profile`}
            src={selectedCreator.image}
            style={{ objectPosition: selectedCreator.objectPosition }}
          />
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
