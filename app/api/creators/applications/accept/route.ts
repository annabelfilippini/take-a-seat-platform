import { getRequestAdminEmail } from "../../../../_lib/admin-auth";
import {
  acceptCreatorApplication,
  createCreatorInvite,
  CreatorPublishError,
  normalizeCreatorPublicId,
} from "../../../../_lib/creator-onboarding";
import {
  sendCreatorAcceptedEmail,
  sendCreatorAcceptedSms,
} from "../../../../_lib/email";
import { createCreatorAcceptedNotification } from "../../../../_lib/notifications";

function redirectTo(request: Request, path: string, params: Record<string, string>) {
  const target = new URL(path, request.url);

  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }

  return new Response(null, {
    headers: { location: target.toString() },
    status: 303,
  });
}

export async function POST(request: Request) {
  const adminEmail = await getRequestAdminEmail(request);

  if (!adminEmail) {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const creatorId = formData.get("creatorId");
  const publicCreatorId = formData.get("publicCreatorId");

  if (typeof creatorId !== "string" || !creatorId.trim()) {
    return redirectTo(request, "/admin/applications", {
      accept: "error",
      detail: "creator-required",
    });
  }

  const normalizedPublicCreatorId =
    typeof publicCreatorId === "string"
      ? normalizeCreatorPublicId(publicCreatorId)
      : null;

  if (typeof publicCreatorId === "string" && publicCreatorId.trim() && !normalizedPublicCreatorId) {
    return redirectTo(request, `/admin/applications/${creatorId}`, {
      accept: "error",
      detail: "public-id-invalid",
    });
  }

  try {
    const profile = await acceptCreatorApplication(
      creatorId,
      normalizedPublicCreatorId,
    );

    if (!profile) {
      return redirectTo(request, "/admin/applications", {
        accept: "error",
        detail: "not-found",
      });
    }

    let emailStatus: "sent" | "skipped" = "skipped";
    let emailDetail: string | null = null;
    let smsStatus: "sent" | "skipped" = "skipped";
    let smsDetail: string | null = null;
    let profileNotificationStatus: "sent" | "skipped" = "skipped";
    let invite:
      | Awaited<ReturnType<typeof createCreatorInvite>>
      | null = null;

    if (profile.email && profile.email.includes("@")) {
      invite = await createCreatorInvite(profile);
      const email = await sendCreatorAcceptedEmail({
        creatorId: profile.id,
        email: profile.email,
        emailNonce: invite.emailNonce,
        expiresAt: invite.expiresAt,
        inviteToken: invite.token,
        name: profile.name,
        request,
      });
      emailStatus = email.status;
      emailDetail = email.status === "skipped" ? email.reason : null;
    }

    if (profile.phone) {
      const sms = await sendCreatorAcceptedSms({
        inviteToken: invite?.token,
        name: profile.name,
        request,
        to: profile.phone,
      });
      smsStatus = sms.status;
      smsDetail = sms.status === "skipped" ? sms.reason : null;
    }

    await createCreatorAcceptedNotification({
      creatorId: profile.id,
      creatorName: profile.name,
    });
    profileNotificationStatus = "sent";

    return redirectTo(request, `/admin/applications/${profile.id}`, {
      accept: "accepted",
      email: emailStatus,
      ...(emailDetail ? { emailDetail } : {}),
      profile: profileNotificationStatus,
      sms: smsStatus,
      ...(smsDetail ? { smsDetail } : {}),
    });
  } catch (error) {
    if (error instanceof CreatorPublishError) {
      return redirectTo(request, `/admin/applications/${creatorId}`, {
        accept: "error",
        detail: error.code,
      });
    }

    return redirectTo(request, "/admin/applications", {
      accept: "setup-needed",
      detail: "d1",
    });
  }
}
