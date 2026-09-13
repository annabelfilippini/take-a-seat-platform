import { getSafeReturnTo } from "../../../../_lib/safe-redirect";
import {
  getCreatorOnboardingProfileId,
  markStripeConnected,
} from "../../../../_lib/creator-onboarding";
import { getCreatorIntegrationAccess } from "../../../../_lib/creator-access";
import {
  getConnectedAccountTransferStatus,
  getCreatorStripeConnection,
  getStripeSecretKey,
  markCreatorStripeReturned,
} from "../../../../_lib/stripe-connect";

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

  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    return redirectWithStripeStatus(request, returnTo, "setup-needed", "stripe-secret");
  }

  const access = await getCreatorIntegrationAccess(request, creatorId);

  if (access.status !== "allowed") {
    const status = access.detail === "creator-auth" ? "setup-needed" : "error";
    return redirectWithStripeStatus(request, returnTo, status, access.detail);
  }

  let stripeAccountId: string | null = null;

  try {
    const connection = await getCreatorStripeConnection(creatorId);
    stripeAccountId = connection?.stripeAccountId ?? null;
  } catch {
    return redirectWithStripeStatus(request, returnTo, "setup-needed", "d1");
  }

  if (!stripeAccountId) {
    return redirectWithStripeStatus(request, returnTo, "setup-needed", "stripe-connect");
  }

  try {
    const transferStatus = await getConnectedAccountTransferStatus({
      accountId: stripeAccountId,
      secretKey,
    });

    if (transferStatus !== "active") {
      return redirectWithStripeStatus(
        request,
        returnTo,
        "setup-needed",
        "stripe-transfers",
      );
    }
  } catch {
    return redirectWithStripeStatus(
      request,
      returnTo,
      "setup-needed",
      "stripe-transfers",
    );
  }

  try {
    await markCreatorStripeReturned(creatorId);
    await markStripeConnected(creatorId);
  } catch {
    return redirectWithStripeStatus(request, returnTo, "setup-needed", "d1");
  }

  return redirectWithStripeStatus(request, returnTo, "connected");
}
