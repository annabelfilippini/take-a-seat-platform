"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CreatorAvailabilityRule, Seat } from "../../_lib/creators";

type CustomerBookingFlowProps = {
  availabilityRules?: CreatorAvailabilityRule[];
  creatorId: string;
  creatorName: string;
  returnTo?: string;
  seats: Seat[];
};

type AvailabilityDay = {
  date: string;
  times: string[];
};

type ViewerSlot = {
  appointmentStartAt: string;
  displayTime: string;
  id: string;
  localDate: string;
  startsAtUtc: number;
};

const fallbackViewerTimezone = "America/Los_Angeles";
const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];
const defaultAvailabilityWindowDays = 75;
const ellaAvailability: AvailabilityDay[] = [
  { date: "2026-09-17", times: ["09:30", "11:00"] },
  { date: "2026-09-22", times: ["10:00", "12:30", "15:00"] },
  { date: "2026-09-24", times: ["09:00", "14:00"] },
  { date: "2026-09-29", times: ["09:30", "11:00"] },
  { date: "2026-10-01", times: ["10:30", "13:00"] },
  { date: "2026-10-06", times: ["09:30", "16:00"] },
  { date: "2026-10-08", times: ["11:30", "14:30"] },
];

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
  const appointmentStartAt = selectedSlot?.appointmentStartAt ?? "";
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
      <div
        aria-labelledby="customer-booking-title"
        aria-modal="true"
        className="customer-booking-overlay"
        role="dialog"
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
                  <input name="timezone" type="hidden" value={viewerTimezone} />
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
                      <span>What do you want to talk about with Ella?</span>
                      <textarea
                        onChange={(event) => setTopic(event.target.value)}
                        required
                        rows={2}
                        value={topic}
                      />
                    </label>
                  </div>
                  <button className="seat-primary-button" type="submit">
                    Send request
                  </button>
                </form>
              ) : null}
            </section>
          </div>
        </div>
      </div>
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

function getAvailabilityWindowStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getViewerAvailability({
  availabilityRules,
  creatorId,
  seat,
  viewerTimezone,
  windowStart,
}: {
  availabilityRules: CreatorAvailabilityRule[];
  creatorId: string;
  seat: Seat | undefined;
  viewerTimezone: string;
  windowStart: Date;
}) {
  const sourceAvailability = availabilityRules.length
    ? getRuleAvailabilityDays(availabilityRules, seat, windowStart)
    : getFallbackAvailabilityDays(creatorId);
  const creatorTimezone = sourceAvailability[0]?.timezone ?? fallbackViewerTimezone;
  const slots = sourceAvailability.flatMap((day) =>
    day.times.map((time) => {
      const instant = zonedTimeToUtc(day.date, time, creatorTimezone);
      const localDate = formatDateValueInTimezone(instant, viewerTimezone);

      return {
        appointmentStartAt: formatLocalDateTimeInTimezone(instant, viewerTimezone),
        displayTime: formatTimeInTimezone(instant, viewerTimezone),
        id: `${day.date}-${time}-${viewerTimezone}`,
        localDate,
        startsAtUtc: instant.getTime(),
      };
    }),
  );
  const groupedAvailability = new Map<string, ViewerSlot[]>();

  slots
    .sort((first, second) => first.startsAtUtc - second.startsAtUtc)
    .forEach((slot) => {
      const daySlots = groupedAvailability.get(slot.localDate) ?? [];
      daySlots.push(slot);
      groupedAvailability.set(slot.localDate, daySlots);
    });

  return Array.from(groupedAvailability, ([date, daySlots]) => ({
    date,
    slots: daySlots,
  })).sort((first, second) => first.date.localeCompare(second.date));
}

function getFallbackAvailabilityDays(creatorId: string) {
  if (creatorId !== "ella") {
    return [];
  }

  return ellaAvailability.map((day) => ({
    ...day,
    timezone: "America/New_York",
  }));
}

function getRuleAvailabilityDays(
  rules: CreatorAvailabilityRule[],
  seat: Seat | undefined,
  windowStart: Date,
) {
  const enabledRules = rules.filter((rule) => rule.enabled !== false);
  const days: Array<AvailabilityDay & { timezone: string }> = [];
  const durationMinutes = getSeatDurationMinutes(seat);

  for (let index = 0; index < defaultAvailabilityWindowDays; index += 1) {
    const date = addDays(windowStart, index);
    const dateRules = enabledRules.filter((rule) => rule.dayOfWeek === date.getDay());

    if (!dateRules.length) {
      continue;
    }

    const times = dateRules.flatMap((rule) =>
      getAvailabilityTimesForRule(rule, durationMinutes),
    );

    if (times.length) {
      days.push({
        date: formatLocalDateValue(date),
        times: Array.from(new Set(times)).sort(),
        timezone: dateRules[0]?.timezone ?? fallbackViewerTimezone,
      });
    }
  }

  return days;
}

function getAvailabilityTimesForRule(
  rule: CreatorAvailabilityRule,
  durationMinutes: number,
) {
  const times: string[] = [];
  const bufferMinutes = rule.bufferMinutes ?? 0;
  const stepMinutes = Math.max(15, durationMinutes + bufferMinutes);
  let cursor = getMinutesFromTime(rule.startTime);
  const endMinutes = getMinutesFromTime(rule.endTime);

  while (cursor + durationMinutes <= endMinutes) {
    times.push(formatMinutesAsTime(cursor));
    cursor += stepMinutes;
  }

  return times;
}

function getSeatDurationMinutes(seat: Seat | undefined) {
  const match = seat?.name.match(/\d+/u);
  const minutes = match ? Number(match[0]) : 15;

  return Number.isFinite(minutes) && minutes > 0 ? minutes : 15;
}

function getMinutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesAsTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function formatLocalDateValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function zonedTimeToUtc(dateValue: string, timeValue: string, timezone: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const offset = getTimezoneOffset(utcGuess, timezone);

  return new Date(utcGuess.getTime() - offset);
}

function getTimezoneOffset(date: Date, timezone: string) {
  const parts = getDateTimeParts(date, timezone);
  const zonedTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return zonedTimestamp - date.getTime();
}

function formatDateValueInTimezone(date: Date, timezone: string) {
  const parts = getDateTimeParts(date, timezone);

  return [
    parts.year,
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function formatLocalDateTimeInTimezone(date: Date, timezone: string) {
  const parts = getDateTimeParts(date, timezone);

  return `${formatDateValueInTimezone(date, timezone)}T${String(parts.hour).padStart(
    2,
    "0",
  )}:${String(parts.minute).padStart(2, "0")}:00`;
}

function formatTimeInTimezone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

function getDateTimeParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);

  return {
    day: Number(parts.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(parts.minute),
    month: Number(parts.month),
    second: Number(parts.second),
    year: Number(parts.year),
  };
}
