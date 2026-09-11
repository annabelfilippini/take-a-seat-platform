import type { Metadata } from "next";
import {
  getAdminSignInHref,
  getSignedInAdminEmail,
} from "../../admin-auth";
import { getCreatorApplication } from "../../creator-onboarding";
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

export default async function CreatorProfileEditorPreviewPage() {
  const adminEmail = await getSignedInAdminEmail();

  if (adminEmail) {
    const savedMockProfile = await getSavedAnnabelMockProfile();

    return (
      <EditableCreatorProfilePreview
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
