import { getSafeReturnTo } from "../../../_lib/safe-redirect";
import {
  canManageCreatorProfile,
  getCreatorProfileSettingsInput,
  getCreatorSettingsId,
  saveCreatorProfileSettings,
} from "../../../_lib/creator-onboarding";
import { getRequestAdminEmail } from "../../../_lib/admin-auth";
import { getSignedInClerkUser } from "../../../_lib/clerk-auth";
import { CREATOR_PROFILE_EDITOR_URL } from "../../../_lib/creator-destination";
import {
  sendCreatorApplicationEmail,
  sendCreatorApplicationReceivedEmail,
} from "../../../_lib/email";

function profileStatusResponse(
  request: Request,
  status: string,
  detail?: string,
  returnTo?: string | null,
  extraParams: Record<string, string> = {},
) {
  if (wantsJson(request)) {
    return Response.json(
      {
        detail: detail ?? null,
        status,
        ...extraParams,
      },
      { status: status === "saved" ? 200 : 400 },
    );
  }

  return redirectWithProfileStatus(request, status, detail, returnTo, extraParams);
}

function redirectWithProfileStatus(
  request: Request,
  status: string,
  detail?: string,
  returnTo?: string | null,
  extraParams: Record<string, string> = {},
) {
  const target = new URL(getSafeReturnTo(returnTo, "/creators/onboard"), request.url);
  target.searchParams.set("profile", status);

  if (detail) {
    target.searchParams.set("detail", detail);
  }

  for (const [key, value] of Object.entries(extraParams)) {
    target.searchParams.set(key, value);
  }

  return new Response(null, {
    headers: { location: target.toString() },
    status: 303,
  });
}

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const requestedCreatorId = getCreatorSettingsId(formData);
  const creatorId = requestedCreatorId ?? `onboard_${crypto.randomUUID()}`;
  const input = await getCreatorProfileSettingsInput(formData);
  const returnTo = formData.get("returnTo");

  if (!input || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return profileStatusResponse(
      request,
      "error",
      "profile-required",
      typeof returnTo === "string" ? returnTo : null,
    );
  }

  if (requestedCreatorId) {
    let canManage = false;

    try {
      const adminEmail = await getRequestAdminEmail(request);
      const user = adminEmail ? null : await getSignedInClerkUser(request);
      canManage = Boolean(adminEmail) || (user
        ? await canManageCreatorProfile(requestedCreatorId, user)
        : false);
    } catch {
      return profileStatusResponse(
        request,
        "setup-needed",
        "creator-auth",
        typeof returnTo === "string" ? returnTo : null,
      );
    }

    if (!canManage) {
      return profileStatusResponse(
        request,
        "error",
        "creator-access",
        CREATOR_PROFILE_EDITOR_URL,
      );
    }
  }

  try {
    await saveCreatorProfileSettings(creatorId, input);
  } catch {
    return profileStatusResponse(
      request,
      "setup-needed",
      "d1",
      typeof returnTo === "string" ? returnTo : null,
    );
  }

  if (input.reviewSubmitted) {
    const [adminEmail, creatorEmail] = await Promise.all([
      sendCreatorApplicationEmail({
        creatorId,
        input,
        request,
      }),
      sendCreatorApplicationReceivedEmail({
        creatorId,
        input,
      }),
    ]);

    return profileStatusResponse(request, "saved", undefined, null, {
      creatorEmail: creatorEmail.status,
      ...(creatorEmail.status === "skipped"
        ? { creatorEmailDetail: creatorEmail.reason }
        : {}),
      email: adminEmail.status,
      ...(adminEmail.status === "skipped"
        ? { emailDetail: adminEmail.reason }
        : {}),
    });
  }

  return profileStatusResponse(
    request,
    "saved",
    undefined,
    typeof returnTo === "string" ? returnTo : null,
  );
}
