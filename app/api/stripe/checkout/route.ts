import { getSeatById } from "../../../_lib/creators";
import {
  attachStripeCheckoutSession,
  createCheckoutBooking,
  getBookingRequestInput,
  type BookingRequestInput,
} from "../../../_lib/bookings";
import { getBookableCreatorById } from "../../../_lib/creator-onboarding";
import {
  getConnectedAccountTransferStatus,
  getCreatorStripeConnection,
  getRuntimeEnv,
  getStripeSecretKey,
  STRIPE_API_VERSION,
} from "../../../_lib/stripe-connect";

type CheckoutPayload = {
  appointmentStartAt?: string;
  customerEmail?: string;
  customerName?: string;
  customerNote?: string;
  creatorId?: string;
  seatId?: string;
  returnTo?: string;
  timezone?: string;
};

type StripeCheckoutSession = {
  id: string;
  url?: string;
};

function redirectTo(url: string) {
  return new Response(null, {
    headers: { location: url },
    status: 303,
  });
}

function appendBookingStatus(
  request: Request,
  returnTo: string,
  status: string,
  detail?: string,
) {
  const target = new URL(returnTo, request.url);
  target.searchParams.set("booking", status);

  if (detail) {
    target.searchParams.set("detail", detail);
  }

  return target.toString();
}

function getSafeReturnTo(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function addBookingParams(
  path: string,
  status: "cancelled" | "success",
  includeSessionId = false,
  bookingId?: string,
) {
  const target = new URL(path);
  target.searchParams.set("booking", status);

  if (includeSessionId) {
    target.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  }

  if (bookingId) {
    target.searchParams.set("booking_id", bookingId);
  }

  return target.toString();
}

function buildStripeIntegrationIdentifier() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const values = new Uint8Array(8);
  crypto.getRandomValues(values);
  const suffix = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");

  return `take_a_seat_checkout_${suffix}`;
}

function getPlatformFeeBps() {
  const rawValue = getRuntimeEnv("TAKE_A_SEAT_PLATFORM_FEE_BPS");

  if (!rawValue || !/^\d+$/.test(rawValue)) {
    return null;
  }

  const feeBps = Number(rawValue);

  if (!Number.isSafeInteger(feeBps) || feeBps < 0 || feeBps > 10000) {
    return null;
  }

  return feeBps;
}

async function readCheckoutPayload(request: Request): Promise<CheckoutPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await request.json()) as Record<string, unknown>;
    return {
      appointmentStartAt:
        typeof payload.appointmentStartAt === "string"
          ? payload.appointmentStartAt
          : undefined,
      customerEmail:
        typeof payload.customerEmail === "string" ? payload.customerEmail : undefined,
      customerName:
        typeof payload.customerName === "string" ? payload.customerName : undefined,
      customerNote:
        typeof payload.customerNote === "string" ? payload.customerNote : undefined,
      creatorId:
        typeof payload.creatorId === "string" ? payload.creatorId : undefined,
      returnTo: typeof payload.returnTo === "string" ? payload.returnTo : undefined,
      seatId: typeof payload.seatId === "string" ? payload.seatId : undefined,
      timezone: typeof payload.timezone === "string" ? payload.timezone : undefined,
    };
  }

  const formData = await request.formData();
  const appointmentStartAt = formData.get("appointmentStartAt");
  const customerEmail = formData.get("customerEmail");
  const customerName = formData.get("customerName");
  const customerNote = formData.get("customerNote");
  const creatorId = formData.get("creatorId");
  const seatId = formData.get("seatId");
  const returnTo = formData.get("returnTo");
  const timezone = formData.get("timezone");

  return {
    appointmentStartAt:
      typeof appointmentStartAt === "string" ? appointmentStartAt : undefined,
    customerEmail: typeof customerEmail === "string" ? customerEmail : undefined,
    customerName: typeof customerName === "string" ? customerName : undefined,
    customerNote: typeof customerNote === "string" ? customerNote : undefined,
    creatorId: typeof creatorId === "string" ? creatorId : undefined,
    returnTo: typeof returnTo === "string" ? returnTo : undefined,
    seatId: typeof seatId === "string" ? seatId : undefined,
    timezone: typeof timezone === "string" ? timezone : undefined,
  };
}

async function createStripeCheckoutSession(
  request: Request,
  secretKey: string,
  payload: Required<Pick<CheckoutPayload, "creatorId" | "seatId">>,
  priceId: string,
  destinationAccountId: string,
  applicationFeeAmount: number,
  returnTo: string,
  bookingId: string,
  bookingInput: BookingRequestInput,
) {
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin =
    getRuntimeEnv("NEXT_PUBLIC_SITE_URL") ?? getRuntimeEnv("PUBLIC_SITE_URL");
  const publicOrigin = configuredOrigin
    ? new URL(configuredOrigin).origin
    : requestOrigin;
  const successUrl = addBookingParams(
    `${publicOrigin}/api/stripe/checkout/complete`,
    "success",
    true,
    bookingId,
  );
  const cancelUrl = addBookingParams(`${publicOrigin}${returnTo}`, "cancelled");
  const params = new URLSearchParams({
    cancel_url: cancelUrl,
    customer_email: bookingInput.customerEmail,
    integration_identifier: buildStripeIntegrationIdentifier(),
    mode: "payment",
    success_url: successUrl,
  });

  params.set("client_reference_id", bookingId);
  params.set("metadata[appointment_start_at]", bookingInput.appointmentStartAt);
  params.set("metadata[booking_id]", bookingId);
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("metadata[customer_email]", bookingInput.customerEmail);
  params.set("metadata[customer_name]", bookingInput.customerName ?? "");
  params.set("metadata[timezone]", bookingInput.timezone);
  params.set("metadata[creator_id]", payload.creatorId);
  params.set("metadata[seat_id]", payload.seatId);
  params.set("metadata[charge_pattern]", "destination_charge");
  params.set(
    "payment_intent_data[application_fee_amount]",
    applicationFeeAmount.toString(),
  );
  params.set("payment_intent_data[metadata][booking_id]", bookingId);
  params.set("payment_intent_data[metadata][creator_id]", payload.creatorId);
  params.set("payment_intent_data[metadata][seat_id]", payload.seatId);
  params.set(
    "payment_intent_data[transfer_data][destination]",
    destinationAccountId,
  );

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    body: params,
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": STRIPE_API_VERSION,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Stripe Checkout failed with ${response.status}`);
  }

  return (await response.json()) as StripeCheckoutSession;
}

export async function POST(request: Request) {
  const payload = await readCheckoutPayload(request);
  const creator = payload.creatorId
    ? await getBookableCreatorById(payload.creatorId)
    : null;
  const seat = creator && payload.seatId ? getSeatById(creator, payload.seatId) : null;
  const fallbackReturnTo = creator ? `/with/${creator.slug}` : "/";
  const returnTo = getSafeReturnTo(payload.returnTo, fallbackReturnTo);

  if (!creator || !seat) {
    return redirectTo(
      appendBookingStatus(request, returnTo, "error", "unknown-seat"),
    );
  }

  const bookingInput = getBookingRequestInput({
    appointmentStartAt: payload.appointmentStartAt,
    customerEmail: payload.customerEmail,
    customerName: payload.customerName,
    customerNote: payload.customerNote,
    timezone: payload.timezone,
  });

  if (!bookingInput) {
    return redirectTo(
      appendBookingStatus(request, returnTo, "error", "booking-details"),
    );
  }

  const secretKey = getStripeSecretKey();
  const priceId = getRuntimeEnv(seat.stripePriceEnv);
  const platformFeeBps = getPlatformFeeBps();

  if (!secretKey) {
    return redirectTo(
      appendBookingStatus(request, returnTo, "setup-needed", "stripe-secret"),
    );
  }

  if (!priceId) {
    return redirectTo(
      appendBookingStatus(request, returnTo, "setup-needed", "stripe-price"),
    );
  }

  if (platformFeeBps === null) {
    return redirectTo(
      appendBookingStatus(request, returnTo, "setup-needed", "platform-fee"),
    );
  }

  let connection: Awaited<ReturnType<typeof getCreatorStripeConnection>>;

  try {
    connection = await getCreatorStripeConnection(creator.id);
  } catch {
    return redirectTo(
      appendBookingStatus(request, returnTo, "setup-needed", "d1"),
    );
  }

  if (!connection?.stripeAccountId) {
    return redirectTo(
      appendBookingStatus(request, returnTo, "setup-needed", "stripe-connect"),
    );
  }

  if (!connection.connectedAt) {
    return redirectTo(
      appendBookingStatus(request, returnTo, "setup-needed", "stripe-onboarding"),
    );
  }

  try {
    const transferStatus = await getConnectedAccountTransferStatus({
      accountId: connection.stripeAccountId,
      secretKey,
    });

    if (transferStatus !== "active") {
      return redirectTo(
        appendBookingStatus(
          request,
          returnTo,
          "setup-needed",
          "stripe-transfers",
        ),
      );
    }
  } catch {
    return redirectTo(
      appendBookingStatus(request, returnTo, "setup-needed", "stripe-transfers"),
    );
  }

  const applicationFeeAmount = Math.round((seat.unitAmount * platformFeeBps) / 10000);

  try {
    const bookingId = await createCheckoutBooking({
      creator,
      input: bookingInput,
      seat,
    });
    const session = await createStripeCheckoutSession(
      request,
      secretKey,
      {
        creatorId: creator.id,
        seatId: seat.id,
      },
      priceId,
      connection.stripeAccountId,
      applicationFeeAmount,
      returnTo,
      bookingId,
      bookingInput,
    );

    if (!session.url) {
      return redirectTo(
        appendBookingStatus(request, returnTo, "error", "missing-session-url"),
      );
    }

    await attachStripeCheckoutSession(bookingId, session.id);

    return redirectTo(session.url);
  } catch {
    return redirectTo(
      appendBookingStatus(request, returnTo, "error", "stripe-session"),
    );
  }
}
