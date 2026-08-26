"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";

type CreatorStatus = "booking" | "soon";

type Creator = {
  id: string;
  name: string;
  handle: string;
  location: string;
  category: string;
  style: string;
  status: CreatorStatus;
  offer: string;
  price: string;
  length: string;
  nextSeat: string;
  note: string;
  bio: string;
  image: string;
  objectPosition: string;
};

const creators: Creator[] = [
  {
    id: "amber",
    name: "Amber Lowe",
    handle: "@ambermaylowe",
    location: "Birmingham, UK",
    category: "Style & Beauty",
    style: "Capsule wardrobe",
    status: "booking",
    offer: "Buy It Once",
    price: "£45",
    length: "15 min",
    nextSeat: "Wed Sep 2, 2026",
    note: "Show Amber the piece, the basket, or the gap in your capsule. She tells you whether it earns a place.",
    bio: "Capsule wardrobe and slow fashion. Minimal outfits, fewer better pieces, and a very useful bias toward buying nothing badly.",
    image: "/amber-grid.png",
    objectPosition: "50% 41%",
  },
  {
    id: "rented-flat",
    name: "Rented Flat Edit",
    handle: "Founding creator search",
    location: "London, UK",
    category: "Home & Interiors",
    style: "Warm minimal",
    status: "soon",
    offer: "Rented, Not Ruined",
    price: "Opening soon",
    length: "20 min",
    nextSeat: "Creator scouting",
    note: "What to change, what to leave, and what you will actually get your deposit back on.",
    bio: "For renters who want a home that feels considered without becoming a renovation project.",
    image: "",
    objectPosition: "50% 50%",
  },
  {
    id: "sleep-first",
    name: "Evening Routine Audit",
    handle: "Founding creator search",
    location: "Manchester, UK",
    category: "Wellness",
    style: "Practical",
    status: "soon",
    offer: "Sleep First",
    price: "Opening soon",
    length: "15 min",
    nextSeat: "Creator scouting",
    note: "Find the one part of your evening that keeps stealing the next morning.",
    bio: "A practical seat for routines, not products, supplements, or complicated wellness theatre.",
    image: "",
    objectPosition: "50% 50%",
  },
  {
    id: "one-pan",
    name: "Weeknight Food Person",
    handle: "Founding creator search",
    location: "Brooklyn, NY",
    category: "Food",
    style: "No-fuss",
    status: "soon",
    offer: "One Pan, Four Dinners",
    price: "Opening soon",
    length: "15 min",
    nextSeat: "Creator scouting",
    note: "Tell them what is in the fridge and what time you get home. Leave with a week you will cook.",
    bio: "For people who save recipes constantly and still make toast for dinner.",
    image: "",
    objectPosition: "50% 50%",
  },
];

const categories = [
  "All",
  "Booking now",
  "Style & Beauty",
  "Home & Interiors",
  "Wellness",
  "Food",
];

const slots = [
  { date: "Wed Sep 2, 2026", time: "18:30", label: "Evening" },
  { date: "Thu Sep 3, 2026", time: "12:15", label: "Lunch" },
  { date: "Sun Sep 6, 2026", time: "10:00", label: "Morning" },
  { date: "Sun Sep 6, 2026", time: "10:30", label: "Morning" },
];

export function BookingPlatform() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedCreator, setSelectedCreator] = useState(creators[0]);
  const [saved, setSaved] = useState(["amber"]);
  const [step, setStep] = useState(1);
  const [slotIndex, setSlotIndex] = useState(0);

  const visibleCreators = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return creators.filter((creator) => {
      const matchesCategory =
        category === "All" ||
        (category === "Booking now" && creator.status === "booking") ||
        creator.category === category;
      const haystack = [
        creator.name,
        creator.handle,
        creator.location,
        creator.category,
        creator.style,
        creator.offer,
        creator.note,
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && (!cleanQuery || haystack.includes(cleanQuery));
    });
  }, [category, query]);

  const activeCount = creators.filter((creator) => creator.status === "booking").length;
  const soonCount = creators.length - activeCount;
  const chosenSlot = slots[slotIndex];

  function chooseCreator(creator: Creator) {
    setSelectedCreator(creator);
    setStep(1);
  }

  function toggleSaved(id: string) {
    setSaved((current) =>
      current.includes(id)
        ? current.filter((savedId) => savedId !== id)
        : [...current, id],
    );
  }

  return (
    <main className="platform-shell">
      <header className="topbar">
        <a className="brand" href="#browse" aria-label="Take a Seat home">
          Take a Seat
        </a>
        <label className="search-box">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, niche, city, or decision"
          />
        </label>
        <nav className="topnav" aria-label="Primary navigation">
          <a href="#browse">Browse</a>
          <a href="#creators">For creators</a>
          <button type="button">Sign in</button>
        </nav>
      </header>

      <section className="category-rail" aria-label="Browse categories">
        {categories.map((item) => (
          <button
            aria-pressed={category === item}
            className="category-pill"
            key={item}
            onClick={() => setCategory(item)}
            type="button"
          >
            <span className={`category-art category-${slug(item)}`} />
            <span>{item}</span>
          </button>
        ))}
      </section>

      <section className="marketplace" id="browse">
        <aside className="filter-panel" aria-label="Marketplace filters">
          <div className="crumb">Consultations / Find a seat</div>
          <FilterGroup
            title="Availability"
            rows={[
              ["Booking now", `${activeCount}`],
              ["Opening soon", `${soonCount}`],
            ]}
          />
          <FilterGroup
            title="Style"
            rows={[
              ["Capsule wardrobe", "1"],
              ["Warm minimal", "1"],
              ["Practical", "1"],
              ["No-fuss", "1"],
            ]}
          />
          <FilterGroup
            title="Length"
            rows={[
              ["15 minutes", "3"],
              ["20 minutes", "1"],
            ]}
          />
          <div className="trust-note">
            <span>Private reservation</span>
            <p>
              Every request is reviewed before anything is charged. No phone
              numbers are shared.
            </p>
          </div>
        </aside>

        <div className="browse-column">
          <div className="results-bar">
            <div>
              <p>{visibleCreators.length} seats shown</p>
              <strong>
                {activeCount} booking now, {soonCount} opening soon
              </strong>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setCategory("All");
                setQuery("");
              }}
              type="button"
            >
              Clear
            </button>
          </div>

          <div className="creator-grid">
            {visibleCreators.map((creator) => (
              <article
                className={`creator-card ${creator.status === "soon" ? "creator-card-soon" : ""}`}
                key={creator.id}
              >
                <div className="creator-media">
                  {creator.image ? (
                    <img
                      alt={`${creator.name} style grid`}
                      src={creator.image}
                      style={{ objectPosition: creator.objectPosition }}
                    />
                  ) : (
                    <span className={`placeholder-art placeholder-${creator.id}`} />
                  )}
                  <button
                    aria-label={
                      saved.includes(creator.id)
                        ? `Remove ${creator.name} from saved`
                        : `Save ${creator.name}`
                    }
                    className="save-button"
                    onClick={() => toggleSaved(creator.id)}
                    type="button"
                  >
                    {saved.includes(creator.id) ? "Saved" : "Save"}
                  </button>
                  <span className="status-badge">
                    {creator.status === "booking" ? "Booking now" : "Opening soon"}
                  </span>
                </div>
                <div className="creator-body">
                  <div className="creator-id">
                    <div>
                      <h2>{creator.name}</h2>
                      <p>{creator.location}</p>
                    </div>
                    {creator.id === "amber" && (
                      <img
                        alt="Amber Lowe profile"
                        className="avatar"
                        src="/amber-profile.png"
                      />
                    )}
                  </div>
                  <div>
                    <span className="eyebrow">{creator.category}</span>
                    <h3>{creator.offer}</h3>
                    <p>{creator.note}</p>
                  </div>
                  <dl className="creator-meta">
                    <div>
                      <dt>Seat</dt>
                      <dd>{creator.price}</dd>
                    </div>
                    <div>
                      <dt>Length</dt>
                      <dd>{creator.length}</dd>
                    </div>
                    <div>
                      <dt>Next</dt>
                      <dd>{creator.nextSeat}</dd>
                    </div>
                  </dl>
                  <button
                    className={creator.status === "booking" ? "primary-button" : "secondary-button"}
                    onClick={() => chooseCreator(creator)}
                    type="button"
                  >
                    {creator.status === "booking" ? "Reserve your seat" : "Join waitlist"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="booking-panel" aria-label="Selected booking">
          <div className="panel-card">
            <div className="panel-image">
              <img alt="Amber Lowe outfit details" src="/amber-style.png" />
            </div>
            <span className="eyebrow">First founding creator</span>
            <h2>{selectedCreator.offer}</h2>
            <p>{selectedCreator.bio}</p>
            {selectedCreator.status === "booking" ? (
              <BookingFlow
                chosenSlot={chosenSlot}
                setSlotIndex={setSlotIndex}
                setStep={setStep}
                slotIndex={slotIndex}
                step={step}
              />
            ) : (
              <div className="waitlist-box">
                <strong>{selectedCreator.name}</strong>
                <p>
                  This seat is a platform preview. Amber is the first live
                  creator; this category opens after the first founding calls.
                </p>
                <button
                  className="secondary-button"
                  onClick={() => chooseCreator(creators[0])}
                  type="button"
                >
                  Back to Amber
                </button>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="creator-invite" id="creators">
        <div>
          <span className="eyebrow">For creators</span>
          <h2>Open four seats. Keep it personal.</h2>
          <p>
            One named offer, four to eight openings a month, roughly 80% to
            you. Take a Seat handles the booking request, screening, reminders,
            and written follow-up prompt.
          </p>
        </div>
        <div className="invite-actions">
          <button className="primary-button" type="button">
            Open your Office Hours
          </button>
          <a href="mailto:annabel@takeaseatwith.com">
            annabel@takeaseatwith.com
          </a>
        </div>
      </section>
    </main>
  );
}

function BookingFlow({
  chosenSlot,
  setSlotIndex,
  setStep,
  slotIndex,
  step,
}: {
  chosenSlot: (typeof slots)[number];
  setSlotIndex: (slotIndex: number) => void;
  setStep: (step: number) => void;
  slotIndex: number;
  step: number;
}) {
  if (step === 4) {
    return (
      <div className="confirmation">
        <span className="eyebrow">Request received</span>
        <h3>You are booked with Amber.</h3>
        <p>
          A private confirmation is ready for {chosenSlot.date} at{" "}
          {chosenSlot.time}. Amber reviews the request before payment is
          captured.
        </p>
        <button className="secondary-button" onClick={() => setStep(1)} type="button">
          Run it again
        </button>
      </div>
    );
  }

  return (
    <div className="booking-flow">
      <div className="step-tabs" aria-label="Booking progress">
        {[1, 2, 3].map((item) => (
          <button
            aria-current={step === item ? "step" : undefined}
            key={item}
            onClick={() => setStep(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="step-pane">
          <span className="eyebrow">Choose a time</span>
          <div className="slot-grid">
            {slots.map((slot, index) => (
              <button
                aria-pressed={slotIndex === index}
                key={`${slot.date}-${slot.time}`}
                onClick={() => setSlotIndex(index)}
                type="button"
              >
                <span>{slot.label}</span>
                <strong>{slot.date}</strong>
                <em>{slot.time}</em>
              </button>
            ))}
          </div>
          <button className="primary-button" onClick={() => setStep(2)} type="button">
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="step-pane">
          <span className="eyebrow">Quick intro</span>
          <label>
            First name
            <input placeholder="Rosie" />
          </label>
          <label>
            Email
            <input placeholder="you@email.com" type="email" />
          </label>
          <label>
            Instagram
            <input placeholder="@yourhandle" />
          </label>
          <button className="primary-button" onClick={() => setStep(3)} type="button">
            Continue
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="step-pane">
          <span className="eyebrow">Before the call</span>
          <label>
            What are you deciding?
            <textarea placeholder="I keep going back to a wool coat but already own two black coats I do not love." />
          </label>
          <label>
            Links
            <input placeholder="Paste up to three product links" />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" />
            <span>I am 18 or older and accept the cancellation terms.</span>
          </label>
          <button className="primary-button" onClick={() => setStep(4)} type="button">
            Reserve and pay
          </button>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  rows,
  title,
}: {
  rows: [string, string][];
  title: string;
}) {
  return (
    <div className="filter-group">
      <h2>{title}</h2>
      {rows.map(([label, count]) => (
        <div className="filter-row" key={label}>
          <span>{label}</span>
          <span>{count}</span>
        </div>
      ))}
    </div>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-");
}
