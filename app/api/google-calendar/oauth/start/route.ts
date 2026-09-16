import {
  buildGoogleAuthorizationUrl,
  createNonce,
  createOAuthState,
  getCreatorFromQuery,
  getNonceCookieHeader,
  getRuntimeEnv,
  getGoogleRedirectUri,
  getSafeReturnTo,
  redirectWithCalendarStatus,
} from "../shared";
import {
  getCreatorOnboardingProfileId,
} from "../../../../_lib/creator-onboarding";
import { getCalendarOwner, saveCalendarAttempt } from "../../../../_lib/calendar-oauth-security";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const creator = getCreatorFromQuery(url);
  const fallbackReturnTo = creator ? `/with/${creator.slug}` : "/creators/onboard";
  const returnTo = getSafeReturnTo(url.searchParams.get("returnTo"), fallbackReturnTo);

  const clientId = getRuntimeEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getRuntimeEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = getGoogleRedirectUri(request);

  if (!clientId || !clientSecret || !redirectUri) {
    return redirectWithCalendarStatus(request, returnTo, "setup-needed", "google-oauth");
  }

  let creatorId = creator?.id ?? null;

  if (!creatorId) {
    const onboardingProfileId = getCreatorOnboardingProfileId(url);

    if (onboardingProfileId) {
      creatorId = onboardingProfileId;
    } else {
      return redirectWithCalendarStatus(request, returnTo, "error", "profile-required");
    }
  }

  const actorId = await getCalendarOwner(request, creatorId);
  if (!actorId) return redirectWithCalendarStatus(request, returnTo, "error", "creator-access");

  const nonce = createNonce();
  await saveCalendarAttempt(nonce, creatorId, actorId);
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
