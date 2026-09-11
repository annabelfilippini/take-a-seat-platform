import {
  createCustomerCalendarIcs,
  getCustomerBooking,
  getCustomerCalendarFilename,
} from "../../../../bookings";

type BookingCalendarRouteProps = {
  params: {
    bookingId: string;
  };
};

export async function GET(_request: Request, { params }: BookingCalendarRouteProps) {
  const booking = await getCustomerBooking(params.bookingId);

  if (!booking) {
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
