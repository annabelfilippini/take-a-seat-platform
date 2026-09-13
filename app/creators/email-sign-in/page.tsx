import type { Metadata } from "next";
import { CreatorEmailSignIn } from "../../_components/CreatorEmailSignIn";
import { getClerkPublishableKey } from "../../_lib/clerk-auth";

export const metadata: Metadata = {
  title: "Open your creator profile | Take a Seat",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default function CreatorEmailSignInPage() {
  return <main className="admin-page"><section className="admin-shell admin-locked">
    <span>Welcome to Take a Seat</span>
    <h1>Let’s open your profile.</h1>
    {getClerkPublishableKey() ? <CreatorEmailSignIn /> : <p>Sign-in is temporarily unavailable. Please try again shortly.</p>}
  </section></main>;
}
