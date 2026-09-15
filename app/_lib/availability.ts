import { seatDuration } from "./offerings";
import { availabilityDateBounds, availabilityWeekStart, rulesForAvailabilityWeek } from "./availability-weeks";
import type { CreatorAvailabilityRule, Seat } from "./creators";

export type ViewerAvailabilityDay = {
  date: string;
  slots: ViewerAvailabilitySlot[];
};

export type ViewerAvailabilitySlot = {
  appointmentStartAt: string;
  displayTime: string;
  id: string;
  localDate: string;
  sourceAppointmentStartAt: string;
  sourceTimezone: string;
  startsAtUtc: number;
};

export type MatchedAvailabilitySlot = {
  bufferMinutes: number;
  appointmentEndUtc: Date;
  appointmentStartUtc: Date;
  creatorDate: string;
  creatorTimezone: string;
  maxBookingsPerDay: number | null;
  maxBookingsPerWeek: number | null;
};

type SourceAvailabilitySlot = {
  bufferMinutes: number;
  date: string;
  maxBookingsPerDay: number | null;
  maxBookingsPerWeek: number | null;
  startsAtUtc: number;
  time: string;
  timezone: string;
};

// Include both sides of the date line and the longest one-year creator window.
const defaultAvailabilityWindowDays = 370;
const ellaAvailability = [
  { date: "2026-09-17", times: ["09:30", "11:00"] },
  { date: "2026-09-22", times: ["10:00", "12:30", "15:00"] },
  { date: "2026-09-24", times: ["09:00", "14:00"] },
  { date: "2026-09-29", times: ["09:30", "11:00"] },
  { date: "2026-10-01", times: ["10:30", "13:00"] },
  { date: "2026-10-06", times: ["09:30", "16:00"] },
  { date: "2026-10-08", times: ["11:30", "14:30"] },
];

export function getAvailabilityWindowStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getViewerAvailability({
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
}): ViewerAvailabilityDay[] {
  const sourceSlots = getSourceAvailabilitySlots({
    availabilityRules,
    creatorId,
    now: new Date(),
    seat,
    windowStart,
  });
  const groupedAvailability = new Map<string, ViewerAvailabilitySlot[]>();

  sourceSlots
    .map((slot) => {
      const instant = new Date(slot.startsAtUtc);
      const localDate = formatDateValueInTimezone(instant, viewerTimezone);

      return {
        appointmentStartAt: formatLocalDateTimeInTimezone(instant, viewerTimezone),
        displayTime: formatTimeInTimezone(instant, viewerTimezone),
        id: `${slot.date}-${slot.time}-${viewerTimezone}`,
        localDate,
        sourceAppointmentStartAt: `${slot.date}T${slot.time}:00`,
        sourceTimezone: slot.timezone,
        startsAtUtc: slot.startsAtUtc,
      };
    })
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

export function getMatchedAvailabilitySlot({
  appointmentStartAt,
  availabilityRules,
  creatorId,
  seat,
  timezone,
}: {
  appointmentStartAt: string;
  availabilityRules: CreatorAvailabilityRule[];
  creatorId: string;
  seat: Seat;
  timezone: string;
}): MatchedAvailabilitySlot | null {
  const requestedStartUtc = localDateTimeToUtc(appointmentStartAt, timezone);

  if (!requestedStartUtc || !Number.isFinite(requestedStartUtc.getTime())) {
    return null;
  }

  const durationMinutes = getSeatDurationMinutes(seat);
  const matchedSlot = getSourceAvailabilitySlots({
    availabilityRules,
    creatorId,
    now: new Date(),
    seat,
    windowStart: getAvailabilityWindowStart(),
  }).find((slot) => slot.startsAtUtc === requestedStartUtc.getTime());

  if (!matchedSlot) {
    return null;
  }

  return {
    bufferMinutes: matchedSlot.bufferMinutes,
    appointmentEndUtc: addMinutes(requestedStartUtc, durationMinutes),
    appointmentStartUtc: requestedStartUtc,
    creatorDate: matchedSlot.date,
    creatorTimezone: matchedSlot.timezone,
    maxBookingsPerDay: matchedSlot.maxBookingsPerDay,
    maxBookingsPerWeek: matchedSlot.maxBookingsPerWeek,
  };
}

export function getWeekKey(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - day);

  return formatUtcDateValue(date);
}

export function localDateTimeToUtc(value: string, timezone: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/u);

  if (!match) {
    return null;
  }

  try {
    const instant = zonedTimeToUtc(match[1], match[2], timezone);
    return Number.isFinite(instant.getTime()) ? instant : null;
  } catch {
    return null;
  }
}

export function getDateValueInTimezone(date: Date, timezone: string) {
  return formatDateValueInTimezone(date, timezone);
}

function getSourceAvailabilitySlots({
  availabilityRules,
  creatorId,
  now,
  seat,
  windowStart,
}: {
  availabilityRules: CreatorAvailabilityRule[];
  creatorId: string;
  now: Date;
  seat: Seat | undefined;
  windowStart: Date;
}) {
  const sourceSlots = availabilityRules.length
    ? getRuleAvailabilitySlots(availabilityRules, seat, windowStart, now)
    : getFallbackAvailabilitySlots(creatorId).filter((slot) => slot.startsAtUtc >= now.getTime() && slot.startsAtUtc >= windowStart.getTime());

  return sourceSlots.sort((first, second) => first.startsAtUtc - second.startsAtUtc);
}

function getFallbackAvailabilitySlots(creatorId: string): SourceAvailabilitySlot[] {
  if (creatorId !== "ella") {
    return [];
  }

  return ellaAvailability.flatMap((day) =>
    day.times.map((time) => {
      const timezone = "America/New_York";

      return {
        date: day.date,
        bufferMinutes: 0,
        maxBookingsPerDay: null,
        maxBookingsPerWeek: null,
        startsAtUtc: zonedTimeToUtc(day.date, time, timezone).getTime(),
        time,
        timezone,
      };
    }),
  );
}

function getRuleAvailabilitySlots(
  rules: CreatorAvailabilityRule[],
  seat: Seat | undefined,
  windowStart: Date,
  now: Date,
): SourceAvailabilitySlot[] {
  const boundsByTimezone = new Map(rules.map((rule) => [rule.timezone, availabilityDateBounds(rule.timezone, now)]));
  const slots: SourceAvailabilitySlot[] = [];
  const durationMinutes = getSeatDurationMinutes(seat);

  for (let index = 0; index < defaultAvailabilityWindowDays; index += 1) {
    const date = addDays(windowStart, index - 2);
    const dateValue = formatLocalDateValue(date);
    const dateRules = rulesForAvailabilityWeek(rules, availabilityWeekStart(dateValue))
      .filter((rule) => rule.enabled !== false && rule.dayOfWeek === date.getDay());

    for (const rule of dateRules) {
      const bounds = boundsByTimezone.get(rule.timezone)!;
      if (dateValue < bounds.today || dateValue > bounds.end) continue;
      const minNoticeMinutes = Math.max(0, rule.minNoticeMinutes ?? 0);
      const minimumStart = now.getTime() + minNoticeMinutes * 60_000;

      for (const time of getAvailabilityTimesForRule(rule, durationMinutes)) {
        const startsAtUtc = zonedTimeToUtc(dateValue, time, rule.timezone).getTime();

        if (!Number.isFinite(startsAtUtc) || startsAtUtc < minimumStart) {
          continue;
        }

        slots.push({
          date: dateValue,
          bufferMinutes: rule.bufferMinutes ?? 0,
          maxBookingsPerDay: rule.maxBookingsPerDay ?? null,
          maxBookingsPerWeek: rule.maxBookingsPerWeek ?? null,
          startsAtUtc,
          time,
          timezone: rule.timezone,
        });
      }
    }
  }

  return dedupeSlots(slots);
}

function dedupeSlots(slots: SourceAvailabilitySlot[]) {
  const seen = new Set<number>();

  return slots.filter((slot) => {
    if (seen.has(slot.startsAtUtc)) {
      return false;
    }

    seen.add(slot.startsAtUtc);
    return true;
  });
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

function getSeatDurationMinutes(seat: Seat | undefined) { return seatDuration(seat); }

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

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setUTCMinutes(next.getUTCMinutes() + minutes);
  return next;
}

function formatLocalDateValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatUtcDateValue(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function zonedTimeToUtc(dateValue: string, timeValue: string, timezone: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  let instant = utcGuess;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = new Date(utcGuess.getTime() - getTimezoneOffset(instant, timezone));
    if (next.getTime() === instant.getTime()) break;
    instant = next;
  }
  // Spring-forward gaps and impossible dates must never shift into another slot.
  return formatLocalDateTimeInTimezone(instant, timezone) === `${dateValue}T${timeValue}:00`
    ? instant : new Date(Number.NaN);
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

// Immutable formatters are reusable; bound the cache for arbitrary viewer timezones.
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeParts(date: Date, timezone: string) {
  let formatter = dateTimeFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
    });
    if (dateTimeFormatters.size >= 64) dateTimeFormatters.clear();
    dateTimeFormatters.set(timezone, formatter);
  }
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
