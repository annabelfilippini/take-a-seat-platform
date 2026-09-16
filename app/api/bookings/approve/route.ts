import { getSafeReturnTo } from '../../../_lib/safe-redirect';
import { getRequestAdminEmail } from '../../../_lib/admin-auth';
import { canManageCreatorProfile } from '../../../_lib/creator-onboarding';
import { getSignedInClerkUser } from '../../../_lib/clerk-auth';
import { getCustomerBooking } from '../../../_lib/bookings';
import { acceptBooking } from '../../../_lib/booking-workflow';

function redirectWithStatus(
  request: Request,
  returnTo: string,
  status: string,
  detail?: string,
) {
  const target = new URL(getSafeReturnTo(returnTo, "/"), request.url);
  target.searchParams.set("calendar", status);

  if (detail) {
    target.searchParams.set("detail", detail);
  }

  return new Response(null, {
    headers: { location: target.toString() },
    status: 303,
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({ error: 'Invalid origin.' }, { status: 403 });
  const formData = await request.formData();
  const bookingId = formData.get("bookingId");
  const returnTo = formData.get("returnTo");
  const safeReturnTo = typeof returnTo === "string" ? returnTo : "/";

  if (typeof bookingId !== "string" || !bookingId.trim()) {
    return redirectWithStatus(request, safeReturnTo, "error", "booking-required");
  }

  const booking = await getCustomerBooking(bookingId);

  if (!booking) {
    return redirectWithStatus(request, safeReturnTo, "error", "unknown-booking");
  }

  const adminEmail = await getRequestAdminEmail(request);
  const user = adminEmail ? null : await getSignedInClerkUser(request);
  const canApprove = Boolean(
    adminEmail ||
      (user && (await canManageCreatorProfile(booking.creatorId, user))),
  );

  if (!canApprove) {
    return redirectWithStatus(request, safeReturnTo, "error", "creator-access");
  }

  try {
    const result = await acceptBooking(booking.id);
    return redirectWithStatus(request, safeReturnTo, result?.status === 'approved' ? 'sent' : 'processing');
  } catch (error) {
    return redirectWithStatus(request, safeReturnTo, 'error', error instanceof Error ? error.message : 'Acceptance could not start.');
  }
}
