"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { creators } from "../_lib/creators";

const categories = [
  { label: "Top Experts", filter: "All", image: "/category-top-experts.png", position: "50% 34%" },
  { label: "Style & Beauty", filter: "Style & Beauty", image: "/category-style.png", position: "50% 44%" },
  { label: "Fitness & Wellness", filter: "Fitness & Wellness", image: "/category-wellness.png", position: "50% 66%" },
  { label: "Food", filter: "Food", image: "/category-food.png", position: "50% 50%" },
  {
    label: "Home Interiors",
    filter: "Home Interiors",
    image: "/category-home-interiors.png",
    position: "50% 54%",
  },
];

type CreatorDirectoryProps = {
  initialQuery?: string;
  showInlineSearch?: boolean;
};

export function CreatorDirectory({
  initialQuery = "",
  showInlineSearch = true,
}: CreatorDirectoryProps) {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState(initialQuery);

  const visibleCreators = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return creators.filter((creator) => {
      const matchesCategory = category === "All" || creator.category === category;

      const searchable = [
        creator.name,
        creator.instagramHandle,
        creator.tiktokHandle,
        creator.location,
        creator.category,
        creator.title,
        creator.offer,
        creator.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesCategory && (!cleanQuery || searchable.includes(cleanQuery));
    });
  }, [category, query]);

  return (
    <>
      <section className="category-band directory-category-band" aria-label="Browse by category">
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

      <section className="browse-section directory-results" id="browse">
        <div className={`directory-tools${query ? "" : " directory-tools-search-only"}${showInlineSearch ? "" : " directory-tools-heading-only"}`}>
          {query ? (
            <div className="browse-heading">
              <span>Search results</span>
              <p>
                {`${visibleCreators.length} creator${
                  visibleCreators.length === 1 ? "" : "s"
                } match "${query}".`}
              </p>
            </div>
          ) : null}
          {showInlineSearch ? (
            <label className="directory-search">
              <input
                aria-label="Search creators"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search creators"
                type="search"
                value={query}
              />
            </label>
          ) : null}
        </div>

        {visibleCreators.length > 0 ? (
          <div className="expert-grid">
            {visibleCreators.map((creator) => {
              const hasProfile = creator.status === "booking" || Boolean(creator.profile);
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
                    {hasProfile ? (
                      <span className="profile-link">View profile</span>
                    ) : null}
                  </div>
                </article>
              );

              if (hasProfile) {
                return (
                  <a
                    aria-label={`View ${creator.name} profile`}
                    className="expert-card-link"
                    href={`/with/${creator.slug}`}
                    key={creator.id}
                  >
                    {card}
                  </a>
                );
              }

              return <div key={creator.id}>{card}</div>;
            })}
          </div>
        ) : (
          <div className="empty-search-state">
            <strong>No creators found.</strong>
            <p>Try a name, category, location, or a broader word like style.</p>
          </div>
        )}
      </section>
    </>
  );
}
