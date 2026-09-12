import { getRequestAdminEmail } from "./admin-auth";
import { getSignedInClerkUser } from "./clerk-auth";
import { canManageCreatorProfile } from "./creator-onboarding";

export type CreatorIntegrationAccess =
  | { status: "allowed" }
  | { detail: "creator-auth" | "creator-access"; status: "denied" };

export async function getCreatorIntegrationAccess(
  request: Request,
  creatorId: string,
): Promise<CreatorIntegrationAccess> {
  const adminEmail = await getRequestAdminEmail(request);

  if (adminEmail) {
    return { status: "allowed" };
  }

  const user = await getSignedInClerkUser(request);

  if (!user) {
    return { detail: "creator-auth", status: "denied" };
  }

  if (await canManageCreatorProfile(creatorId, user)) {
    return { status: "allowed" };
  }

  return { detail: "creator-access", status: "denied" };
}
