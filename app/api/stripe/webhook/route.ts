import { getCustomerBooking, markBookingPaid, markBookingPaymentAuthorized, markBookingPaymentEnded } from "../../../_lib/bookings";
import {
  notifyCreatorBookingPaid,
  notifyCreatorBookingRequested,
} from "../../../_lib/notifications";
import { getStripeWebhookSecret } from "../../../_lib/stripe-connect";

import {
  getVerifiedCheckoutPayment,
  retrieveStripeCheckoutSession,
  retrieveStripePaymentIntent,
  type StripeCheckoutSession,
} from "../../../_lib/stripe-payments";

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

type StripeWebhookEvent = {
  data?: { object?: { id: string; metadata?: { booking_id?: string } | null; client_reference_id?: string | null } };
  id?: string;
  type?: string;
};

export async function POST(request: Request) {
  const webhookSecret = getStripeWebhookSecret();

  if (!webhookSecret) {
    return Response.json(
      { detail: "stripe-webhook-secret", status: "setup-needed" },
      { status: 500 },
    );
  }

  const signatureHeader = request.headers.get("stripe-signature");
  const payload = await request.text();

  if (
    !signatureHeader ||
    !(await verifyStripeWebhookSignature({
      payload,
      secret: webhookSecret,
      signatureHeader,
    }))
  ) {
    return Response.json(
      { detail: "signature", status: "invalid" },
      { status: 400 },
    );
  }

  let event: StripeWebhookEvent;

  try {
    event = JSON.parse(payload) as StripeWebhookEvent;
  } catch {
    return Response.json({ detail: "json", status: "invalid" }, { status: 400 });
  }

  const object = event.data?.object;
  const checkoutEvents = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired"];
  const intentEvents = ["payment_intent.amount_capturable_updated", "payment_intent.succeeded", "payment_intent.canceled"];
  try {
    if (checkoutEvents.includes(event.type ?? "")) {
      const bookingId = object?.metadata?.booking_id ?? object?.client_reference_id;
      if (!object?.id || !bookingId) return Response.json({ received: true });
      const session = await retrieveStripeCheckoutSession(object.id);
      if (session.status === "expired") {
        await markBookingPaymentEnded({ bookingId, sessionId: session.id, status: "checkout_expired" });
      } else {
        await reconcileSession(session, bookingId, request);
      }
    } else if (intentEvents.includes(event.type ?? "")) {
      const bookingId = object?.metadata?.booking_id;
      if (!object?.id || !bookingId) return Response.json({ received: true });
      const booking = await getCustomerBooking(bookingId);
      if (!booking) return Response.json({ received: true });
      if (!booking.stripeCheckoutSessionId) throw new Error("Checkout association is not saved yet");
      const session = await retrieveStripeCheckoutSession(booking.stripeCheckoutSessionId);
      const sessionIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (sessionIntentId !== object.id) return Response.json({ received: true });
      // Read current state so delayed events cannot overwrite a newer payment outcome.
      const intent = await retrieveStripePaymentIntent(object.id);
      if (intent.status === "canceled") {
        await markBookingPaymentEnded({ bookingId, sessionId: session.id, status: "payment_canceled" });
      } else if (intent.status === "succeeded") {
        // The PaymentIntent is authoritative even if Checkout's snapshot lags.
        const paid = await markBookingPaid({ bookingId, stripeCheckoutSessionId: session.id, stripePaymentIntentId: intent.id });
        if (paid?.status === "paid" && booking.status !== "paid") {
          await notifyCreatorBookingPaid({ booking: paid, request }).catch(() => undefined);
        }
      } else {
        await reconcileSession({ ...session, payment_intent: intent }, bookingId, request);
      }
    }
  } catch {
    // Stripe must retry a failed database/API operation rather than lose the event.
    return Response.json({ detail: "payment-reconciliation", status: "retry" }, { status: 500 });
  }

  return Response.json({ received: true });
}

async function verifyStripeWebhookSignature({
  payload,
  secret,
  signatureHeader,
}: {
  payload: string;
  secret: string;
  signatureHeader: string;
}) {
  const signature = parseStripeSignatureHeader(signatureHeader);

  if (!signature) {
    return false;
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - signature.timestamp);

  if (ageSeconds > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${signature.timestamp}.${payload}`;
  const expectedSignature = await hmacSha256Hex(secret, signedPayload);

  return signature.signatures.some((value) =>
    timingSafeEqualHex(value, expectedSignature),
  );
}

function parseStripeSignatureHeader(signatureHeader: string) {
  const pairs = signatureHeader.split(",").map((part) => part.trim().split("="));
  const timestamp = pairs.find(([key]) => key === "t")?.[1];
  const signatures = pairs
    .filter(([key, value]) => key === "v1" && Boolean(value))
    .map(([, value]) => value);

  if (!timestamp || !/^\d+$/u.test(timestamp) || signatures.length === 0) {
    return null;
  }

  return {
    signatures,
    timestamp: Number(timestamp),
  };
}

async function hmacSha256Hex(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function timingSafeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]+$/iu.test(left) || !/^[a-f0-9]+$/iu.test(right)) {
    return false;
  }

  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);

  if (!leftBytes || !rightBytes || leftBytes.length !== rightBytes.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }

  return difference === 0;
}

function hexToBytes(value: string) {
  if (value.length % 2 !== 0) {
    return null;
  }

  const bytes = new Uint8Array(value.length / 2);

  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }

  return bytes;
}

async function reconcileSession(session: StripeCheckoutSession, bookingId: string, request: Request) {
  const existing = await getCustomerBooking(bookingId);
  if (!existing) return;
  if (!existing.stripeCheckoutSessionId) throw new Error("Checkout association is not saved yet");
  if (existing.stripeCheckoutSessionId !== session.id) return;
  const payment = await getVerifiedCheckoutPayment(session);
  if (!payment) return;
  const input = { bookingId, stripeCheckoutSessionId: session.id, stripePaymentIntentId: payment.paymentIntentId };
  const booking = payment.status === "paid" ? await markBookingPaid(input) : await markBookingPaymentAuthorized(input);
  if (booking?.status === "paid" && existing.status !== "paid") {
    await notifyCreatorBookingPaid({ booking, request }).catch(() => undefined);
  }
  if (booking?.status === "payment_authorized" && existing.status !== "payment_authorized") {
    await notifyCreatorBookingRequested({ booking, request }).catch(() => undefined);
  }
}
