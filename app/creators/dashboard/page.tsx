import type { Metadata } from "next";
import { getSignedInCreatorEditorAccount } from "../../_lib/creator-dashboard";
import { EditableCreatorProfilePreview } from "../../admin/creator-profile-editor-preview/EditableCreatorProfilePreview";
import { getEditableCreatorProfile } from "../../admin/creator-profile-editor-preview/creator-profile-editor-data";

export const metadata: Metadata = {
  title: "Creator Dashboard | Take a Seat",
  description: "Manage a Take a Seat creator profile.",
};

export const dynamic = "force-dynamic";

export default async function CreatorDashboardPage() {
  const creatorAccount = await getSignedInCreatorEditorAccount();

  if (creatorAccount) {
    return (
      <EditableCreatorProfilePreview
        initialAvailabilityRules={creatorAccount.availabilityRules}
        initialNotificationPreferences={creatorAccount.notificationPreferences}
        initialNotifications={creatorAccount.notifications}
        initialProfile={getEditableCreatorProfile(creatorAccount.profile)}
      />
    );
  }

  return <CreatorDashboardAccess />;
}

function CreatorDashboardAccess() {
  return (
    <main className="admin-page">
      <section className="admin-shell admin-locked" aria-labelledby="locked-heading">
        <span>Creator dashboard</span>
        <h1 id="locked-heading">Sign in with your creator phone.</h1>
        <p>
          Accepted creators can manage their profile, availability, payments, and
          booking notifications here.
        </p>
        <a
          className="creator-apply-primary"
          href="/sign-in?redirect_url=%2Fcreators%2Fdashboard"
        >
          Sign in with phone
        </a>
        <a className="admin-back-link" href="/creators/onboard">
          Apply to inspire
        </a>
      </section>
    </main>
  );
}
