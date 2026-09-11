import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  getAdminSignInHref,
  getSignedInAdminEmail,
} from "../../admin-auth";
import { getSignedInClerkUserFromHeaders } from "../../clerk-auth";
import {
  getCreatorApplication,
  getCreatorDashboardAccount,
} from "../../creator-onboarding";
import {
  getCreatorNotificationPreferences,
  listCreatorNotifications,
} from "../../notifications";
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

  const creatorAccount = await getSignedInCreatorAccount();

  if (creatorAccount) {
    return (
      <EditableCreatorProfilePreview
        initialNotificationPreferences={creatorAccount.notificationPreferences}
        initialNotifications={creatorAccount.notifications}
        initialProfile={getEditableCreatorProfile(creatorAccount.profile)}
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

async function getSignedInCreatorAccount() {
  const requestHeaders = await headers();
  const mutableHeaders = new Headers(requestHeaders);
  const user = await getSignedInClerkUserFromHeaders(
    mutableHeaders,
    requestUrlFromHeaders(mutableHeaders),
  );

  if (!user) {
    return null;
  }

  try {
    const account = await getCreatorDashboardAccount(user);

    if (!("profile" in account)) {
      return null;
    }

    const [notificationPreferences, notifications] = await Promise.all([
      getCreatorNotificationPreferences(account.profile.id),
      listCreatorNotifications(account.profile.id),
    ]);

    return {
      notificationPreferences: {
        bookingEmailEnabled: notificationPreferences.bookingEmailEnabled,
        bookingProfileEnabled: notificationPreferences.bookingProfileEnabled,
        bookingSmsEnabled: notificationPreferences.bookingSmsEnabled,
      },
      notifications: notifications.map((notification) => ({
        body: notification.body,
        bookingId: notification.bookingId,
        createdAt: notification.createdAt,
        id: notification.id,
        readAt: notification.readAt,
        title: notification.title,
        type: notification.type,
      })),
      profile: account.profile,
    };
  } catch {
    return null;
  }
}

function requestUrlFromHeaders(requestHeaders: Headers) {
  const host = requestHeaders.get("host") ?? "takeaseatwith.com";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  return `${protocol}://${host}/admin/creator-profile-editor-preview`;
}
