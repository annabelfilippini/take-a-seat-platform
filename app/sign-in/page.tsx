import type { Metadata } from "next";
import { PageHeader } from "../PageHeader";
import { getClerkPublishableKey } from "../clerk-auth";
import { SignInClerkScreen } from "../SignInClerkScreen";

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
      <section className="account-auth-shell" aria-label="Phone number sign-in">
        <h1>Sign in with your phone.</h1>
        {clerkPublishableKey ? (
          <SignInClerkScreen
            codeHeading="Enter your verification code."
            description="Sign in by mobile phone and we will text you a verification code."
            eyebrow="Take a Seat"
            heading="Enter your mobile number."
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
        <div className="phone-auth-heading">
          <span>Take a Seat</span>
          <h2>Enter your mobile number.</h2>
          <p>
            Sign in by mobile phone and we will text you a verification code.
          </p>
        </div>
        <label>
          <span>Mobile phone</span>
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
