import type { Metadata } from "next";
import { PageHeader } from "../_components/PageHeader";
import { getClerkPublishableKey } from "../_lib/clerk-auth";
import { SignInClerkScreen } from "../_components/SignInClerkScreen";

export const metadata: Metadata = {
  title: "Sign In | Take a Seat",
  description: "Sign in to Take a Seat with a texted phone code.",
};

type SignInPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function SignInPage({ searchParams }: SignInPageProps) {
  const clerkPublishableKey = getClerkPublishableKey();
  const redirectUrl = getSafeRedirectUrl(searchParams?.redirect_url);

  return (
    <main className="account-auth-page">
      <PageHeader ctaLabel="Find a Seat" navLabel="Sign in navigation" />
      <section className="account-auth-shell account-auth-shell-minimal" aria-label="Phone number sign-in">
        <h1 className="visually-hidden">Sign in with your phone.</h1>
        {clerkPublishableKey ? (
          <SignInClerkScreen
            codeHeading="Enter your verification code."
            redirectUrl={redirectUrl}
            submitLabel="Next"
          />
        ) : (
          <StaticPhoneNumberForm />
        )}
      </section>
    </main>
  );
}

function getSafeRedirectUrl(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }

  return value;
}

function StaticPhoneNumberForm() {
  return (
    <div className="account-auth-widget">
      <form className="phone-auth-form">
        <label>
          <span>Phone number</span>
          <input
            autoComplete="tel"
            disabled
            inputMode="tel"
            name="phone"
            placeholder="+1 555 000 0000"
            type="tel"
          />
        </label>
        <button className="phone-auth-submit" disabled type="button">
          Next
        </button>
      </form>
    </div>
  );
}
