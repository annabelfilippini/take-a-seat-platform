import type { Metadata } from "next";
import { BookingPlatform } from "./BookingPlatform";

export const metadata: Metadata = {
  title: "Take a Seat",
  description:
    "Book private seats with rising creators, tastemakers, and experts.",
};

export default function Home() {
  return <BookingPlatform />;
}
