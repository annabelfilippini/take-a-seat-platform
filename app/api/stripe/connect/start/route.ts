import {
  createCreatorOnboardingProfile,
  getCreatorApplication,
  getCreatorOnboardingInput,
  getCreatorOnboardingProfileId,
} from "../../../../_lib/creator-onboarding";
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

function getSafeReturnTo(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
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

  const input = getCreatorOnboardingInput(url);
  const onboardingProfileId = getCreatorOnboardingProfileId(url);
  let creatorId = creator?.id ?? onboardingProfileId;
  let displayName = creator?.name ?? input?.name ?? "Take a Seat creator";
  let contactEmail = input?.email ?? null;

  if (!creatorId && !input) {
    return redirectWithStripeStatus(request, returnTo, "error", "profile-required");
  }

  if (!creatorId && input) {
    try {
      creatorId = await createCreatorOnboardingProfile(input, onboardingProfileId);
      displayName = input.name;
    } catch {
      return redirectWithStripeStatus(request, returnTo, "setup-needed", "d1");
    }
  } else if (creatorId && input && creatorId.startsWith("onboard_")) {
    try {
      creatorId = await createCreatorOnboardingProfile(input, creatorId);
      displayName = input.name;
    } catch {
      return redirectWithStripeStatus(request, returnTo, "setup-needed", "d1");
    }
  }

  if (!creatorId) {
    return redirectWithStripeStatus(request, returnTo, "error", "profile-required");
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
    const account =
      existingConnection ??
      (await createConnectedAccount({
        contactEmail,
        country,
        creatorId,
        displayName,
        secretKey,
      }));
    const stripeAccountId =
      "stripeAccountId" in account ? account.stripeAccountId : account.id;
    const livemode = Boolean("livemode" in account ? account.livemode : false);

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
