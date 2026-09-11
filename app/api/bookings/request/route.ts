import {
  createBookingRequest,
  getCustomerBooking,
  getBookingRequestInput,
} from "../../../_lib/bookings";
import { getBookableCreatorById } from "../../../_lib/creator-onboarding";
import { getSeatById } from "../../../_lib/creators";
import { notifyCreatorBookingRequested } from "../../../_lib/notifications";

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

function getSafeReturnTo(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

async function readBookingRequestPayload(
  request: Request,
): Promise<BookingRequestPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await request.json()) as Record<string, unknown>;
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
  const payload = await readBookingRequestPayload(request);
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
    const bookingId = await createBookingRequest({
      creator,
      input: bookingInput,
      seat,
    });
    const booking = await getCustomerBooking(bookingId);

    if (booking) {
      await notifyCreatorBookingRequested({ booking, request }).catch(() => undefined);
    }

    return redirectTo(
      appendBookingStatus(request, returnTo, "requested", undefined, bookingId),
    );
  } catch {
    return redirectTo(appendBookingStatus(request, returnTo, "error", "booking-request"));
  }
}
