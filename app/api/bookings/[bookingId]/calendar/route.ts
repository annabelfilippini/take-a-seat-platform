import {
  createCustomerCalendarIcs,
  getCustomerBooking,
  getCustomerCalendarFilename,
} from "../../../../_lib/bookings";

type BookingCalendarRouteProps = {
  params: {
    bookingId: string;
  };
};

export async function GET(_request: Request, { params }: BookingCalendarRouteProps) {
  const booking = await getCustomerBooking(params.bookingId);

  if (!booking || booking.status !== "approved") {
    return new Response("Booking not found.", { status: 404 });
  }

  return new Response(createCustomerCalendarIcs(booking), {
    headers: {
      "content-disposition": `attachment; filename="${getCustomerCalendarFilename(
        booking,
      )}"`,
      "content-type": "text/calendar; charset=utf-8",
    },
  });
}

// Creator-only retry of synchronization from authoritative booking data.
export async function POST(request: Request, { params }: BookingCalendarRouteProps) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const booking = await getCustomerBooking(params.bookingId);
  const { getCalendarOwner } = await import("../../../../_lib/calendar-oauth-security");
  if (!booking || !await getCalendarOwner(request, booking.creatorId)) return Response.json({ error: "Creator access required." }, { status: 403 });
  const { syncBookingCalendar, rescheduleConfirmedBooking } = await import("../../../../_lib/google-calendar");
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const input = await request.json() as { appointmentStartAt?: string; timezone?: string };
      if (typeof input.appointmentStartAt !== "string" || typeof input.timezone !== "string") return Response.json({ error: "A date and IANA timezone are required." }, { status: 400 });
      await rescheduleConfirmedBooking(booking.id, input.appointmentStartAt, input.timezone);
      const { recoverBooking } = await import('../../../../_lib/booking-workflow');
      if (booking.zoomMeetingId) await recoverBooking(booking.id);
    } else {
      const { withBookingLock } = await import('../../../../_lib/booking-lock');
      await withBookingLock(booking.id, () => syncBookingCalendar(booking.id));
    }
    const current = await getCustomerBooking(booking.id);
    const processing = Boolean(current?.workflowRetryAt);
    return Response.json({ synced: !processing, processing }, { status: processing ? 202 : 200 });
  }
  catch { return Response.json({ error: "Calendar needs attention. Reconnect or retry synchronization." }, { status: 503 }); }
}
