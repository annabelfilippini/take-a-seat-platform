import { getCreatorNotificationPreferences, listCreatorNotifications } from "../../_lib/notifications";
import type { Metadata } from "next";
import {
  getAdminSignInHref,
  getSignedInAdminEmail,
} from "../../_lib/admin-auth";
import { getCreatorApplication, listCreatorAvailabilityRules } from "../../_lib/creator-onboarding";
import { CreatorProfileEditorAccess } from "./CreatorProfileEditorAccess";
import { EditableCreatorProfilePreview } from "./EditableCreatorProfilePreview";
import {
  annabelMockProfile,
  getEditableCreatorProfile,
} from "./creator-profile-editor-data";

export const metadata: Metadata = {
  title: "Creator Profile Editor Preview | Take a Seat",
  description: "Preview the editable creator profile setup form.",
};

export const dynamic = "force-dynamic";

export default async function CreatorProfileEditorPreviewPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const adminEmail = await getSignedInAdminEmail();

  if (adminEmail) {
    const savedMockProfile = await getSavedAnnabelMockProfile();

    return (
      <EditableCreatorProfilePreview
        initialNotificationPreferences={savedMockProfile ? await getCreatorNotificationPreferences(savedMockProfile.id) : undefined}
        initialNotifications={savedMockProfile ? await listCreatorNotifications(savedMockProfile.id) : []}
        initialAvailabilityRules={savedMockProfile ? await listCreatorAvailabilityRules(savedMockProfile.id) : []}
        calendarStatus={typeof searchParams?.calendar === "string" ? searchParams.calendar : undefined}
        stripeStatus={typeof searchParams?.stripe === "string" ? searchParams.stripe : undefined}
        initialProfile={
          savedMockProfile
            ? getEditableCreatorProfile(savedMockProfile)
            : annabelMockProfile
        }
      />
    );
  }

  const adminSignInHref = await getAdminSignInHref(
    "/admin/creator-profile-editor-preview",
  );

  return <CreatorProfileEditorAccess adminSignInHref={adminSignInHref} />;
}

async function getSavedAnnabelMockProfile() {
  try {
    return await getCreatorApplication(annabelMockProfile.id);
  } catch {
    return null;
  }
}
