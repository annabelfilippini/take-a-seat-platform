import { getSignedInClerkUser } from "../../../../_lib/clerk-auth";
import { canManageCreatorProfile } from "../../../../_lib/creator-onboarding";
import {
  getCreatorNotificationPreferenceInput,
  saveCreatorNotificationPreferences,
} from "../../../../_lib/notifications";

type NotificationPreferencePayload = {
  bookingEmailEnabled?: unknown;
  bookingProfileEnabled?: unknown;
  bookingSmsEnabled?: unknown;
  creatorId?: unknown;
};

export async function POST(request: Request) {
  let payload: NotificationPreferencePayload;

  try {
    payload = (await request.json()) as NotificationPreferencePayload;
  } catch {
    return Response.json(
      { detail: "invalid-json", status: "error" },
      { status: 400 },
    );
  }

  const creatorId =
    typeof payload.creatorId === "string" ? payload.creatorId.trim() : "";
  const input = getCreatorNotificationPreferenceInput(payload);

  if (!creatorId || !input) {
    return Response.json(
      { detail: "preferences-required", status: "error" },
      { status: 400 },
    );
  }

  try {
    const user = await getSignedInClerkUser(request);
    const canManage = user ? await canManageCreatorProfile(creatorId, user) : false;

    if (!canManage) {
      return Response.json(
        { detail: "creator-access", status: "error" },
        { status: 403 },
      );
    }
  } catch {
    return Response.json(
      { detail: "creator-auth", status: "setup-needed" },
      { status: 503 },
    );
  }

  try {
    const preferences = await saveCreatorNotificationPreferences(creatorId, input);

    return Response.json({
      notificationPreferences: {
        bookingEmailEnabled: preferences.bookingEmailEnabled,
        bookingProfileEnabled: preferences.bookingProfileEnabled,
        bookingSmsEnabled: preferences.bookingSmsEnabled,
      },
      status: "saved",
    });
  } catch {
    return Response.json(
      { detail: "d1", status: "setup-needed" },
      { status: 503 },
    );
  }
}
