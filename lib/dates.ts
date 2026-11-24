export type DateRange = { start: string; end: string };

export const RANGE_PHRASES = [
  "today",
  "yesterday",
  "this week",
  "last week",
  "last 7 days",
  "last 30 days",
  "this month",
  "last month",
] as const;

export type RangePhrase = (typeof RANGE_PHRASES)[number];

/** Used when a merchant gives no dates or only vague ones ("lately", "this season"). */
export const DEFAULT_RANGE_PHRASE: RangePhrase = "last 30 days";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO.test(value)) return false;
  return toIso(fromIso(value)) === value;
}

function fromIso(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const d = fromIso(value);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

function mondayOf(value: string): string {
  const dow = fromIso(value).getUTCDay();
  return addDays(value, -((dow + 6) % 7));
}

function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

/**
 * Turns a phrase like "last week" into exact inclusive dates.
 * Weeks run Monday to Sunday. "last week" is the last full week before the
 * reference date. "this week" and "this month" stop at the reference date.
 * "last 7 days" and "last 30 days" are full days ending yesterday.
 */
export function resolveDateRange(
  phrase: string,
  referenceDate: string,
): DateRange {
  if (!isIsoDate(referenceDate)) {
    throw new Error(`referenceDate must be YYYY-MM-DD, got "${referenceDate}"`);
  }
  const ref = referenceDate;
  switch (phrase.trim().toLowerCase()) {
    case "today":
      return { start: ref, end: ref };
    case "yesterday": {
      const y = addDays(ref, -1);
      return { start: y, end: y };
    }
    case "this week":
      return { start: mondayOf(ref), end: ref };
    case "last week": {
      const thisMonday = mondayOf(ref);
      return { start: addDays(thisMonday, -7), end: addDays(thisMonday, -1) };
    }
    case "last 7 days":
      return { start: addDays(ref, -7), end: addDays(ref, -1) };
    case "last 30 days":
      return { start: addDays(ref, -30), end: addDays(ref, -1) };
    case "this month":
      return { start: monthStart(ref), end: ref };
    case "last month": {
      const first = monthStart(ref);
      return { start: monthStart(addDays(first, -1)), end: addDays(first, -1) };
    }
    default:
      throw new Error(
        `Unknown date phrase "${phrase}". Use one of: ${RANGE_PHRASES.join(", ")}`,
      );
  }
}
