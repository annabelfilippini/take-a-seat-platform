import {
  createCreatorInvite,
  type CreatorOnboardingProfile,
} from "./creator-onboarding";
import {
  sendCreatorAcceptedEmail,
  type EmailResult,
} from "./email";
import { createCreatorEmailSignIn } from "./creator-email-sign-in";
import { isClerkConfigured } from "./clerk-auth";

export type CreatorAcceptedInviteEmailResult = EmailResult & {
  inviteToken?: string;
};

export async function sendCreatorAcceptedInviteEmail({
  profile,
  request,
}: {
  profile: CreatorOnboardingProfile;
  request: Request;
}): Promise<CreatorAcceptedInviteEmailResult> {
  if (profile.applicationStatus !== "accepted") {
    return { reason: "setup-link-failed", status: "skipped" };
  }
  if (!profile.email || !profile.email.includes("@")) {
    return { reason: "missing-recipient", status: "skipped" };
  }

  try {
    const signIn = isClerkConfigured() ? await createCreatorEmailSignIn(profile.email) : null;
    const invite = await createCreatorInvite(profile);
    const email = await sendCreatorAcceptedEmail({
      creatorId: profile.id,
      email: profile.email,
      emailNonce: invite.emailNonce,
      expiresAt: invite.expiresAt,
      inviteToken: invite.token,
      name: profile.name,
      request,
      signInToken: signIn?.token,
    });

    return { ...email, inviteToken: invite.token };
  } catch {
    return { reason: "setup-link-failed", status: "skipped" };
  }
}
