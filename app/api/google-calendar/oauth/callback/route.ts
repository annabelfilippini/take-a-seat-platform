import { getCalendarOwner, consumeCalendarAttempt } from "../../../../_lib/calendar-oauth-security";
import { readGoogleBusyPeriods } from "../../../../_lib/google-calendar";
import { creatorCalendarConnections } from "../../../../../db/schema";
import { markCalendarConnected } from "../../../../_lib/creator-onboarding";
import {
  encryptToken,
  getCookie,
  getExpiredNonceCookieHeader,
  getRuntimeEnv,
  getGoogleRedirectUri,
  GOOGLE_CALENDAR_SCOPES,
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_TOKEN_URL,
  parseOAuthState,
  redirectWithCalendarStatus,
} from "../shared";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = getRuntimeEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getRuntimeEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = getGoogleRedirectUri(request);
  const clearNonceHeaders = new Headers({
    "set-cookie": getExpiredNonceCookieHeader(),
  });

  if (!clientId || !clientSecret || !redirectUri) {
    return redirectWithCalendarStatus(
      request,
      "/creators/onboard",
      "setup-needed",
      "google-oauth",
      clearNonceHeaders,
    );
  }

  const state = url.searchParams.get("state");
  const payload = state ? await parseOAuthState(state, clientSecret) : null;
  const returnTo = payload?.returnTo ?? "/creators/onboard";

  if (!payload) {
    return redirectWithCalendarStatus(
      request,
      returnTo,
      "error",
      "invalid-state",
      clearNonceHeaders,
    );
  }

  if (getCookie(request, GOOGLE_OAUTH_NONCE_COOKIE) !== payload.nonce) {
    return redirectWithCalendarStatus(
      request,
      returnTo,
      "error",
      "state-cookie",
      clearNonceHeaders,
    );
  }

  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectWithCalendarStatus(
      request,
      returnTo,
      "cancelled",
      "access-denied",
      clearNonceHeaders,
    );
  }

  const code = url.searchParams.get("code");

  if (!code) {
    return redirectWithCalendarStatus(
      request,
      returnTo,
      "error",
      "missing-code",
      clearNonceHeaders,
    );
  }

  const actorId = await getCalendarOwner(request, payload.creatorId);
  if (!actorId) return redirectWithCalendarStatus(request, returnTo, "error", "creator-access", clearNonceHeaders);

  try {
    if (!await consumeCalendarAttempt(payload.nonce, payload.creatorId, actorId)) {
      return redirectWithCalendarStatus(request, returnTo, "error", "used-state", clearNonceHeaders);
    }
    const token = await exchangeCodeForToken({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });

    if (!token.access_token || !token.expires_in) {
      return redirectWithCalendarStatus(
        request,
        returnTo,
        "error",
        "invalid-token-response",
        clearNonceHeaders,
      );
    }

    if (!token.scope || GOOGLE_CALENDAR_SCOPES.some((scope) => !token.scope!.split(" ").includes(scope))) {
      return redirectWithCalendarStatus(request, returnTo, "error", "calendar-permissions", clearNonceHeaders);
    }

    // Never retain a previous Google account's refresh token on reconnect.
    if (!token.refresh_token) return redirectWithCalendarStatus(request, returnTo, "error", "offline-access", clearNonceHeaders);
    await readGoogleBusyPeriods({ accessToken: token.access_token, calendarId: "primary" }, new Date(), new Date(Date.now() + 60_000));
    const tokenEncryptionSecret = getRuntimeEnv("GOOGLE_TOKEN_ENCRYPTION_KEY") ?? clientSecret;
    const now = new Date();
    const expiresAt = new Date(Date.now() + token.expires_in * 1000);
    const encryptedAccessToken = await encryptToken(
      token.access_token,
      tokenEncryptionSecret,
    );
    const encryptedRefreshToken = token.refresh_token
      ? await encryptToken(token.refresh_token, tokenEncryptionSecret)
      : null;
    const { getDb } = await import("../../../../../db");
    const db = getDb();

    await db
      .insert(creatorCalendarConnections)
      .values({
        accessTokenEncrypted: encryptedAccessToken,
        calendarId: "primary",
        connectedAt: now.toISOString(),
        creatorId: payload.creatorId,
        expiresAt,
        provider: "google",
        refreshTokenEncrypted: encryptedRefreshToken,
        scopes: token.scope ?? GOOGLE_CALENDAR_SCOPES.join(" "),
        tokenType: token.token_type ?? "Bearer",
        updatedAt: now.toISOString(),
      })
      .onConflictDoUpdate({
        set: {
          accessTokenEncrypted: encryptedAccessToken,
          expiresAt,
          refreshTokenEncrypted: encryptedRefreshToken,
          calendarId: "primary",
          connectedAt: now.toISOString(),
          scopes: token.scope ?? GOOGLE_CALENDAR_SCOPES.join(" "),
          tokenType: token.token_type ?? "Bearer",
          updatedAt: now.toISOString(),
        },
        target: [
          creatorCalendarConnections.creatorId,
          creatorCalendarConnections.provider,
        ],
      });
    await markCalendarConnected(payload.creatorId);

    return redirectWithCalendarStatus(
      request,
      returnTo,
      "connected",
      undefined,
      clearNonceHeaders,
    );
  } catch {
    return redirectWithCalendarStatus(
      request,
      returnTo,
      "error",
      "google-token",
      clearNonceHeaders,
    );
  }
}

async function exchangeCodeForToken({
  clientId,
  clientSecret,
  code,
  redirectUri,
}: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error("Google token exchange failed.");
  return (await response.json()) as GoogleTokenResponse;
}
