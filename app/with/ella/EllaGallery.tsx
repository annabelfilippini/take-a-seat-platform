"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef } from "react";

const galleryItems = [
  {
    alt: "Ella McLane in a sundress near the coast",
    href: "https://www.tiktok.com/@ellamclane/video/7665329691254951198",
    image: "/ella-reference-sundress.jpg",
    title: "Sundress styling",
  },
  {
    alt: "Ella McLane street style outfit reference",
    href: "https://www.tiktok.com/@ellamclane/video/7661987130444418334",
    image: "/ella-reference-street-style.jpg",
    title: "Everyday outfit polish",
  },
  {
    alt: "Ella McLane coastal outfit inspiration",
    href: "https://www.tiktok.com/@ellamclane/video/7657164268663557407",
    image: "/ella-reference-coast.jpg",
    title: "Coastal classics",
  },
];

export function EllaGallery() {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollGallery(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const frame = track.querySelector(".amber-gallery-frame");
    const frameWidth = frame?.getBoundingClientRect().width ?? track.clientWidth;

    track.scrollBy({
      behavior: "smooth",
      left: direction * (frameWidth + 2),
    });
  }

  return (
    <div className="amber-hero-gallery" aria-label="Ella's lifestyle and outfit carousel">
      <button
        aria-label="Show previous Ella style references"
        className="gallery-arrow gallery-arrow-prev"
        onClick={() => scrollGallery(-1)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M15 5 8 12l7 7" />
        </svg>
      </button>
      <div className="amber-gallery-track" ref={trackRef}>
        {galleryItems.map((item) => (
          <span className="amber-gallery-frame" key={item.image}>
            <a
              aria-label={`Open ${item.title} on TikTok`}
              className="amber-gallery-link"
              href={item.href}
              rel="noreferrer"
              target="_blank"
            >
              <img alt={item.alt} src={item.image} />
              <span className="amber-gallery-caption">{item.title}</span>
            </a>
          </span>
        ))}
      </div>
      <button
        aria-label="Show next Ella style references"
        className="gallery-arrow gallery-arrow-next"
        onClick={() => scrollGallery(1)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
