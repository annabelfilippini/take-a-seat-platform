import { markBookingPaid } from "../../../_lib/bookings";
import { notifyCreatorBookingPaid } from "../../../_lib/notifications";
import { getStripeWebhookSecret } from "../../../_lib/stripe-connect";

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

type StripeWebhookEvent = {
  data?: {
    object?: StripeCheckoutSessionDetails;
  };
  id?: string;
  type?: string;
};

type StripeCheckoutSessionDetails = {
  client_reference_id?: string | null;
  id: string;
  metadata?: {
    booking_id?: string;
  } | null;
  payment_intent?: string | { id?: string } | null;
  payment_status?: string;
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

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data?.object;
    const bookingId = getBookingId(session);

    if (!session?.id || !bookingId) {
      return Response.json(
        { detail: "booking", status: "invalid" },
        { status: 400 },
      );
    }

    if (session.payment_status === "paid") {
      const booking = await markBookingPaid({
        bookingId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: getPaymentIntentId(session),
      });

      if (booking) {
        await notifyCreatorBookingPaid({ booking, request }).catch(() => undefined);
      }
    }
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

function getBookingId(session: StripeCheckoutSessionDetails | undefined) {
  return session?.metadata?.booking_id ?? session?.client_reference_id ?? null;
}

function getPaymentIntentId(session: StripeCheckoutSessionDetails) {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  return session.payment_intent?.id ?? null;
}
