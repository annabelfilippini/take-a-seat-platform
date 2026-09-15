// Calendar dates stay independent of the browser/server timezone.
export function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isCalendarDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function availabilityWeekStart(value: string) {
  return addCalendarDays(value, -new Date(`${value}T00:00:00Z`).getUTCDay());
}

export function availabilityDateBounds(timezone: string, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const monthIndex = Number(parts.month) - 1;
  const target = new Date(Date.UTC(Number(parts.year), monthIndex + 12, 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1;
  // Clamp month-end starts, such as August 31, to the last day one year later.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(Math.min(Number(parts.day), lastDay)).padStart(2, "0")}`;
  return { today, end };
}

export function rulesForAvailabilityWeek<T extends { weekStart?: string | null }>(rules: T[], weekStart: string): T[] {
  const dated = rules.filter((rule) => rule.weekStart === weekStart);
  // A disabled dated row records an explicitly empty week, overriding defaults.
  return dated.length ? dated : rules.filter((rule) => !rule.weekStart);
}
