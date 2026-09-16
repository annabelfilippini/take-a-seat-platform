import { getSafeReturnTo } from "../../../_lib/safe-redirect";
import {
  attachStripeCheckoutSession,
  type BookingRequestInput,
  reserveBookingRequest,
  getBookingRequestInput,
  isBookingSlotAvailable,
} from "../../../_lib/bookings";
import { getBookableCreatorById } from "../../../_lib/creator-onboarding";
import { getSeatById, type Creator, type Seat } from "../../../_lib/creators";
import {
  getConnectedAccountTransferStatus,
  getCreatorStripeConnection,
  getRuntimeEnv,
  getStripeSecretKey,
  STRIPE_API_VERSION,
} from "../../../_lib/stripe-connect";

type StripeCheckoutSession = {
  id: string;
  url?: string;
};

type StripeCheckoutReadiness =
  | {
      applicationFeeAmount: number;
      destinationAccountId: string;
      ok: true;
      priceId: string | null;
      secretKey: string;
    }
  | {
      detail: string;
      ok: false;
    };

type BookingRequestPayload = {
  appointmentStartAt?: string;
  creatorId?: string;
  customerEmail?: string;
  customerName?: string;
  customerNote?: string;
  returnTo?: string;
  seatId?: string;
  timezone?: string;
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
  bookingId?: string,
) {
  const target = new URL(returnTo, request.url);
  target.searchParams.set("booking", status);

  if (detail) {
    target.searchParams.set("detail", detail);
  }

  if (bookingId) {
    target.searchParams.set("booking_id", bookingId);
  }

  return target.toString();
}

async function readBookingRequestPayload(
  request: Request,
): Promise<BookingRequestPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid booking request.");
    const payload = raw as Record<string, unknown>;
    return {
      appointmentStartAt:
        typeof payload.appointmentStartAt === "string"
          ? payload.appointmentStartAt
          : undefined,
      creatorId:
        typeof payload.creatorId === "string" ? payload.creatorId : undefined,
      customerEmail:
        typeof payload.customerEmail === "string" ? payload.customerEmail : undefined,
      customerName:
        typeof payload.customerName === "string" ? payload.customerName : undefined,
      customerNote:
        typeof payload.customerNote === "string" ? payload.customerNote : undefined,
      returnTo: typeof payload.returnTo === "string" ? payload.returnTo : undefined,
      seatId: typeof payload.seatId === "string" ? payload.seatId : undefined,
      timezone: typeof payload.timezone === "string" ? payload.timezone : undefined,
    };
  }

  const formData = await request.formData();
  const appointmentStartAt = formData.get("appointmentStartAt");
  const creatorId = formData.get("creatorId");
  const customerEmail = formData.get("customerEmail");
  const customerName = formData.get("customerName");
  const customerNote = formData.get("customerNote");
  const returnTo = formData.get("returnTo");
  const seatId = formData.get("seatId");
  const timezone = formData.get("timezone");

  return {
    appointmentStartAt:
      typeof appointmentStartAt === "string" ? appointmentStartAt : undefined,
    creatorId: typeof creatorId === "string" ? creatorId : undefined,
    customerEmail: typeof customerEmail === "string" ? customerEmail : undefined,
    customerName: typeof customerName === "string" ? customerName : undefined,
    customerNote: typeof customerNote === "string" ? customerNote : undefined,
    returnTo: typeof returnTo === "string" ? returnTo : undefined,
    seatId: typeof seatId === "string" ? seatId : undefined,
    timezone: typeof timezone === "string" ? timezone : undefined,
  };
}

export async function POST(request: Request) {
  let payload: BookingRequestPayload;
  try { payload = await readBookingRequestPayload(request); }
  catch { return Response.json({ status: "error", detail: "invalid-body" }, { status: 400 }); }
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

  try {
    const isAvailable = await isBookingSlotAvailable({
      creator,
      input: bookingInput,
      seat,
    });

    if (!isAvailable) {
      return redirectTo(
        appendBookingStatus(request, returnTo, "error", "availability"),
      );
    }
  } catch {
    return redirectTo(appendBookingStatus(request, returnTo, "setup-needed", "d1"));
  }

  try {
    const stripeReadiness = await getStripeCheckoutReadiness({
      creator,
      seat,
    });

    if (!stripeReadiness.ok) {
      return redirectTo(
        appendBookingStatus(
          request,
          returnTo,
          "setup-needed",
          stripeReadiness.detail,
        ),
      );
    }

    const bookingId = await reserveBookingRequest({
      creator,
      input: bookingInput,
      seat,
    });

    if (!bookingId) return redirectTo(appendBookingStatus(request, returnTo, "error", "availability"));

    const session = await createManualCaptureCheckoutSession({
      applicationFeeAmount: stripeReadiness.applicationFeeAmount,
      bookingId,
      bookingInput,
      creator,
      destinationAccountId: stripeReadiness.destinationAccountId,
      priceId: stripeReadiness.priceId,
      request,
      returnTo,
      secretKey: stripeReadiness.secretKey,
      seat,
    });

    if (session?.url) {
      await attachStripeCheckoutSession(bookingId, session.id);
      return redirectTo(session.url);
    }

    return redirectTo(
      appendBookingStatus(request, returnTo, "setup-needed", "stripe", bookingId),
    );
  } catch {
    return redirectTo(appendBookingStatus(request, returnTo, "error", "booking-request"));
  }
}

async function getStripeCheckoutReadiness({
  creator,
  seat,
}: {
  creator: Creator;
  seat: Seat;
}): Promise<StripeCheckoutReadiness> {
  const secretKey = getStripeSecretKey();
  const priceId = getRuntimeEnv(seat.stripePriceEnv);
  const platformFeeBps = getPlatformFeeBps();

  if (!secretKey) {
    return { detail: "stripe-secret", ok: false };
  }

  if (!priceId && !canUseInlineStripePrice(seat)) {
    return { detail: "stripe-price", ok: false };
  }

  if (platformFeeBps === null) {
    return { detail: "platform-fee", ok: false };
  }

  let connection: Awaited<ReturnType<typeof getCreatorStripeConnection>>;

  try {
    connection = await getCreatorStripeConnection(creator.id);
  } catch {
    return { detail: "d1", ok: false };
  }

  if (!connection?.stripeAccountId) {
    return { detail: "stripe-connect", ok: false };
  }

  let transferStatus: string | null;

  try {
    transferStatus = await getConnectedAccountTransferStatus({
      accountId: connection.stripeAccountId,
      secretKey,
    });
  } catch {
    return { detail: "stripe-transfers", ok: false };
  }

  if (transferStatus !== "active") {
    return { detail: "stripe-transfers", ok: false };
  }

  return {
    applicationFeeAmount: Math.round((seat.unitAmount * platformFeeBps) / 10000),
    destinationAccountId: connection.stripeAccountId,
    ok: true,
    priceId,
    secretKey,
  };
}

async function createManualCaptureCheckoutSession({
  applicationFeeAmount,
  bookingId,
  bookingInput,
  creator,
  destinationAccountId,
  priceId,
  request,
  returnTo,
  secretKey,
  seat,
}: {
  applicationFeeAmount: number;
  bookingId: string;
  bookingInput: BookingRequestInput;
  creator: Creator;
  destinationAccountId: string;
  priceId: string | null;
  request: Request;
  returnTo: string;
  secretKey: string;
  seat: Seat;
}) {
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin =
    getRuntimeEnv("NEXT_PUBLIC_SITE_URL") ?? getRuntimeEnv("PUBLIC_SITE_URL");
  const publicOrigin = configuredOrigin
    ? new URL(configuredOrigin).origin
    : requestOrigin;
  const successUrl = addBookingParams(
    `${publicOrigin}/api/stripe/checkout/complete`,
    "authorized",
    true,
    bookingId,
  );
  const cancelUrl = appendBookingStatus(
    request,
    `${publicOrigin}${returnTo}`,
    "cancelled",
    undefined,
    bookingId,
  );
  const paymentConfiguration = getRuntimeEnv('STRIPE_BOOKING_PAYMENT_METHOD_CONFIGURATION');
  if (!paymentConfiguration) throw new Error('A card-only booking payment configuration is required.');
  const params = new URLSearchParams({
    payment_method_configuration: paymentConfiguration,
    cancel_url: cancelUrl,
    customer_email: bookingInput.customerEmail,
    integration_identifier: buildStripeIntegrationIdentifier(),
    mode: "payment",
    success_url: successUrl,
  });

  params.set("expires_at", String(Math.floor(Date.now() / 1000) + 30 * 60));
  params.set("client_reference_id", bookingId);
  setStripeLineItemParams(params, creator, seat, priceId);
  params.set("metadata[appointment_start_at]", bookingInput.appointmentStartAt);
  params.set("metadata[booking_id]", bookingId);
  params.set("metadata[charge_pattern]", "manual_capture_destination_charge");
  params.set("metadata[creator_id]", creator.id);
  params.set("metadata[customer_email]", bookingInput.customerEmail);
  params.set("metadata[customer_name]", bookingInput.customerName ?? "");
  params.set("metadata[seat_id]", seat.id);
  params.set("metadata[timezone]", bookingInput.timezone);
  params.set(
    "payment_intent_data[application_fee_amount]",
    applicationFeeAmount.toString(),
  );
  params.set("payment_intent_data[capture_method]", "manual");
  params.set("payment_intent_data[metadata][booking_id]", bookingId);
  params.set("payment_intent_data[metadata][creator_id]", creator.id);
  params.set("payment_intent_data[metadata][seat_id]", seat.id);
  params.set(
    "payment_intent_data[transfer_data][destination]",
    destinationAccountId,
  );

  return postStripeCheckoutSession(params, secretKey);
}

async function postStripeCheckoutSession(
  params: URLSearchParams,
  secretKey: string,
) {
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    body: params,
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": STRIPE_API_VERSION,
      "idempotency-key": `take-a-seat-checkout-${params.get("client_reference_id")}`,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Stripe Checkout failed with ${response.status}`);
  }

  return (await response.json()) as StripeCheckoutSession;
}

function addBookingParams(
  path: string,
  status: "authorized",
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

  return `take_a_seat_hold_${suffix}`;
}

function setStripeLineItemParams(
  params: URLSearchParams,
  creator: Creator,
  seat: Seat,
  priceId: string | null,
) {
  if (priceId) {
    params.set("line_items[0][price]", priceId);
  } else {
    params.set("line_items[0][price_data][currency]", getSeatCurrency(seat));
    params.set(
      "line_items[0][price_data][product_data][name]",
      `${seat.name} with ${creator.name}`,
    );
    params.set("line_items[0][price_data][unit_amount]", String(seat.unitAmount));
  }

  params.set("line_items[0][quantity]", "1");
}

function canUseInlineStripePrice(seat: Seat) {
  return (
    Number.isSafeInteger(seat.unitAmount) &&
    seat.unitAmount > 0 &&
    /^[a-z]{3}$/u.test(getSeatCurrency(seat))
  );
}

function getSeatCurrency(seat: Seat) {
  return (seat.currency ?? "usd").trim().toLowerCase();
}

function getPlatformFeeBps() {
  const rawValue = getRuntimeEnv("TAKE_A_SEAT_PLATFORM_FEE_BPS");

  if (!rawValue || !/^\d+$/u.test(rawValue)) {
    return null;
  }

  const feeBps = Number(rawValue);

  if (!Number.isSafeInteger(feeBps) || feeBps < 0 || feeBps > 10000) {
    return null;
  }

  return feeBps;
}
