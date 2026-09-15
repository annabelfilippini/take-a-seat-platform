"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getAvailabilityWindowStart, getViewerAvailability } from "../_lib/availability";
import type { CreatorAvailabilityRule, Seat } from "../_lib/creators";

type CustomerBookingFlowProps = {
  availabilityRules?: CreatorAvailabilityRule[];
  creatorId: string;
  creatorName: string;
  returnTo?: string;
  seats: Seat[];
  showDescriptions?: boolean;
  previewOnly?: boolean;
};

const fallbackViewerTimezone = "America/Los_Angeles";
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const subscribeHydration = () => () => {};

export function CustomerBookingFlow({
  availabilityRules = [], creatorId, creatorName, returnTo = "/with/ella", seats, showDescriptions = true, previewOnly = false,
}: CustomerBookingFlowProps) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [activeSeatId, setActiveSeatId] = useState(seats[0]?.id ?? "");
  const activeSeat = seats.find((seat) => seat.id === activeSeatId) ?? seats[0];
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [topic, setTopic] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"time" | "details">("time");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [availabilityWindowStart] = useState(() => getAvailabilityWindowStart());
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [viewerTimezone] = useState(getDetectedTimezone);
  const [visibleMonth, setVisibleMonth] = useState(() => formatMonthValue(availabilityWindowStart));

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

  useEffect(() => {
    if (!isOpen) return;
    titleRef.current?.focus();
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [isOpen, step]);

  useEffect(() => {
    const restore = () => setIsSubmitting(false);
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  const viewerAvailability = useMemo(() => getViewerAvailability({
    availabilityRules, creatorId, seat: activeSeat, viewerTimezone, windowStart: availabilityWindowStart,
  }), [activeSeat, availabilityRules, availabilityWindowStart, creatorId, viewerTimezone]);
  const availabilityByDate = useMemo(() => new Map(viewerAvailability.map((day) => [day.date, day.slots])), [viewerAvailability]);
  const visibleAvailability = viewerAvailability.filter((day) => day.date.startsWith(visibleMonth));
  const activeSelectedDate = visibleAvailability.some((day) => day.date === selectedDate)
    ? selectedDate : visibleAvailability[0]?.date ?? "";
  const selectedSlots = activeSelectedDate ? availabilityByDate.get(activeSelectedDate) ?? [] : [];
  const selectedSlot = selectedSlots.find((slot) => slot.id === selectedSlotId) ?? null;
  const appointmentStartAt = selectedSlot?.sourceAppointmentStartAt ?? "";
  const appointmentTimezone = selectedSlot?.sourceTimezone ?? viewerTimezone;
  const customerNote = [
    customerPhone.trim() ? `Phone: ${customerPhone.trim()}` : null,
    socialHandle.trim() ? `Instagram handle: ${socialHandle.trim()}` : null,
    topic.trim() ? `Wants to talk about: ${topic.trim()}` : null,
  ].filter(Boolean).join("\n\n");
  const firstMonth = formatMonthValue(availabilityWindowStart);
  const lastMonth = viewerAvailability.at(-1)?.date.slice(0, 7) ?? firstMonth;
  const nextAvailableDate = viewerAvailability.find((day) => day.date.slice(0, 7) > visibleMonth)?.date;

  function openBooking() {
    setStep("time");
    setIsSubmitting(false);
    setIsOpen(true);
  }

  function selectSeat(seatId: string) {
    setActiveSeatId(seatId);
    setSelectedSlotId("");
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlotId("");
  }

  function changeMonth(direction: -1 | 1) {
    const [year, month] = visibleMonth.split("-").map(Number);
    const nextMonth = formatMonthValue(new Date(year, month - 1 + direction, 1));
    setVisibleMonth(nextMonth);
    selectDate("");
  }

  const bookingDialog = isOpen && activeSeat ? (
    <dialog ref={dialogRef} onCancel={() => setIsOpen(false)} aria-labelledby={`${id}-title`}
      className="customer-booking-overlay">
      <div className={`customer-booking-modal customer-booking-${step}`}>
        <header className="customer-booking-header">
          <div>
            <p className="customer-booking-steps">{step === "time" ? "1. Your time" : "2. Your details"} · Payment next</p>
            <h2 id={`${id}-title`} ref={titleRef} tabIndex={-1}>{step === "time" ? "Find your moment" : "Your details"}</h2>
          </div>
          <button aria-label="Close booking" className="customer-booking-close" onClick={() => setIsOpen(false)} type="button">×</button>
        </header>
        <div className="customer-booking-summary">
          <div className="customer-booking-summary-row">
            <strong>{creatorName}</strong>
            {step === "details" ? <button className="customer-booking-text-button" onClick={() => setStep("time")} type="button">Edit time</button> : null}
          </div>
          <span>{activeSeat.name} · {activeSeat.price} · Google Meet</span>
          {step === "details" && selectedSlot ? <strong className="customer-booking-selected-time">{formatSelectedDate(activeSelectedDate)} · {selectedSlot.displayTime}</strong> : null}
          <span>Times shown in {viewerTimezone.replaceAll("_", " ")}</span>
        </div>
        <div className="customer-booking-scroll" ref={scrollRef}>
          {step === "time" ? (
            <div className="customer-booking-body">
              <section aria-label={`Select a date with ${creatorName}`} className="customer-calendar-panel">
                <div className="customer-calendar-topline">
                  <button aria-label="Show previous month" disabled={visibleMonth <= firstMonth} onClick={() => changeMonth(-1)} type="button">‹</button>
                  <h3 aria-live="polite">{formatMonthHeading(visibleMonth)}</h3>
                  <button aria-label="Show next month" disabled={visibleMonth >= lastMonth} onClick={() => changeMonth(1)} type="button">›</button>
                </div>
                <div className="customer-calendar-weekdays" aria-hidden="true">{weekdayLabels.map((label) => <span key={label}>{label}</span>)}</div>
                <div className="customer-calendar-grid">
                  {getCalendarCells(visibleMonth).map((cell, index) => cell ? (
                    <button aria-label={formatSelectedDate(cell.date)} aria-pressed={cell.date === activeSelectedDate}
                      className={["customer-calendar-day", availabilityByDate.has(cell.date) ? "has-times" : "", cell.date === activeSelectedDate ? "selected" : ""].filter(Boolean).join(" ")}
                      disabled={!availabilityByDate.has(cell.date)} key={cell.date} onClick={() => selectDate(cell.date)} type="button">{cell.day}</button>
                  ) : <span aria-hidden="true" className="customer-calendar-empty" key={`empty-${index}`} />)}
                </div>
              </section>
              <section className="customer-times-panel" aria-label="Select a time">
                <div className="customer-times-heading" aria-live="polite"><strong>{activeSelectedDate ? formatSelectedDate(activeSelectedDate) : `No open dates in ${formatMonthHeading(visibleMonth)}`}</strong></div>
                <div className="customer-time-options">{selectedSlots.map((slot) => (
                  <button aria-pressed={slot.id === selectedSlotId} className={slot.id === selectedSlotId ? "selected" : ""} key={slot.id} onClick={() => setSelectedSlotId(slot.id)} type="button">{slot.displayTime}</button>
                ))}</div>
                {!selectedSlots.length ? <div className="customer-booking-prompt"><p>No open times are listed for this month yet.</p>
                  {nextAvailableDate ? <button className="customer-booking-text-button" type="button" onClick={() => { setVisibleMonth(nextAvailableDate.slice(0, 7)); selectDate(nextAvailableDate); }}>Show next available date</button> : <p>Please check back for new availability.</p>}
                </div> : null}
              </section>
            </div>
          ) : selectedSlot ? (
            <form id={`${id}-form`} action="/api/bookings/request" className="customer-booking-form" method="post"
              onSubmit={(event) => {
                if (isSubmitting) { event.preventDefault(); return; }
                setIsSubmitting(true);
              }}>
              <input name="creatorId" type="hidden" value={creatorId} />
              <input name="seatId" type="hidden" value={activeSeat.id} />
              <input name="returnTo" type="hidden" value={returnTo} />
              <input name="appointmentStartAt" type="hidden" value={appointmentStartAt} />
              <input name="timezone" type="hidden" value={appointmentTimezone} />
              <input name="customerNote" type="hidden" value={customerNote} />
              <div className="customer-booking-fields">
                <label><span>Name</span><input autoComplete="name" name="customerName" onChange={(event) => setCustomerName(event.target.value)} required value={customerName} maxLength={200} /></label>
                <label><span>Email address</span><input autoComplete="email" name="customerEmail" onChange={(event) => setCustomerEmail(event.target.value)} required type="email" value={customerEmail} maxLength={320} /></label>
                <label><span>What do you want to talk about with {creatorName}?</span><textarea onChange={(event) => setTopic(event.target.value)} placeholder="A sentence or two is plenty." required rows={3} value={topic} maxLength={1500} /></label>
              </div>
              <details className="customer-booking-optional"><summary>Additional details (optional)</summary>
                <div className="customer-booking-fields">
                  <label><span>Phone number (optional)</span><input autoComplete="tel" inputMode="tel" onChange={(event) => setCustomerPhone(event.target.value)} type="tel" value={customerPhone} maxLength={50} /></label>
                  <label><span>Instagram handle (optional)</span><input autoComplete="off" onChange={(event) => setSocialHandle(event.target.value)} placeholder="@yourhandle" value={socialHandle} maxLength={100} /></label>
                </div>
              </details>
            </form>
          ) : <p className="customer-booking-prompt">Please go back and choose an available time.</p>}
        </div>
        <footer className="customer-booking-footer">
          {step === "time" ? (
            <><p className="customer-booking-disclaimer" aria-live="polite">{selectedSlot ? `${activeSeat.price} · ${selectedSlot.displayTime} · ${viewerTimezone.replaceAll("_", " ")}` : "Choose a time to continue. No account needed."}</p>
              <button className="seat-primary-button" disabled={!selectedSlot} onClick={() => setStep("details")} type="button">Continue</button></>
          ) : (
            <><p className="customer-booking-disclaimer">Payment is authorized next, which may place a temporary hold on your card. {`You won't be charged unless ${creatorName} accepts your appointment.`}</p>
              <div className="customer-booking-footer-actions"><button className="customer-booking-text-button" onClick={() => setStep("time")} type="button">Back</button>
                <button className="seat-primary-button" disabled={previewOnly || !selectedSlot || isSubmitting} form={`${id}-form`} type="submit">{previewOnly ? "Preview only" : isSubmitting ? "Opening secure payment…" : `Continue to payment · ${activeSeat.price}`}</button></div></>
          )}
        </footer>
      </div>
    </dialog>
  ) : null;

  return (
    <>
      <div className="booking-seat-options" role="group" aria-label="Choose a call">
        {seats.map((seat) => <button className="booking-seat-choice" aria-pressed={seat.id === activeSeat?.id} key={seat.id} onClick={() => selectSeat(seat.id)} type="button">
          <span className="booking-seat-heading"><strong>{seat.name}</strong><strong>{seat.price}</strong></span>
          {showDescriptions && (seat.description || seat.durationMinutes) ? <span>{seat.durationMinutes ? `${seat.durationMinutes} minutes · ` : ""}{seat.description}</span> : null}
        </button>)}
        <button className="seat-primary-button" disabled={!hydrated || !activeSeat} onClick={openBooking} type="button">Find availability</button>
        <p className="booking-guest-note">No account needed.</p>
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
