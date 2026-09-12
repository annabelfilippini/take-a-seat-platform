import { getRequestAdminEmail } from "../../../../_lib/admin-auth";
import { sendCreatorAcceptedInviteEmail } from "../../../../_lib/creator-accepted-invite";
import { getCreatorApplication } from "../../../../_lib/creator-onboarding";

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

  if (typeof creatorId !== "string" || !creatorId.trim()) {
    return redirectTo(request, "/admin/applications", {
      detail: "creator-required",
      inviteEmail: "error",
    });
  }

  const returnPath = `/admin/applications/${encodeURIComponent(creatorId)}`;

  try {
    const profile = await getCreatorApplication(creatorId);

    if (!profile) {
      return redirectTo(request, "/admin/applications", {
        detail: "not-found",
        inviteEmail: "error",
      });
    }

    if (profile.applicationStatus !== "accepted") {
      return redirectTo(request, returnPath, {
        detail: "not-accepted",
        inviteEmail: "error",
      });
    }

    const email = await sendCreatorAcceptedInviteEmail({ profile, request });

    return redirectTo(request, returnPath, {
      inviteEmail: email.status,
      ...(email.status === "skipped" ? { inviteEmailDetail: email.reason } : {}),
    });
  } catch {
    return redirectTo(request, returnPath, {
      detail: "d1",
      inviteEmail: "error",
    });
  }
}
