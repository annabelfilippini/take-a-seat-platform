import type { Seat } from "../_lib/creators";

export function BookingEntryLink({ seats }: { seats: Seat[] }) {
  const firstSeat = seats.reduce<Seat | undefined>((lowest, seat) =>
    !lowest || seat.unitAmount < lowest.unitAmount ? seat : lowest, undefined);
  if (!firstSeat) return null;
  return (
    <div className="profile-booking-entry">
      <span>From {firstSeat.price} · Private video call</span>
      <a className="seat-primary-button" href="#reserve">Choose a call</a>
    </div>
  );
}
