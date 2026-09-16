import { getBookableTimes } from "../../../_lib/bookable-times";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const month = params.get("month") ?? "";
  const timezone = params.get("timezone") ?? "";
  const headers = { "cache-control": "no-store" };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return Response.json({ error: "Invalid month." }, { status: 400, headers });
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { return Response.json({ error: "Invalid timezone." }, { status: 400, headers }); }
  const now = Date.now(), target = Date.parse(`${month}-01T00:00:00Z`);
  if (target < now - 32 * 86400000 || target > now + 370 * 86400000) return Response.json({ days: [] }, { headers });
  try {
    return Response.json({ days: await getBookableTimes(params.get("creatorId") ?? "", params.get("seatId") ?? "", timezone, month) }, { headers });
  } catch {
    return Response.json({ days: [], error: "Availability could not be checked. Please try again shortly." }, { status: 503, headers });
  }
}
