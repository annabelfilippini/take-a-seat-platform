import { getSafeReturnTo } from "../../../../_lib/safe-redirect";
import {
  getCreatorApplication,
  getCreatorOnboardingProfileId,
} from "../../../../_lib/creator-onboarding";
import { getCreatorIntegrationAccess } from "../../../../_lib/creator-access";
import { getCreatorById } from "../../../../_lib/creators";
import {
  buildStripeReturnUrl,
  createAccountOnboardingLink,
  createConnectedAccount,
  getConnectCountry,
  getCreatorStripeConnection,
  getStripeSecretKey,
  saveCreatorStripeConnection,
  StripeConnectError,
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
  const creator = getCreatorById(url.searchParams.get("creatorId") ?? "");
  const returnTo = getSafeReturnTo(
    url.searchParams.get("returnTo"),
    creator ? `/with/${creator.slug}` : "/creators/onboard",
  );
  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    return redirectWithStripeStatus(request, returnTo, "setup-needed", "stripe-secret");
  }

  const onboardingProfileId = getCreatorOnboardingProfileId(url);
  const creatorId = creator?.id ?? onboardingProfileId;
  let displayName = creator?.name ?? "Take a Seat creator";
  let contactEmail = null;

  if (!creatorId) {
    return redirectWithStripeStatus(request, returnTo, "error", "profile-required");
  }

  const access = await getCreatorIntegrationAccess(request, creatorId);

  if (access.status !== "allowed") {
    const status = access.detail === "creator-auth" ? "setup-needed" : "error";
    return redirectWithStripeStatus(request, returnTo, status, access.detail);
  }

  const country = getConnectCountry();

  try {
    if (!contactEmail) {
      const profile = await getCreatorApplication(creatorId);
      contactEmail = profile?.email ?? null;
      displayName = profile?.name ?? displayName;
    }

    if (!contactEmail) {
      return redirectWithStripeStatus(
        request,
        returnTo,
        "error",
        "creator-email-required",
      );
    }

    const existingConnection = await getCreatorStripeConnection(creatorId);
    const createdAccount = existingConnection ? null : await createConnectedAccount({
      contactEmail, country, creatorId, displayName, secretKey,
    });
    const stripeAccountId = existingConnection?.stripeAccountId ?? createdAccount!.id;
    const livemode = existingConnection?.livemode ?? createdAccount!.livemode;

    if (!existingConnection) {
      await saveCreatorStripeConnection({
        accountCountry: country,
        creatorId,
        dashboard: "express",
        livemode,
        stripeAccountId,
      });
    }

    const accountLink = await createAccountOnboardingLink({
      accountId: stripeAccountId,
      refreshUrl: buildStripeReturnUrl(
        request,
        "/api/stripe/connect/start",
        creatorId,
        returnTo,
      ),
      returnUrl: buildStripeReturnUrl(
        request,
        "/api/stripe/connect/return",
        creatorId,
        returnTo,
      ),
      secretKey,
    });

    return new Response(null, {
      headers: { location: accountLink.url },
      status: 303,
    });
  } catch (error) {
    const detail =
      error instanceof StripeConnectError && error.code
        ? error.code
        : "stripe-connect";

    return redirectWithStripeStatus(request, returnTo, "setup-needed", detail);
  }
}
