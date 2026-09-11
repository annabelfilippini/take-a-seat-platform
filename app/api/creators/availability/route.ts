import {
  canManageCreatorProfile,
  getCreatorAvailabilityInput,
  saveCreatorAvailability,
} from "../../../_lib/creator-onboarding";
import { getSignedInClerkUser } from "../../../_lib/clerk-auth";

function redirectWithAvailabilityStatus(
  request: Request,
  status: string,
  detail?: string,
  returnTo?: string | null,
) {
  const target = new URL(getSafeReturnTo(returnTo, "/creators/onboard"), request.url);
  target.searchParams.set("availability", status);

  if (detail) {
    target.searchParams.set("detail", detail);
  }

  return new Response(null, {
    headers: { location: target.toString() },
    status: 303,
  });
}

function availabilityStatusResponse(
  request: Request,
  status: string,
  detail?: string,
  returnTo?: string | null,
) {
  if (wantsJson(request)) {
    return Response.json(
      { detail: detail ?? null, status },
      { status: status === "saved" ? 200 : 400 },
    );
  }

  return redirectWithAvailabilityStatus(request, status, detail, returnTo);
}

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function getSafeReturnTo(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const input = getCreatorAvailabilityInput(formData);
  const returnTo = formData.get("returnTo");
  const safeReturnTo = typeof returnTo === "string" ? returnTo : null;

  if (!input) {
    return availabilityStatusResponse(
      request,
      "error",
      "availability-required",
      safeReturnTo,
    );
  }

  try {
    const user = await getSignedInClerkUser(request);
    const canManage = user
      ? await canManageCreatorProfile(input.creatorId, user)
      : false;

    if (!canManage) {
      return availabilityStatusResponse(
        request,
        "error",
        "creator-access",
        safeReturnTo,
      );
    }
  } catch {
    return availabilityStatusResponse(
      request,
      "setup-needed",
      "creator-auth",
      safeReturnTo,
    );
  }

  try {
    await saveCreatorAvailability(input);
  } catch {
    return availabilityStatusResponse(request, "setup-needed", "d1", safeReturnTo);
  }

  return availabilityStatusResponse(request, "saved", undefined, safeReturnTo);
}
