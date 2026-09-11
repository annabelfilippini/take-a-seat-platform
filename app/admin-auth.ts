import { headers } from "next/headers";
import { getSignedInClerkUser, normalizePhoneIdentity } from "./clerk-auth";

export const DEFAULT_ADMIN_EMAIL = "annabelflip1@gmail.com";
export const LOCAL_ADMIN_COOKIE = "tas_local_admin";

const LOCAL_ADMIN_COOKIE_VALUE = "1";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";

export function getAdminEmails() {
  const configured = process.env.TAKE_A_SEAT_ADMIN_EMAILS;
  const emails = configured
    ? configured.split(",").map((email) => email.trim().toLowerCase())
    : [DEFAULT_ADMIN_EMAIL];

  return new Set(emails.filter(Boolean));
}

export function getAdminPhones() {
  const configured = process.env.TAKE_A_SEAT_ADMIN_PHONES;
  const phones = configured
    ? configured.split(",").map((phone) => normalizePhoneIdentity(phone))
    : [];

  return new Set(phones.filter(Boolean));
}

export function isTakeASeatAdminEmail(email: string | null | undefined) {
  return Boolean(email && getAdminEmails().has(email.toLowerCase()));
}

export function isTakeASeatAdminPhone(phone: string | null | undefined) {
  const normalizedPhone = normalizePhoneIdentity(phone);

  return Boolean(normalizedPhone && getAdminPhones().has(normalizedPhone));
}

export function isLocalAdminDevEnabled() {
  return process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED === "true";
}

export async function getSignedInAdminEmail() {
  const requestHeaders = await headers();
  const headerEmail = requestHeaders.get(USER_EMAIL_HEADER);
  const mutableHeaders = new Headers(requestHeaders);

  if (isTakeASeatAdminEmail(headerEmail)) {
    return headerEmail;
  }

  if (isLocalAdminRequest(mutableHeaders)) {
    return DEFAULT_ADMIN_EMAIL;
  }

  const url = requestUrlFromHeaders(mutableHeaders);
  const user = await getSignedInClerkUser(
    new Request(url, { headers: mutableHeaders }),
  );

  if (isTakeASeatAdminEmail(user?.email) || isTakeASeatAdminPhone(user?.phone)) {
    return user?.email ?? DEFAULT_ADMIN_EMAIL;
  }

  return null;
}

export async function getRequestAdminEmail(request: Request) {
  const headerEmail = request.headers.get(USER_EMAIL_HEADER);

  if (isTakeASeatAdminEmail(headerEmail)) {
    return headerEmail;
  }

  if (isLocalAdminRequest(request.headers, request.url)) {
    return DEFAULT_ADMIN_EMAIL;
  }

  const user = await getSignedInClerkUser(request);

  if (isTakeASeatAdminEmail(user?.email) || isTakeASeatAdminPhone(user?.phone)) {
    return user?.email ?? DEFAULT_ADMIN_EMAIL;
  }

  return null;
}

export async function getAdminSignInHref(returnTo: string) {
  const requestHeaders = await headers();
  const safeReturnTo = getSafeReturnTo(returnTo);

  if (isLocalAdminDevEnabled() && isLocalhostRequest(new Headers(requestHeaders))) {
    return `/api/admin/dev-login?returnTo=${encodeURIComponent(safeReturnTo)}`;
  }

  return `/sign-in?redirect_url=${encodeURIComponent(safeReturnTo)}`;
}

export function getLocalAdminCookie() {
  return `${LOCAL_ADMIN_COOKIE}=${LOCAL_ADMIN_COOKIE_VALUE}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`;
}

export function isLocalAdminRequest(
  requestHeaders: Headers,
  requestUrl?: string,
) {
  if (!isLocalAdminDevEnabled()) {
    return false;
  }

  if (!isLocalhostRequest(requestHeaders, requestUrl)) {
    return false;
  }

  return parseCookie(requestHeaders.get("cookie")).get(LOCAL_ADMIN_COOKIE) ===
    LOCAL_ADMIN_COOKIE_VALUE;
}

export function isLocalhostRequest(requestHeaders: Headers, requestUrl?: string) {
  const hostname = getRequestHostname(requestHeaders, requestUrl);

  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function requestUrlFromHeaders(requestHeaders: Headers) {
  const host = requestHeaders.get("host") ?? "takeaseatwith.com";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  return `${protocol}://${host}/admin/applications`;
}

function getSafeReturnTo(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/admin/applications";
  }

  return value;
}

function getRequestHostname(requestHeaders: Headers, requestUrl?: string) {
  if (requestUrl) {
    try {
      return new URL(requestUrl).hostname;
    } catch {
      return null;
    }
  }

  const host = requestHeaders.get("host");

  return host?.split(":")[0] ?? null;
}

function parseCookie(cookieHeader: string | null) {
  const cookies = new Map<string, string>();

  for (const cookie of cookieHeader?.split(";") ?? []) {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (!name) {
      continue;
    }

    cookies.set(name, valueParts.join("="));
  }

  return cookies;
}
