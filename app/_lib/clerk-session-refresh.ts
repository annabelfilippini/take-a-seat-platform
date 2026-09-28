import { createClerkClient } from "@clerk/backend";

type SessionState = {
  headers: Headers;
  isAuthenticated: boolean;
  status: string;
  token?: string | null;
};

type ClerkEnvironment = {
  CLERK_SECRET_KEY?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
};

// The React SDK handles browser auth; this completes Clerk's server handshake.
// Provider browser returns and expired-link refreshes can require a cross-origin
// Clerk handshake even while the session cookie is still valid.
// Keep it on GETs so redirects never discard a submitted application.
export async function withClerkSessionRefresh(
  request: Request,
  env: ClerkEnvironment,
  next: (request: Request) => Promise<Response>,
  authenticate?: (request: Request) => Promise<SessionState>,
) {
  const path = new URL(request.url).pathname;
  const authDocument = request.method === "GET" &&
    (path === "/sign-in" || path.startsWith("/admin/") ||
      path === "/creators/dashboard" || path === "/creator/profile" ||
      path === "/api/google-calendar/oauth/start" ||
      path === "/api/google-calendar/oauth/callback" ||
      path === "/api/stripe/connect/start" ||
      path === "/api/stripe/connect/return");
  if (!authDocument || !env.CLERK_SECRET_KEY || !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return next(request);
  }

  let state: SessionState;
  try {
    state = await (authenticate ?? ((incoming) => createClerkClient({
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    }).authenticateRequest(incoming)))(request);
  } catch {
    return new Response("Sign-in is temporarily unavailable. Please reload and try again.", { status: 503 });
  }
  if (state.headers.get("location")) {
    return new Response(null, { status: 307, headers: state.headers });
  }
  if (state.status === "handshake") {
    return new Response("Sign-in could not refresh. Please reload and try again.", { status: 503 });
  }

  // A handshake return can authenticate via its query payload before the browser
  // has stored its refreshed cookie. Pass the verified token to this render only.
  let authenticatedRequest = request;
  if (state.isAuthenticated && state.token) {
    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${state.token}`);
    authenticatedRequest = new Request(request, { headers });
  }
  const response = await next(authenticatedRequest);
  const headers = new Headers(response.headers);
  state.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") headers.set(key, value);
  });
  for (const cookie of state.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
