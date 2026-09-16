import { getCalendarOwner } from "../../../_lib/calendar-oauth-security";
import { getCreatorCalendarState } from "../../../_lib/google-calendar";
export async function GET(request: Request) {
  const creatorId = new URL(request.url).searchParams.get("creatorId") ?? "";
  if (!await getCalendarOwner(request, creatorId)) return Response.json({ error: "Creator access required." }, { status: 403 });
  return Response.json({ state: await getCreatorCalendarState(creatorId) }, { headers: { "cache-control": "no-store" } });
}
