import { env as workerEnv } from "cloudflare:workers";
import { createClerkClient } from "@clerk/backend";

export type TakeASeatClerkUser = {
  email: string | null;
  phone: string | null;
  sessionId: string;
  userId: string;
};

export function getClerkPublishableKey() {
  return (
    getRuntimeEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") ??
    getRuntimeEnv("VITE_CLERK_PUBLISHABLE_KEY") ??
    getRuntimeEnv("CLERK_PUBLISHABLE_KEY")
  );
}

export function isClerkConfigured() {
  return Boolean(getClerkPublishableKey() && getClerkSecretKey());
}

export function isPhoneSignInEnabled() {
  return getRuntimeEnv("TAKE_A_SEAT_PHONE_SIGN_IN_ENABLED") === "true";
}

export async function getSignedInClerkUser(
  request: Request,
): Promise<TakeASeatClerkUser | null> {
  return getSignedInClerkUserFromHeaders(request.headers, request.url);
}

export async function getSignedInClerkUserFromHeaders(
  requestHeaders: Headers,
  requestUrl = "https://takeaseatwith.com",
): Promise<TakeASeatClerkUser | null> {
  const publishableKey = getClerkPublishableKey();
  const secretKey = getClerkSecretKey();

  if (!publishableKey || !secretKey) {
    return null;
  }

  const clerkClient = createClerkClient({ publishableKey, secretKey });
  const requestState = await clerkClient.authenticateRequest(
    new Request(requestUrl, { headers: requestHeaders }),
  );

  if (!requestState.isAuthenticated) {
    return null;
  }

  const auth = requestState.toAuth();

  if (!auth.userId || !auth.sessionId) {
    return null;
  }

  const user = await clerkClient.users.getUser(auth.userId);
  const email = user.primaryEmailAddress?.verification?.status === "verified"
    ? user.primaryEmailAddress.emailAddress : null;
  const phone = user.phoneNumbers.find((number) =>
    number.verification?.status === "verified" && number.id === user.primaryPhoneNumberId
  )?.phoneNumber ?? null;

  return {
    email: email?.toLowerCase() ?? null,
    phone: normalizePhoneIdentity(phone),
    sessionId: auth.sessionId,
    userId: auth.userId,
  };
}

function getClerkSecretKey() {
  return getRuntimeEnv("CLERK_SECRET_KEY");
}

function getRuntimeEnv(name: string) {
  const globalEnv = (globalThis as Record<string, unknown>).env;
  const cloudflareValue =
    globalEnv && typeof globalEnv === "object"
      ? (globalEnv as Record<string, unknown>)[name]
      : undefined;
  const processValue =
    typeof process === "object" && process.env ? process.env[name] : undefined;
  const workerValue = (workerEnv as unknown as Record<string, unknown>)[name];
  const value = typeof cloudflareValue === "string" ? cloudflareValue : typeof workerValue === "string" ? workerValue : processValue;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizePhoneIdentity(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  return digits || null;
}
