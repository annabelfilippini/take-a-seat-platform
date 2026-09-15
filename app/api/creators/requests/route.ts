import { getCreatorIntegrationAccess } from '../../../_lib/creator-access';
import { getCustomerBooking, listCreatorBookings } from '../../../_lib/bookings';
import { declineBooking } from '../../../_lib/booking-decisions';
import { POST as approve } from '../../bookings/approve/route';
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('creatorId') ?? '';
  if ((await getCreatorIntegrationAccess(request, id)).status !== 'allowed') return Response.json({ error: 'Sign in to view requests.' }, { status: 403 });
  try { return Response.json({ bookings: await listCreatorBookings(id) }, { headers: { 'cache-control': 'no-store' } }); }
  catch { return Response.json({ error: 'Requests could not load. Please retry.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  const form = await request.clone().formData();
  const booking = await getCustomerBooking(String(form.get('bookingId') ?? ''));
  if (!booking || (await getCreatorIntegrationAccess(request, booking.creatorId)).status !== 'allowed') return Response.json({ error: 'This request is unavailable.' }, { status: 403 });
  try {
    if (form.get('action') === 'decline') return Response.json({ booking: await declineBooking(booking.id) });
    if (form.get('action') !== 'accept') return Response.json({ error: 'Choose an action.' }, { status: 400 });
    const response = await approve(request);
    const status = new URL(response.headers.get('location')!, request.url).searchParams;
    if (!['sent', 'accepted'].includes(status.get('calendar') ?? '')) throw new Error(status.get('detail') === 'calendar-conflict'
      ? 'This time now conflicts with your calendar. Decline the request or resolve the conflict and retry.' : 'Acceptance could not finish. Retry to safely continue the payment and calendar confirmation.');
    return Response.json({ booking: await getCustomerBooking(booking.id) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Request could not be updated. Retry.' }, { status: 409 }); }
}
