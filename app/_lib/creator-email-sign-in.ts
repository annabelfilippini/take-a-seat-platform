import { getClerkBackendClient } from "./clerk-auth";

// Called only by the admin acceptance/resend flow. Never expose token issuance
// through a public endpoint or put the token in application data/notifications.
export async function createCreatorEmailSignIn(
  email: string,
  client = getClerkBackendClient(),
) {
  if (!client) throw new Error("Creator email sign-in is not configured.");
  const emailAddress = email.trim().toLowerCase();
  const findUser = async () => {
    const { data } = await client.users.getUserList({ emailAddress: [emailAddress], limit: 100 });
    return data.find((user) => user.emailAddresses.some((address) => address.emailAddress.toLowerCase() === emailAddress));
  };
  let user = await findUser();
  if (!user) {
    try {
      // Clerk provisions a verified email identity. Its one-use token is sent
      // only to that inbox; profile ownership still requires a Clerk session.
      user = await client.users.createUser({ emailAddress: [emailAddress] });
    } catch (error) {
      // Concurrent acceptance/resend may have just provisioned the same email.
      user = await findUser();
      if (!user) throw error;
    }
  }
  if (user.primaryEmailAddress?.emailAddress.toLowerCase() !== emailAddress ||
      user.primaryEmailAddress.verification?.status !== "verified" || user.banned || user.locked) {
    throw new Error("Creator email requires normal account verification.");
  }
  return client.signInTokens.createSignInToken({ userId: user.id, expiresInSeconds: 60 * 60 * 24 });
}
