import { headers } from "next/headers";
import { getSignedInClerkUserFromHeaders, type TakeASeatClerkUser } from "./clerk-auth";
import {
  claimCreatorInvite,
  getCreatorDashboardAccount,
} from "./creator-onboarding";
import {
  getCreatorNotificationPreferences,
  listCreatorNotifications,
} from "./notifications";

export async function getSignedInCreatorEditorAccount(
  requestPath = "/creators/dashboard",
  inviteToken?: string | null,
) {
  const requestHeaders = await headers();
  const mutableHeaders = new Headers(requestHeaders);
  try {
    const user = await getSignedInClerkUserFromHeaders(
      mutableHeaders,
      requestUrlFromHeaders(mutableHeaders, requestPath),
    );

    if (!user) {
      return null;
    }

    const account = await getCreatorDashboardAccountFromInvite(user, inviteToken);

    if ("accessError" in account) {
      return account;
    }

    if (!("profile" in account)) {
      return { accessError: "No accepted creator profile is linked to this account. Use the email address from your accepted application, or contact Take a Seat for help." };
    }

    const [notificationPreferences, notifications] = await Promise.all([
      getCreatorNotificationPreferences(account.profile.id),
      listCreatorNotifications(account.profile.id),
    ]);

    return {
      availabilityRules: account.availabilityRules.map((rule) => ({
        bufferMinutes: rule.bufferMinutes,
        dayOfWeek: rule.dayOfWeek,
        enabled: rule.enabled,
        endTime: rule.endTime,
        maxBookingsPerDay: rule.maxBookingsPerDay,
        maxBookingsPerWeek: rule.maxBookingsPerWeek,
        minNoticeMinutes: rule.minNoticeMinutes,
        startTime: rule.startTime,
        timezone: rule.timezone,
      })),
      notificationPreferences: {
        bookingEmailEnabled: notificationPreferences.bookingEmailEnabled,
        bookingProfileEnabled: notificationPreferences.bookingProfileEnabled,
        bookingSmsEnabled: notificationPreferences.bookingSmsEnabled,
      },
      notifications: notifications.map((notification) => ({
        body: notification.body,
        bookingId: notification.bookingId,
        createdAt: notification.createdAt,
        id: notification.id,
        readAt: notification.readAt,
        title: notification.title,
        type: notification.type,
      })),
      profile: account.profile,
    };
  } catch {
    return { accessError: "We could not load your profile right now. Please try again shortly. Your saved profile has not been changed." };
  }
}

export async function getCreatorDashboardAccountFromInvite(
  user: TakeASeatClerkUser,
  inviteToken?: string | null,
) {
  if (inviteToken) {
    const claim = await claimCreatorInvite(inviteToken, user);
    if (claim.status === "identity-mismatch" || claim.status === "needs-identity") {
      return { accessError: "This account does not match the accepted application. Sign out below and use the email address you applied with." };
    }
    // A matching recipient may already own a profile from an earlier application.
    // Resolve their existing ownership; never transfer it to the duplicate invite.
  }

  return getCreatorDashboardAccount(user);
}

function requestUrlFromHeaders(requestHeaders: Headers, path: string) {
  const host = requestHeaders.get("host") ?? "takeaseatwith.com";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  return `${protocol}://${host}${path}`;
}
