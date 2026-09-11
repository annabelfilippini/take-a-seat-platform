import {
  buildGoogleAuthorizationUrl,
  createNonce,
  createOAuthState,
  getCreatorFromQuery,
  getNonceCookieHeader,
  getRuntimeEnv,
  getSafeReturnTo,
  redirectWithCalendarStatus,
} from "../shared";
import {
  createCreatorOnboardingProfile,
  getCreatorOnboardingInput,
  getCreatorOnboardingProfileId,
} from "../../../../creator-onboarding";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const creator = getCreatorFromQuery(url);
  const fallbackReturnTo = creator ? `/with/${creator.slug}` : "/creators/onboard";
  const returnTo = getSafeReturnTo(url.searchParams.get("returnTo"), fallbackReturnTo);

  const clientId = getRuntimeEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getRuntimeEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = getRuntimeEnv("GOOGLE_OAUTH_REDIRECT_URI");

  if (!clientId || !clientSecret || !redirectUri) {
    return redirectWithCalendarStatus(request, returnTo, "setup-needed", "google-oauth");
  }

  let creatorId = creator?.id ?? null;

  if (!creatorId) {
    const onboardingProfileId = getCreatorOnboardingProfileId(url);
    const input = getCreatorOnboardingInput(url);

    if (input) {
      try {
        creatorId = await createCreatorOnboardingProfile(input, onboardingProfileId);
      } catch {
        return redirectWithCalendarStatus(request, returnTo, "setup-needed", "d1");
      }
    } else if (onboardingProfileId) {
      creatorId = onboardingProfileId;
    } else {
      return redirectWithCalendarStatus(request, returnTo, "error", "profile-required");
    }
  }

  const nonce = createNonce();
  const state = await createOAuthState(
    {
      creatorId,
      expiresAt: Date.now() + 10 * 60 * 1000,
      nonce,
      returnTo,
    },
    clientSecret,
  );
  const headers = new Headers({
    location: buildGoogleAuthorizationUrl({
      clientId,
      redirectUri,
      state,
    }).toString(),
    "set-cookie": getNonceCookieHeader(request, nonce),
  });

  return new Response(null, { headers, status: 303 });
}
