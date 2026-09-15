import type { Seat } from './creators';

export type Offering = {
  id: string;
  title: string;
  durationMinutes: number;
  unitAmount: number;
  description: string;
  active: boolean;
  archived?: boolean;
};
export const MAX_OFFERINGS = 12;

export function parseOfferings(value: string): Offering[] {
  const items: unknown = JSON.parse(value);
  if (!Array.isArray(items) || items.length > MAX_OFFERINGS) throw new Error('Add up to 12 offerings.');
  const ids = new Set<string>();
  return items.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid offering.');
    const row = item as Offering;
    if (typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(row.id) || ids.has(row.id)) throw new Error('Offering IDs must be unique.');
    ids.add(row.id);
    if (typeof row.title !== 'string' || row.title.length > 80 || typeof row.description !== 'string' || row.description.length > 300 ||
      !Number.isInteger(row.durationMinutes) || row.durationMinutes < 15 || row.durationMinutes > 180 || row.durationMinutes % 15 ||
      !Number.isSafeInteger(row.unitAmount) || row.unitAmount < 0 || row.unitAmount > 1000000 || typeof row.active !== 'boolean' ||
      (row.active && (!row.title.trim() || !row.unitAmount))) throw new Error('Each active offering needs a title, a 15–180 minute duration, and a positive price.');
    return { id: row.id, title: row.title.trim(), durationMinutes: row.durationMinutes, unitAmount: row.unitAmount,
      description: row.description.trim(), active: row.active && !row.archived, archived: Boolean(row.archived) };
  });
}

export function offeringSeats(offerings: Offering[], name: string, currency: string): Seat[] {
  return offerings.filter((item) => item.active && !item.archived).map((item) => ({
    id: item.id, name: item.title, durationMinutes: item.durationMinutes,
    price: new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(item.unitAmount / 100),
    unitAmount: item.unitAmount, currency: currency.toLowerCase(), description: item.description,
    host: name, format: 'Google Meet', stripePriceEnv: '',
  }));
}

export function seatDuration(seat?: Seat) {
  return seat?.durationMinutes ?? Number(seat?.name.match(/\d+/u)?.[0] ?? 30);
}
