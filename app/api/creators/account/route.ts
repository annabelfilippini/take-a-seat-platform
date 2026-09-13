import { getSignedInClerkUser } from "../../../_lib/clerk-auth";
import { getCreatorDashboardAccount } from "../../../_lib/creator-onboarding";
import {
  getCreatorNotificationPreferences,
  listCreatorNotifications,
} from "../../../_lib/notifications";

export async function GET(request: Request) {
  const user = await getSignedInClerkUser(request);

  if (!user) {
    return Response.json({ status: "signed-out" }, { status: 401 });
  }

  try {
    const account = await getCreatorDashboardAccount(user);

    if ("profile" in account) {
      const [notificationPreferences, notifications] = await Promise.all([
        getCreatorNotificationPreferences(account.profile.id),
        listCreatorNotifications(account.profile.id),
      ]);

      return Response.json({
        availabilityRules: account.availabilityRules.map((rule) => ({
          weekStart: rule.weekStart,
          bufferMinutes: rule.bufferMinutes,
          dayOfWeek: rule.dayOfWeek,
          enabled: rule.enabled,
          endTime: rule.endTime,
          id: rule.id,
          maxBookingsPerDay: rule.maxBookingsPerDay,
          maxBookingsPerWeek: rule.maxBookingsPerWeek,
          minNoticeMinutes: rule.minNoticeMinutes,
          startTime: rule.startTime,
          timezone: rule.timezone,
        })),
        profile: {
          about: account.profile.about,
          applicationStatus: account.profile.applicationStatus,
          bio: account.profile.bio,
          calendarConnectedAt: account.profile.calendarConnectedAt,
          category: account.profile.category,
          currency: account.profile.currency,
          email: account.profile.email,
          helpItems: account.profile.helpItems,
          id: account.profile.id,
          instagramHandle: account.profile.instagramHandle,
          location: account.profile.location,
          name: account.profile.name,
          oneToOneReason: account.profile.oneToOneReason,
          offer: account.profile.offer,
          phone: account.profile.phone,
          profileGallery: account.profile.profileGallery,
          profileDetails: account.profile.profileDetails,
          profileImageUrl: account.profile.profileImageUrl,
          profileIntro: account.profile.profileIntro,
          seat15Description: account.profile.seat15Description,
          seat15DurationMinutes: account.profile.seat15DurationMinutes,
          seat15Enabled: account.profile.seat15Enabled,
          seat15PriceAmount: account.profile.seat15PriceAmount,
          seat30Description: account.profile.seat30Description,
          seat30DurationMinutes: account.profile.seat30DurationMinutes,
          seat30Enabled: account.profile.seat30Enabled,
          seat30PriceAmount: account.profile.seat30PriceAmount,
          stripeConnectedAt: account.profile.stripeConnectedAt,
          tiktokHandle: account.profile.tiktokHandle,
          timezone: account.profile.timezone,
          updatedAt: account.profile.updatedAt,
        },
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
        status: account.status,
      });
    }

    return Response.json(account);
  } catch {
    return Response.json(
      { detail: "d1", status: "setup-needed" },
      { status: 503 },
    );
  }
}
