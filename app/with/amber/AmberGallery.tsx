"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef } from "react";

const galleryImages = [
  {
    alt: "Amber May Lowe in a chocolate brown capsule outfit",
    src: "/amber-reference-street-clean.png",
  },
  {
    alt: "Amber May Lowe wearing black tailoring against a wood door",
    src: "/amber-reference-black-clean.png",
  },
  {
    alt: "Amber May Lowe wearing a brown outfit outside a black door",
    src: "/amber-reference-brown-door.png",
  },
  {
    alt: "Amber May Lowe wearing a trench coat with white trousers",
    src: "/amber-reference-trench.png",
  },
];

export function AmberGallery() {
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
      left: direction * (frameWidth + 10),
    });
  }

  return (
    <div
      className="amber-hero-gallery"
      aria-label="Amber's capsule wardrobe style carousel"
    >
      <button
        aria-label="Show previous Amber style photos"
        className="gallery-arrow gallery-arrow-prev"
        onClick={() => scrollGallery(-1)}
        type="button"
      >
        ‹
      </button>
      <div className="amber-gallery-track" ref={trackRef}>
        {galleryImages.map((image) => (
          <span className="amber-gallery-frame" key={image.src}>
            <img alt={image.alt} src={image.src} />
          </span>
        ))}
      </div>
      <button
        aria-label="Show next Amber style photos"
        className="gallery-arrow gallery-arrow-next"
        onClick={() => scrollGallery(1)}
        type="button"
      >
        ›
      </button>
    </div>
  );
}
