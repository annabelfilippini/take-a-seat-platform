import type { Metadata } from "next";
import { BookingPlatform } from "./BookingPlatform";

export const metadata: Metadata = {
  title: "Take a Seat | Personal Office Hours",
  description: "Reserve private office hours with people worth knowing.",
};

export default function Home() {
  return <BookingPlatform />;
}
