import { sql } from "drizzle-orm";

// Compare this same snapshot in the final D1 write after external availability
// calls. It prevents an edit during Google latency from authorizing a stale time.
export function bookingAvailabilityRevision(creatorId: string) {
  return sql`SELECT json_object('rules', (SELECT json_group_array(json_array(id, timezone, week_start, day_of_week, start_time, end_time, enabled, buffer_minutes, min_notice_minutes, max_bookings_per_day, max_bookings_per_week)) FROM (SELECT * FROM creator_availability_rules WHERE creator_id=${creatorId} ORDER BY id)), 'bookings', (SELECT json_group_array(json_array(id,status,updated_at,appointment_start_at,appointment_end_at,timezone)) FROM (SELECT * FROM customer_bookings WHERE creator_id=${creatorId} ORDER BY id))) AS version`;
}
export async function readBookingAvailabilityRevision(creatorId: string) {
  const { getDb } = await import("../../db");
  return (await getDb().get<{version:string}>(bookingAvailabilityRevision(creatorId)))!.version;
}
