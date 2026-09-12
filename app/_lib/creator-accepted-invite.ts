import {
  createCreatorInvite,
  type CreatorOnboardingProfile,
} from "./creator-onboarding";
import {
  sendCreatorAcceptedEmail,
  type EmailResult,
} from "./email";

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
  if (!profile.email || !profile.email.includes("@")) {
    return { reason: "missing-recipient", status: "skipped" };
  }

  try {
    const invite = await createCreatorInvite(profile);
    const email = await sendCreatorAcceptedEmail({
      creatorId: profile.id,
      email: profile.email,
      emailNonce: invite.emailNonce,
      expiresAt: invite.expiresAt,
      inviteToken: invite.token,
      name: profile.name,
      request,
    });

    return { ...email, inviteToken: invite.token };
  } catch {
    return { reason: "setup-link-failed", status: "skipped" };
  }
}
