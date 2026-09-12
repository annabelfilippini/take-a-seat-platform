import { getRequestAdminEmail } from "../../../_lib/admin-auth";
import {
  canManageCreatorProfile,
} from "../../../_lib/creator-onboarding";
import { getSignedInClerkUser } from "../../../_lib/clerk-auth";
import {
  getCustomerBooking,
  markBookingPaid,
} from "../../../_lib/bookings";
import { approveBookingAndSendGoogleInvite } from "../../../_lib/google-calendar";
import {
  getStripeSecretKey,
  STRIPE_API_VERSION,
} from "../../../_lib/stripe-connect";
import { notifyCreatorBookingPaid } from "../../../_lib/notifications";

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

  if (booking.status === "requested") {
    return redirectWithStatus(request, safeReturnTo, "error", "payment-required");
  }

  if (booking.status === "accepted" || booking.status === "approved") {
    return redirectWithStatus(request, safeReturnTo, "accepted");
  }

  if (booking.status === "payment_authorized") {
    if (!booking.stripePaymentIntentId || !booking.stripeCheckoutSessionId) {
      return redirectWithStatus(request, safeReturnTo, "error", "payment-required");
    }

    const secretKey = getStripeSecretKey();

    if (!secretKey) {
      return redirectWithStatus(request, safeReturnTo, "setup-needed", "stripe-secret");
    }

    let paidBooking = null;

    try {
      await capturePaymentIntent(booking.stripePaymentIntentId, secretKey);
      paidBooking = await markBookingPaid({
        bookingId: booking.id,
        stripeCheckoutSessionId: booking.stripeCheckoutSessionId,
        stripePaymentIntentId: booking.stripePaymentIntentId,
      });
    } catch {
      return redirectWithStatus(request, safeReturnTo, "setup-needed", "capture");
    }

    if (paidBooking) {
      await notifyCreatorBookingPaid({ booking: paidBooking, request }).catch(
        () => undefined,
      );
    }

    try {
      await approveBookingAndSendGoogleInvite(booking.id);
    } catch {
      return redirectWithStatus(request, safeReturnTo, "setup-needed", "google-calendar");
    }

    return redirectWithStatus(request, safeReturnTo, "sent");
  }

  if (booking.status === "paid") {
    try {
      await approveBookingAndSendGoogleInvite(booking.id);
    } catch {
      return redirectWithStatus(request, safeReturnTo, "setup-needed", "google-calendar");
    }

    return redirectWithStatus(request, safeReturnTo, "sent");
  }

  return redirectWithStatus(request, safeReturnTo, "error", "booking-status");
}

function getSafeReturnTo(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

async function capturePaymentIntent(paymentIntentId: string, secretKey: string) {
  const response = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(
      paymentIntentId,
    )}/capture`,
    {
      headers: {
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        "idempotency-key": `take-a-seat-capture-${paymentIntentId}`,
        "stripe-version": STRIPE_API_VERSION,
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(`Stripe capture failed with ${response.status}`);
  }
  const intent = await response.json() as { id?: string; status?: string };
  if (intent.id !== paymentIntentId || intent.status !== "succeeded") {
    throw new Error("Stripe has not confirmed capture");
  }
}
