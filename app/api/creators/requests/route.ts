import { getCreatorIntegrationAccess } from '../../../_lib/creator-access';
import { getCustomerBooking, listCreatorBookings } from '../../../_lib/bookings';
import { declineBooking } from '../../../_lib/booking-decisions';
import { acceptBooking, cancelConfirmedBooking } from '../../../_lib/booking-workflow';
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('creatorId') ?? '';
  if ((await getCreatorIntegrationAccess(request, id)).status !== 'allowed') return Response.json({ error: 'Sign in to view requests.' }, { status: 403 });
  try { return Response.json({ bookings: await listCreatorBookings(id) }, { headers: { 'cache-control': 'no-store' } }); }
  catch { return Response.json({ error: 'Requests could not load. Please retry.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({ error: 'Invalid origin.' }, { status: 403 });
  const form = await request.clone().formData();
  const booking = await getCustomerBooking(String(form.get('bookingId') ?? ''));
  if (!booking || (await getCreatorIntegrationAccess(request, booking.creatorId)).status !== 'allowed') return Response.json({ error: 'This request is unavailable.' }, { status: 403 });
  try {
    if (form.get('action') === 'decline') return Response.json({ booking: await declineBooking(booking.id) });
    if (form.get('action') === 'cancel') return Response.json({ booking: await cancelConfirmedBooking(booking.id) });
    if (form.get('action') !== 'accept') return Response.json({ error: 'Choose an action.' }, { status: 400 });
    return Response.json({ booking: await acceptBooking(booking.id) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Request could not be updated. Retry.' }, { status: 409 }); }
}
