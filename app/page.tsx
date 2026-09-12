import { listPublicMarketplaceCreators } from "./_lib/creator-onboarding";
import type { Metadata } from "next";
import { BookingPlatform } from "./_components/BookingPlatform";

export const metadata: Metadata = {
  title: "Take a Seat",
  description:
    "Choose a private seat with rising creators, tastemakers, and experts.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  return <BookingPlatform creators={await listPublicMarketplaceCreators()} />;
}
