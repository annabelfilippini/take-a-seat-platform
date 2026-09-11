import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CREATOR_PROFILE_EDITOR_URL } from "../../../_lib/creator-destination";

export const metadata: Metadata = {
  title: "Creator Setup | Take a Seat",
  description: "Creator setup now opens the Take a Seat profile editor.",
};

export default function AcceptedCreatorPage() {
  redirect(CREATOR_PROFILE_EDITOR_URL);
}
