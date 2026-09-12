import type { Metadata } from "next";
import { SignInClerkScreen } from "../../_components/SignInClerkScreen";
import { getClerkPublishableKey } from "../../_lib/clerk-auth";
import { getSignedInCreatorEditorAccount } from "../../_lib/creator-dashboard";
import { EditableCreatorProfilePreview } from "../../admin/creator-profile-editor-preview/EditableCreatorProfilePreview";
import { getEditableCreatorProfile } from "../../admin/creator-profile-editor-preview/creator-profile-editor-data";

export const metadata: Metadata = {
  title: "Creator Dashboard | Take a Seat",
  description: "Manage a Take a Seat creator profile.",
};

export const dynamic = "force-dynamic";

type CreatorDashboardPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function CreatorDashboardPage({
  searchParams,
}: CreatorDashboardPageProps) {
  const inviteToken = getInviteToken(searchParams?.invite);
  const requestPath = inviteToken
    ? `/creators/dashboard?invite=${encodeURIComponent(inviteToken)}`
    : "/creators/dashboard";
  const creatorAccount = await getSignedInCreatorEditorAccount(
    requestPath,
    inviteToken,
  );

  if (creatorAccount?.profile) {
    return (
      <EditableCreatorProfilePreview
        initialAvailabilityRules={creatorAccount.availabilityRules}
        initialNotificationPreferences={creatorAccount.notificationPreferences}
        initialNotifications={creatorAccount.notifications}
        initialProfile={getEditableCreatorProfile(creatorAccount.profile)}
      />
    );
  }

  return (
    <CreatorDashboardAccess
      accessError={creatorAccount && "accessError" in creatorAccount ? creatorAccount.accessError : undefined}
      inviteToken={inviteToken}
      isStripeReturn={hasStripeReturn(searchParams?.stripe)}
    />
  );
}

function CreatorDashboardAccess({
  accessError,
  inviteToken,
  isStripeReturn,
}: {
  accessError?: string;
  inviteToken: string | null;
  isStripeReturn: boolean;
}) {
  const redirectUrl = inviteToken
    ? `/creators/dashboard?invite=${encodeURIComponent(inviteToken)}`
    : "/creators/dashboard";
  const heading = isStripeReturn
    ? "You're almost done. Sign in to return to your creator dashboard."
    : "Sign in to build your profile.";
  const description = isStripeReturn
    ? "Use the email address from your accepted creator application and we will email you a verification code."
    : "Accepted creators can manage their profile, availability, payments, and booking notifications here.";
  const clerkPublishableKey = getClerkPublishableKey();

  return (
    <main className="admin-page">
      <section className="admin-shell admin-locked" aria-labelledby="locked-heading">
        <span>Creator dashboard</span>
        <h1 id="locked-heading">{heading}</h1>
        <p>{description}</p>
        {accessError ? <p role="alert">{accessError}</p> : null}
        {clerkPublishableKey ? (
          <SignInClerkScreen
            allowSignUpIfMissing
            className="creator-phone-auth-widget"
            codeHeading="Enter your verification code."
            redirectUrl={redirectUrl}
            routeByAccount={!inviteToken}
            submitLabel="Send verification code"
          />
        ) : (
          <CreatorDashboardStaticPhoneForm />
        )}
        <a className="admin-back-link" href="/creators/onboard">
          Apply to inspire
        </a>
      </section>
    </main>
  );
}

function CreatorDashboardStaticPhoneForm() {
  return (
    <div className="creator-phone-auth-widget">
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
          Send verification code
        </button>
      </form>
    </div>
  );
}

function getInviteToken(value: string | string[] | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasStripeReturn(value: string | string[] | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}
