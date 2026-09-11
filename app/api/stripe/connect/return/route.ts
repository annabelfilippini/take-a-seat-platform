import {
  getCreatorOnboardingProfileId,
  markStripeConnected,
} from "../../../../_lib/creator-onboarding";
import {
  markCreatorStripeReturned,
} from "../../../../_lib/stripe-connect";

function getSafeReturnTo(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function redirectWithStripeStatus(
  request: Request,
  returnTo: string,
  status: string,
  detail?: string,
) {
  const target = new URL(returnTo, request.url);
  target.searchParams.set("stripe", status);

  if (detail) {
    target.searchParams.set("detail", detail);
  }

  return new Response(null, {
    headers: { location: target.toString() },
    status: 303,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = getSafeReturnTo(
    url.searchParams.get("returnTo"),
    "/creators/onboard",
  );
  const creatorId = getCreatorOnboardingProfileId(url) ?? url.searchParams.get("creatorId");

  if (!creatorId) {
    return redirectWithStripeStatus(request, returnTo, "error", "profile-required");
  }

  try {
    await Promise.all([
      markCreatorStripeReturned(creatorId),
      markStripeConnected(creatorId),
    ]);
  } catch {
    return redirectWithStripeStatus(request, returnTo, "setup-needed", "d1");
  }

  return redirectWithStripeStatus(request, returnTo, "connected");
}
