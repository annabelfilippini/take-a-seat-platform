import { getCalendarOwner } from "../../../_lib/calendar-oauth-security";
import { disconnectCreatorCalendar } from "../../../_lib/google-calendar";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const form = await request.formData();
  const creatorId = String(form.get("creatorId") ?? "");
  if (!await getCalendarOwner(request, creatorId)) return Response.json({ error: "Creator access required." }, { status: 403 });
  const revoked = await disconnectCreatorCalendar(creatorId);
  return Response.json({ state: "not-connected", message: revoked
    ? "Google Calendar disconnected. Your saved availability and bookings are unchanged."
    : "Disconnected and credentials removed. Google could not confirm revocation; remove Take a Seat in your Google Account permissions too." }, { headers: { "cache-control": "no-store" } });
}
