import { getCreatorById } from "../../../_lib/creators";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_OAUTH_NONCE_COOKIE = "tas_google_oauth_nonce";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events.owned",
];

type OAuthStatePayload = {
  creatorId: string;
  expiresAt: number;
  nonce: string;
  returnTo: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export { encryptToken } from "../../../_lib/token-encryption";
export { getRuntimeEnv } from "../../../_lib/runtime-env";
export { getSafeReturnTo } from "../../../_lib/safe-redirect";

// The callback must share the host that sets the nonce cookie. The canonical
// public site controls production; an old secret must not send users elsewhere.
export function getGoogleRedirectUri(request: Request) {
  const origin = new URL(request.url).origin;
  return `${origin}/api/google-calendar/oauth/callback`;
}

export function redirectWithCalendarStatus(
  request: Request,
  returnTo: string,
  status: string,
  detail?: string,
  headers?: Headers,
) {
  const target = new URL(returnTo, request.url);
  target.searchParams.set("calendar", status);

  if (detail) {
    target.searchParams.set("detail", detail);
  }

  return new Response(null, {
    headers: {
      ...(headers ? Object.fromEntries(headers) : {}),
      location: target.toString(),
    },
    status: 303,
  });
}

export function getCreatorFromQuery(url: URL) {
  const creatorId = url.searchParams.get("creatorId") ?? "";
  return getCreatorById(creatorId);
}

export function getCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));

  try { return match ? decodeURIComponent(match.slice(name.length + 1)) : null; } catch { return null; }
}

export function getNonceCookieHeader(request: Request, nonce: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${GOOGLE_OAUTH_NONCE_COOKIE}=${encodeURIComponent(
    nonce,
  )}; HttpOnly; Path=/api/google-calendar/oauth/callback; Max-Age=600; SameSite=Lax${secure}`;
}

export function getExpiredNonceCookieHeader() {
  return `${GOOGLE_OAUTH_NONCE_COOKIE}=; HttpOnly; Path=/api/google-calendar/oauth/callback; Max-Age=0; SameSite=Lax`;
}

export function createNonce() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createOAuthState(payload: OAuthStatePayload, secret: string) {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(body, secret);
  return `${body}.${signature}`;
}

export async function parseOAuthState(state: string, secret: string) {
  const [body, signature] = state.split(".");

  if (!body || !signature || signature !== (await sign(body, secret))) {
    return null;
  }

  try {
    const payload = JSON.parse(decoder.decode(base64UrlDecode(body))) as OAuthStatePayload;

    if (
      typeof payload.creatorId !== "string" ||
      typeof payload.returnTo !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt < Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function buildGoogleAuthorizationUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url;
}

async function sign(body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
