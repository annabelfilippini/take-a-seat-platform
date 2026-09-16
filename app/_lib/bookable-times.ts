import { eq } from "drizzle-orm";
import { creatorCalendarConnections } from "../../db/schema";
import { getBookableCreatorById } from "./creator-onboarding";
import { getMatchedAvailabilitySlot, getViewerAvailability } from "./availability";
import { isBookingSlotAvailable, listCreatorBookings } from "./bookings";
import { getCreatorBusyPeriods } from "./google-calendar";
import { reconcileCheckoutHolds } from "./checkout-holds";

export async function getBookableTimes(creatorId: string, seatId: string, timezone: string, month: string) {
  const creator = await getBookableCreatorById(creatorId);
  const seat = creator?.seats.find(item => item.id === seatId);
  if (!creator || !seat) return [];
  const start = new Date(`${month}-01T00:00:00Z`);
  const days = getViewerAvailability({ creatorId, seat, availabilityRules: creator.availabilityRules ?? [], viewerTimezone: timezone, windowStart: start, windowDays: 35 }).filter(day => day.date.startsWith(month));
  const { getDb } = await import("../../db");
  const [connection] = await getDb().select({ id: creatorCalendarConnections.id }).from(creatorCalendarConnections).where(eq(creatorCalendarConnections.creatorId, creatorId));
  // Explicit disconnection removes Google's influence on the saved schedule.
  // Checkout/confirmation still requires a usable Calendar for invitation delivery.
  const busy = connection ? await getCreatorBusyPeriods(creatorId, new Date(start.getTime() - 86400000), new Date(start.getTime() + 34 * 86400000)) : [];
  await reconcileCheckoutHolds(await listCreatorBookings(creatorId));
  const bookings = await listCreatorBookings(creatorId);
  const result = [];
  for (const day of days) {
    const slots = [];
    for (const candidate of day.slots) {
      const input = { appointmentStartAt: candidate.sourceAppointmentStartAt, timezone: candidate.sourceTimezone, customerEmail: "", customerName: null, customerNote: null };
      const slot = getMatchedAvailabilitySlot({ ...input, creatorId, seat, availabilityRules: creator.availabilityRules ?? [] });
      if (!slot) continue;
      const pad = slot.bufferMinutes * 60000;
      if (busy.some(period => period.start < slot.appointmentEndUtc.getTime() + pad && period.end > slot.appointmentStartUtc.getTime() - pad)) continue;
      if (await isBookingSlotAvailable({ creator, input, seat, bookings })) slots.push(candidate);
    }
    if (slots.length) result.push({ date: day.date, slots });
  }
  return result;
}
