// Test-only identity boundary. The actual ownership/claim/access code still runs.
export function getClerkPublishableKey() { return null; }
export function isClerkConfigured() { return false; }
export function getClerkBackendClient() { return null; }
export function isPhoneSignInEnabled() { return false; }
export function normalizePhoneIdentity(value?: string | null) { return value?.replace(/\D/g,'') || null; }
export async function getSignedInClerkUserFromHeaders(headers: Headers) {
  return headers.get('cookie')?.includes('tas_e2e_creator=1') ? { userId:'user_e2e', sessionId:'session_e2e', email:'creator@example.com', phone:null } : null;
}
export async function getSignedInClerkUser(request: Request) { return getSignedInClerkUserFromHeaders(request.headers); }
