import { getStripeSecretKey, STRIPE_API_VERSION } from "./stripe-connect";

export type StripePaymentIntent = {
  id: string;
  status: string;
  amount_capturable?: number;
  capture_method?: string;
  metadata?: { booking_id?: string };
};

export type StripeCheckoutSession = {
  id: string;
  status?: string;
  payment_status?: string;
  client_reference_id?: string | null;
  metadata?: { booking_id?: string } | null;
  payment_intent?: string | StripePaymentIntent | null;
};

export async function retrieveStripePaymentIntent(id: string) {
  return stripeRead<StripePaymentIntent>(`/v1/payment_intents/${encodeURIComponent(id)}`);
}

export async function retrieveStripeCheckoutSession(id: string) {
  return stripeRead<StripeCheckoutSession>(
    `/v1/checkout/sessions/${encodeURIComponent(id)}?expand[]=payment_intent`,
  );
}

// An unpaid or open Checkout is not evidence of an authorization.
export async function getVerifiedCheckoutPayment(session: StripeCheckoutSession) {
  if (session.status !== "complete" || !session.payment_intent) return null;
  const intent = typeof session.payment_intent === "string"
    ? await retrieveStripePaymentIntent(session.payment_intent)
    : session.payment_intent;
  if (intent.status === "succeeded" && session.payment_status === "paid") {
    return { status: "paid" as const, paymentIntentId: intent.id };
  }
  if (intent.status === "requires_capture" && intent.capture_method === "manual" &&
    (intent.amount_capturable ?? 0) > 0) {
    return { status: "payment_authorized" as const, paymentIntentId: intent.id };
  }
  return null;
}

async function stripeRead<T>(path: string): Promise<T> {
  const key = getStripeSecretKey();
  if (!key) throw new Error("Stripe secret is unavailable");
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: { authorization: `Bearer ${key}`, "stripe-version": STRIPE_API_VERSION },
  });
  if (!response.ok) throw new Error(`Stripe verification failed with ${response.status}`);
  return response.json() as Promise<T>;
}
