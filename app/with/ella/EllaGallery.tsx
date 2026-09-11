"use client";

import { useRef } from "react";

const galleryVideos = [
  {
    id: "7665329691254951198",
    title: "Ella McLane styling video on TikTok",
  },
  {
    id: "7661987130444418334",
    title: "Ella McLane outfit video on TikTok",
  },
  {
    id: "7657164268663557407",
    title: "Ella McLane classic style video on TikTok",
  },
  {
    id: "7668294958515784990",
    title: "Ella McLane elevated styling video on TikTok",
  },
  {
    id: "7667925672676838687",
    title: "Ella McLane outfit inspiration video on TikTok",
  },
];

const tiktokPlayerOptions = [
  "autoplay=1",
  "muted=1",
  "loop=1",
  "controls=0",
  "play_button=0",
  "volume_control=0",
  "fullscreen_button=0",
  "progress_bar=0",
  "timestamp=0",
  "music_info=0",
  "description=0",
  "rel=0",
  "native_context_menu=0",
  "closed_caption=0",
].join("&");

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
        {galleryVideos.map((video) => (
          <span className="amber-gallery-frame" key={video.id}>
            <iframe
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              loading="lazy"
              src={`https://www.tiktok.com/player/v1/${video.id}?${tiktokPlayerOptions}`}
              title={video.title}
            />
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
