"use client";

import { CreatorMediaGallery } from "../../_components/CreatorMediaGallery";
import type { CreatorMediaItem } from "../../_lib/creators";

const galleryItems: CreatorMediaItem[] = [
  {
    alt: "Ella McLane in a sundress near the coast",
    href: "https://www.tiktok.com/@ellamclane/video/7665329691254951198",
    id: "ella-reference-sundress",
    kind: "photo",
    source: "/ella-reference-sundress.jpg",
    title: "Sundress styling",
  },
  {
    alt: "Ella McLane street style outfit reference",
    href: "https://www.tiktok.com/@ellamclane/video/7661987130444418334",
    id: "ella-reference-street-style",
    kind: "photo",
    source: "/ella-reference-street-style.jpg",
    title: "Everyday outfit polish",
  },
  {
    alt: "Ella McLane coastal outfit inspiration",
    href: "https://www.tiktok.com/@ellamclane/video/7657164268663557407",
    id: "ella-reference-coast",
    kind: "photo",
    source: "/ella-reference-coast.jpg",
    title: "Coastal classics",
  },
];

export function EllaGallery({ items = galleryItems }: { items?: CreatorMediaItem[] }) {
  return (
    <CreatorMediaGallery
      ariaLabel="Ella's lifestyle and outfit carousel"
      items={items}
      name="Ella McLane"
      nextLabel="Show next Ella style references"
      previousLabel="Show previous Ella style references"
    />
  );
}
