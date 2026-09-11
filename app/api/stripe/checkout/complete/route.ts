import {
  markBookingPaid,
  markBookingPaymentAuthorized,
} from "../../../../_lib/bookings";
import {
  notifyCreatorBookingPaid,
  notifyCreatorBookingRequested,
} from "../../../../_lib/notifications";
import {
  getStripeSecretKey,
  STRIPE_API_VERSION,
} from "../../../../_lib/stripe-connect";

type StripeCheckoutSessionDetails = {
  id: string;
  payment_intent?: string | { id?: string } | null;
  payment_status?: string;
};

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
    const session = await retrieveCheckoutSession(sessionId, secretKey);

    const paymentIntentId = getPaymentIntentId(session);
    const booking =
      session.payment_status === "paid"
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

    if (booking && booking.status === "paid") {
      await notifyCreatorBookingPaid({ booking, request }).catch(() => undefined);
    }

    if (booking && booking.status === "payment_authorized") {
      await notifyCreatorBookingRequested({ booking, request }).catch(() => undefined);
    }

    return redirectTo(
      request,
      `/bookings/${encodeURIComponent(bookingId)}`,
      booking?.status === "paid" ? "success" : "authorized",
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

async function retrieveCheckoutSession(sessionId: string, secretKey: string) {
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: {
        authorization: `Bearer ${secretKey}`,
        "stripe-version": STRIPE_API_VERSION,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Stripe session retrieve failed with ${response.status}`);
  }

  return (await response.json()) as StripeCheckoutSessionDetails;
}

function getPaymentIntentId(session: StripeCheckoutSessionDetails) {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  return session.payment_intent?.id ?? null;
}
