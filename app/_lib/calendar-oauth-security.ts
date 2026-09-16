import { and, eq, gt, lt } from "drizzle-orm";
import { googleOAuthAttempts } from "../../db/schema";
import { getSignedInClerkUser } from "./clerk-auth";
import { canManageCreatorProfile } from "./creator-onboarding";

// Calendar authorization belongs to the signed-in creator, never an admin-selected
// profile. Admins can operate bookings but must not attach their Google account to
// another creator through the creator OAuth flow.
export async function getCalendarOwner(request: Request, creatorId: string) {
  const user = await getSignedInClerkUser(request);
  return user && await canManageCreatorProfile(creatorId, user) ? user.userId : null;
}

export async function saveCalendarAttempt(nonce: string, creatorId: string, actorId: string) {
  const { getDb } = await import("../../db");
  const db = getDb();
  await db.delete(googleOAuthAttempts).where(lt(googleOAuthAttempts.expiresAt, Date.now()));
  await db.insert(googleOAuthAttempts).values({ nonce, creatorId, actorId, expiresAt: Date.now() + 600_000 });
}

export async function consumeCalendarAttempt(nonce: string, creatorId: string, actorId: string) {
  const { getDb } = await import("../../db");
  return (await getDb().delete(googleOAuthAttempts).where(and(
    eq(googleOAuthAttempts.nonce, nonce), eq(googleOAuthAttempts.creatorId, creatorId),
    eq(googleOAuthAttempts.actorId, actorId), gt(googleOAuthAttempts.expiresAt, Date.now()),
  )).returning({ nonce: googleOAuthAttempts.nonce })).length === 1;
}
