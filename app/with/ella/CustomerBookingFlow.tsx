"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getAvailabilityWindowStart,
  getViewerAvailability,
} from "../../_lib/availability";
import type { CreatorAvailabilityRule, Seat } from "../../_lib/creators";

type CustomerBookingFlowProps = {
  availabilityRules?: CreatorAvailabilityRule[];
  creatorId: string;
  creatorName: string;
  returnTo?: string;
  seats: Seat[];
};

const fallbackViewerTimezone = "America/Los_Angeles";
const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

export function CustomerBookingFlow({
  availabilityRules = [],
  creatorId,
  creatorName,
  returnTo = "/with/ella",
  seats,
}: CustomerBookingFlowProps) {
  const firstSeat = seats[0];
  const [activeSeatId, setActiveSeatId] = useState(firstSeat?.id ?? "");
  const activeSeat = seats.find((seat) => seat.id === activeSeatId) ?? firstSeat;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [topic, setTopic] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    const trigger = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = originalOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [isOpen]);
  const [availabilityWindowStart] = useState(() => getAvailabilityWindowStart());
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [viewerTimezone] = useState(getDetectedTimezone);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    formatMonthValue(availabilityWindowStart),
  );

  const viewerAvailability = useMemo(
    () =>
      getViewerAvailability({
        availabilityRules,
        creatorId,
        seat: activeSeat,
        viewerTimezone,
        windowStart: availabilityWindowStart,
      }),
    [activeSeat, availabilityRules, availabilityWindowStart, creatorId, viewerTimezone],
  );
  const availabilityByDate = useMemo(
    () => new Map(viewerAvailability.map((day) => [day.date, day.slots])),
    [viewerAvailability],
  );
  const visibleAvailability = viewerAvailability.filter((day) =>
    day.date.startsWith(visibleMonth),
  );
  const activeSelectedDate = visibleAvailability.some(
    (day) => day.date === selectedDate,
  )
    ? selectedDate
    : visibleAvailability[0]?.date ?? "";
  const selectedSlots = activeSelectedDate
    ? availabilityByDate.get(activeSelectedDate) ?? []
    : [];
  const selectedSlot =
    selectedSlots.find((slot) => slot.id === selectedSlotId) ?? null;
  const appointmentStartAt = selectedSlot?.sourceAppointmentStartAt ?? "";
  const appointmentTimezone = selectedSlot?.sourceTimezone ?? viewerTimezone;
  const customerName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const customerNote = [
    customerPhone.trim() ? `Phone: ${customerPhone.trim()}` : null,
    socialHandle.trim() ? `Instagram handle: ${socialHandle.trim()}` : null,
    topic.trim() ? `Wants to talk about: ${topic.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  function openBooking(seatId: string) {
    setActiveSeatId(seatId);
    setSelectedSlotId("");
    setIsOpen(true);
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlotId("");
  }

  function changeMonth(direction: -1 | 1) {
    const [year, month] = visibleMonth.split("-").map(Number);
    const next = new Date(year, month - 1 + direction, 1);
    const nextMonth = formatMonthValue(next);
    const firstAvailableDate =
      viewerAvailability.find((day) => day.date.startsWith(nextMonth))?.date ?? "";

    setVisibleMonth(nextMonth);
    setSelectedDate(firstAvailableDate);
    setSelectedSlotId("");
  }

  const bookingDialog =
    isOpen && activeSeat ? (
      <dialog
        ref={dialogRef}
        onCancel={() => setIsOpen(false)}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
          ));
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        aria-labelledby="customer-booking-title"
        aria-modal="true"
        className="customer-booking-overlay"
      >
        <div className="customer-booking-modal">
          <header className="customer-booking-header">
            <div>
              <h2 id="customer-booking-title">Find availability</h2>
              <p>
                {activeSeat.name} with {creatorName}
              </p>
            </div>
            <button
              aria-label="Close booking calendar"
              className="customer-booking-close"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              x
            </button>
          </header>

          <div className="customer-booking-summary">
            <span>{`Times shown in ${viewerTimezone.replaceAll("_", " ")}`}</span>
            <strong>1:1 Video Consultation</strong>
            <span>
              {activeSeat.name} - private request - {activeSeat.price}
            </span>
          </div>

          <div className="customer-booking-body">
            <section
              aria-label={`Select a date with ${creatorName}`}
              className="customer-calendar-panel"
            >
              <div className="customer-calendar-topline">
                <div className="customer-calendar-controls">
                  <button
                    aria-label="Show previous month"
                    onClick={() => changeMonth(-1)}
                    type="button"
                  >
                    &lt;
                  </button>
                  <button
                    aria-label="Show next month"
                    onClick={() => changeMonth(1)}
                    type="button"
                  >
                    &gt;
                  </button>
                </div>
                <h3>{formatMonthHeading(visibleMonth)}</h3>
              </div>
              <div className="customer-calendar-weekdays" aria-hidden="true">
                {weekdayLabels.map((label, index) => (
                  <span key={`${label}-${index}`}>{label}</span>
                ))}
              </div>
              <div className="customer-calendar-grid">
                {getCalendarCells(visibleMonth).map((cell, index) =>
                  cell ? (
                    <button
                      aria-pressed={cell.date === activeSelectedDate}
                      className={[
                        "customer-calendar-day",
                        availabilityByDate.has(cell.date) ? "has-times" : "",
                        cell.date === activeSelectedDate ? "selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={!availabilityByDate.has(cell.date)}
                      key={cell.date}
                      onClick={() => selectDate(cell.date)}
                      type="button"
                    >
                      {cell.day}
                    </button>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="customer-calendar-empty"
                      key={`empty-${visibleMonth}-${index}`}
                    />
                  ),
                )}
              </div>
            </section>

            <section className="customer-times-panel" aria-label="Select a time">
              <div className="customer-times-heading">
                <strong>
                  {activeSelectedDate
                    ? formatSelectedDate(activeSelectedDate)
                    : `No open dates in ${formatMonthHeading(visibleMonth)}`}
                </strong>
              </div>
              <div className="customer-time-options">
                {selectedSlots.map((slot) => (
                  <button
                    className={slot.id === selectedSlotId ? "selected" : ""}
                    key={slot.id}
                    onClick={() => setSelectedSlotId(slot.id)}
                    type="button"
                  >
                    {slot.displayTime}
                  </button>
                ))}
              </div>
              {!selectedSlots.length ? (
                <p className="customer-booking-prompt">
                  No open times are listed for this month yet.
                </p>
              ) : null}
              {selectedSlot ? (
                <form
                  action="/api/bookings/request"
                  className="customer-booking-form"
                  method="post"
                >
                  <input name="creatorId" type="hidden" value={creatorId} />
                  <input name="seatId" type="hidden" value={activeSeat.id} />
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <input
                    name="appointmentStartAt"
                    type="hidden"
                    value={appointmentStartAt}
                  />
                  <input name="timezone" type="hidden" value={appointmentTimezone} />
                  <input name="customerName" type="hidden" value={customerName} />
                  <input name="customerNote" type="hidden" value={customerNote} />
                  <div className="customer-booking-fields">
                    <label>
                      <span>First name</span>
                      <input
                        autoComplete="given-name"
                        onChange={(event) => setFirstName(event.target.value)}
                        required
                        value={firstName}
                      />
                    </label>
                    <label>
                      <span>Last name</span>
                      <input
                        autoComplete="family-name"
                        onChange={(event) => setLastName(event.target.value)}
                        required
                        value={lastName}
                      />
                    </label>
                    <label>
                      <span>Email address</span>
                      <input
                        autoComplete="email"
                        name="customerEmail"
                        required
                        type="email"
                      />
                    </label>
                    <label>
                      <span>Phone number</span>
                      <input
                        autoComplete="tel"
                        inputMode="tel"
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        required
                        type="tel"
                        value={customerPhone}
                      />
                    </label>
                    <label>
                      <span>Instagram handle</span>
                      <input
                        autoComplete="off"
                        onChange={(event) => setSocialHandle(event.target.value)}
                        placeholder="@yourhandle"
                        value={socialHandle}
                      />
                    </label>
                    <label className="customer-booking-field-wide">
                      <span>What do you want to talk about with {creatorName}?</span>
                      <textarea
                        onChange={(event) => setTopic(event.target.value)}
                        required
                        rows={2}
                        value={topic}
                      />
                    </label>
                  </div>
                  <p className="customer-booking-disclaimer">
                    {`You won't be charged unless ${creatorName} accepts your appointment.`}
                  </p>
                  <button className="seat-primary-button" type="submit">
                    Go to payment next
                  </button>
                </form>
              ) : null}
            </section>
          </div>
        </div>
      </dialog>
    ) : null;

  return (
    <>
      <div className="seat-options">
        {seats.map((seat) => (
          <article className="seat-option" key={seat.id}>
            <div className="seat-option-heading">
              <h3>{seat.name}</h3>
              <span>{seat.format}</span>
            </div>
            <dl className="seat-detail-list">
              <div>
                <dt>Host</dt>
                <dd>{seat.host}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{seat.name}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{seat.price}</dd>
              </div>
            </dl>
            <p>{seat.description}</p>
            <button
              className="seat-primary-button"
              onClick={() => openBooking(seat.id)}
              type="button"
            >
              Find Availability
            </button>
          </article>
        ))}
      </div>

      {typeof document === "undefined" ? null : createPortal(bookingDialog, document.body)}
    </>
  );
}

function getCalendarCells(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ date: string; day: number } | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      day,
    });
  }

  return cells;
}

function getDetectedTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || fallbackViewerTimezone;
}

function formatMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthHeading(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatSelectedDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(date);
}
