"use client";

import { useEffect, useState } from "react";
import type { CreatorOnboardingProfile } from "../../creator-onboarding";
import {
  EditableCreatorProfilePreview,
  type EditableCreatorNotification,
  type EditableNotificationPreferences,
} from "./EditableCreatorProfilePreview";
import { getEditableCreatorProfile } from "./creator-profile-editor-data";

type CreatorAccountResponse = {
  notificationPreferences?: EditableNotificationPreferences;
  notifications?: EditableCreatorNotification[];
  profile?: CreatorOnboardingProfile;
  status?: unknown;
};

export function CreatorProfileEditorAccess({
  adminSignInHref,
}: {
  adminSignInHref: string;
}) {
  const [account, setAccount] = useState<CreatorAccountResponse | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/creators/account", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((nextAccount: CreatorAccountResponse | null) => {
        if (isMounted) {
          setAccount(nextAccount);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAccount(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsChecking(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (
    account?.profile &&
    (account.status === "linked" || account.status === "matched")
  ) {
    return (
      <EditableCreatorProfilePreview
        initialProfile={getEditableCreatorProfile(account.profile)}
        initialNotificationPreferences={account.notificationPreferences}
        initialNotifications={account.notifications}
      />
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-shell admin-locked" aria-labelledby="locked-heading">
        <span>Creator access</span>
        <h1 id="locked-heading">
          {isChecking ? "Checking your creator profile." : "Sign in with your creator phone."}
        </h1>
        <p>
          Accepted creators can open this editor with the phone number or email tied
          to their profile.
        </p>
        <a
          className="creator-apply-primary"
          href="/sign-in?redirect_url=%2Fadmin%2Fcreator-profile-editor-preview"
        >
          Sign in with phone
        </a>
        <a className="admin-back-link" href={adminSignInHref}>
          Admin sign in
        </a>
      </section>
    </main>
  );
}
