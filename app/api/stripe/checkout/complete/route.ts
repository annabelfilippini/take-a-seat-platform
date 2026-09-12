import {
  getCustomerBooking,
  markBookingPaid,
  markBookingPaymentAuthorized,
} from "../../../../_lib/bookings";
import {
  notifyCreatorBookingPaid,
  notifyCreatorBookingRequested,
} from "../../../../_lib/notifications";
import { getStripeSecretKey } from "../../../../_lib/stripe-connect";
import {
  getVerifiedCheckoutPayment,
  retrieveStripeCheckoutSession,
} from "../../../../_lib/stripe-payments";

function redirectTo(request: Request, path: string, status: string, detail?: string) {
  const target = new URL(path, request.url);
  target.searchParams.set("booking", status);

  if (detail) {
    target.searchParams.set("detail", detail);
  }

  return new Response(null, {
    headers: { location: target.toString() },
    status: 303,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("booking_id");
  const sessionId = url.searchParams.get("session_id");

  if (!bookingId || !sessionId) {
    return redirectTo(request, "/", "error", "missing-checkout-session");
  }

  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    return redirectTo(
      request,
      `/bookings/${encodeURIComponent(bookingId)}`,
      "setup-needed",
      "stripe-secret",
    );
  }

  try {
    const session = await retrieveStripeCheckoutSession(sessionId);

    const payment = await getVerifiedCheckoutPayment(session);
    if (!payment) {
      return redirectTo(request, `/bookings/${encodeURIComponent(bookingId)}`, "error", "payment-required");
    }
    const existing = await getCustomerBooking(bookingId);
    const paymentIntentId = payment.paymentIntentId;
    const booking =
      payment.status === "paid"
        ? await markBookingPaid({
            bookingId,
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
          })
        : await markBookingPaymentAuthorized({
            bookingId,
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
          });

    if (booking && booking.status === "paid" && existing?.status !== "paid") {
      await notifyCreatorBookingPaid({ booking, request }).catch(() => undefined);
    }

    if (booking && booking.status === "payment_authorized" && existing?.status !== "payment_authorized") {
      await notifyCreatorBookingRequested({ booking, request }).catch(() => undefined);
    }

    if (!booking) {
      return redirectTo(request, `/bookings/${encodeURIComponent(bookingId)}`, "error", "checkout-confirmation");
    }
    return redirectTo(
      request,
      `/bookings/${encodeURIComponent(bookingId)}`,
      ["paid", "approved"].includes(booking.status) ? "success" : "authorized",
    );
  } catch {
    return redirectTo(
      request,
      `/bookings/${encodeURIComponent(bookingId)}`,
      "error",
      "checkout-confirmation",
    );
  }
}
