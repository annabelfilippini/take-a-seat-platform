import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CREATOR_PROFILE_EDITOR_URL } from "../../creator-destination";

export const metadata: Metadata = {
  title: "Creator Dashboard | Take a Seat",
  description: "Manage a Take a Seat creator profile.",
};

export default function CreatorDashboardPage() {
  redirect(CREATOR_PROFILE_EDITOR_URL);
}
