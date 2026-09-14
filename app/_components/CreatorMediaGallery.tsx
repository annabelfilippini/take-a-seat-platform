"use client";

/* eslint-disable @next/next/no-img-element */
import { mediaImageStyle } from "../_lib/creator-gallery";
import { useRef } from "react";
import type { CreatorMediaItem } from "../_lib/creators";

type CreatorMediaGalleryProps = {
  ariaLabel?: string;
  items: CreatorMediaItem[];
  name: string;
  nextLabel?: string;
  previousLabel?: string;
  showCaptions?: boolean;
};

export function CreatorMediaGallery({
  ariaLabel,
  items,
  name,
  nextLabel = "Show next media",
  previousLabel = "Show previous media",
  showCaptions = true,
}: CreatorMediaGalleryProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (!items.length) {
    return null;
  }

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
    <div
      aria-label={ariaLabel ?? `${name} photos and videos`}
      className="amber-hero-gallery"
    >
      <button
        aria-label={previousLabel}
        className="gallery-arrow gallery-arrow-prev"
        onClick={() => scrollGallery(-1)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M15 5 8 12l7 7" />
        </svg>
      </button>
      <div className="amber-gallery-track" ref={trackRef}>
        {items.map((item) => (
          <span className="amber-gallery-frame" key={item.id}>
            <GalleryFrame item={item} showCaption={showCaptions} />
          </span>
        ))}
      </div>
      <button
        aria-label={nextLabel}
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

function GalleryFrame({ item, showCaption }: { item: CreatorMediaItem; showCaption: boolean }) {
  const media = <GalleryMedia item={item} />;

  if (item.href) {
    return (
      <a
        aria-label={`Open ${item.title}`}
        className="amber-gallery-link"
        href={item.href}
        rel="noreferrer"
        target="_blank"
      >
        {media}
        {showCaption ? <span className="amber-gallery-caption">{item.title}</span> : null}
      </a>
    );
  }

  return (
    <span className="amber-gallery-link">
      {media}
      {showCaption ? <span className="amber-gallery-caption">{item.title}</span> : null}
    </span>
  );
}

function GalleryMedia({ item }: { item: CreatorMediaItem }) {
  if (item.kind === "video") {
    return (
      <video
        controls
        loop
        muted
        playsInline
        preload="metadata"
        src={item.source}
      />
    );
  }

  return <img alt={item.alt ?? item.title} src={item.source} style={mediaImageStyle(item)} draggable={false} />;
}
