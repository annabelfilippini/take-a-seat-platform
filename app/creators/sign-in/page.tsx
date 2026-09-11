import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sign In | Take a Seat",
  description: "Sign in to Take a Seat with a texted phone code.",
};

export default function CreatorSignInPage() {
  redirect("/sign-in");
}
