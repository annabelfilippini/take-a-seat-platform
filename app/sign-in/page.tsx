import type { Metadata } from "next";
import { PageHeader } from "../_components/PageHeader";
import { getClerkPublishableKey, isPhoneSignInEnabled } from "../_lib/clerk-auth";
import { SignInClerkScreen } from "../_components/SignInClerkScreen";

export const metadata: Metadata = {
  title: "Sign In | Take a Seat",
  description: "Sign in to your Take a Seat profile with a verification code.",
};

type SignInPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function SignInPage({ searchParams }: SignInPageProps) {
  const clerkPublishableKey = getClerkPublishableKey();
  const redirectUrl = getSafeRedirectUrl(searchParams?.redirect_url);
  const allowSignUpIfMissing = true;
  const routeByAccount =
    !redirectUrl ||
    (isCreatorDashboardRedirect(redirectUrl) && !redirectUrl.includes("invite="));
  const postAuthRedirectUrl = routeByAccount ? "/creator/profile" : redirectUrl;

  return (
    <main className="account-auth-page">
      <PageHeader ctaLabel="Find a Seat" navLabel="Sign in navigation" />
      <section className="account-auth-shell account-auth-shell-minimal" aria-label="Creator sign-in">
        <h1 className="visually-hidden">Sign in with your application email.</h1>
        {clerkPublishableKey ? (
          <SignInClerkScreen
            allowPhoneSignIn={isPhoneSignInEnabled()}
            allowSignUpIfMissing={allowSignUpIfMissing}
            codeHeading="Enter your verification code."
            description="Use the email address from your accepted creator application."
            heading="Creator sign-in"
            redirectUrl={postAuthRedirectUrl}
            routeByAccount={routeByAccount}
            submitLabel="Next"
          />
        ) : (
          <StaticEmailForm />
        )}
      </section>
    </main>
  );
}

function getSafeRedirectUrl(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return undefined;
  }

  return value;
}

function isCreatorDashboardRedirect(value: string | undefined) {
  return Boolean(value?.startsWith("/creators/dashboard"));
}

function StaticEmailForm() {
  return (
    <div className="account-auth-widget">
      <form className="phone-auth-form">
        <label>
          <span>Email address</span>
          <input
            autoComplete="email"
            disabled
            inputMode="email"
            name="email"
            placeholder="you@example.com"
            type="email"
          />
        </label>
        <button className="phone-auth-submit" disabled type="button">
          Next
        </button>
      </form>
    </div>
  );
}
