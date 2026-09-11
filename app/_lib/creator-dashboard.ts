import { headers } from "next/headers";
import { getSignedInClerkUserFromHeaders } from "./clerk-auth";
import { getCreatorDashboardAccount } from "./creator-onboarding";
import {
  getCreatorNotificationPreferences,
  listCreatorNotifications,
} from "./notifications";

export async function getSignedInCreatorEditorAccount(
  requestPath = "/creators/dashboard",
) {
  const requestHeaders = await headers();
  const mutableHeaders = new Headers(requestHeaders);
  const user = await getSignedInClerkUserFromHeaders(
    mutableHeaders,
    requestUrlFromHeaders(mutableHeaders, requestPath),
  );

  if (!user) {
    return null;
  }

  try {
    const account = await getCreatorDashboardAccount(user);

    if (!("profile" in account)) {
      return null;
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
    return null;
  }
}

function requestUrlFromHeaders(requestHeaders: Headers, path: string) {
  const host = requestHeaders.get("host") ?? "takeaseatwith.com";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  return `${protocol}://${host}${path}`;
}
