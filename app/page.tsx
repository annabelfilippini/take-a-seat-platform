import type { Metadata } from "next";
import { BookingPlatform } from "./BookingPlatform";

export const metadata: Metadata = {
  title: "Take a Seat",
  description:
    "Take a seat with your favorite influencers and the people you trust most.",
};

export default function Home() {
  return <BookingPlatform />;
}
