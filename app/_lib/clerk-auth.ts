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
  const email = user.primaryEmailAddress?.emailAddress ?? null;
  const phone =
    user.primaryPhoneNumber?.phoneNumber ??
    user.phoneNumbers.find((phoneNumber) => phoneNumber.phoneNumber)?.phoneNumber ??
    null;

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
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizePhoneIdentity(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  return digits || null;
}
