import { PeriodType, PeriodRange } from "../types/period";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns the start (00:00:00.000) of the local day containing `d`.
 */
export function getStartOfDay(d: Date): number {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/**
 * Returns the end (23:59:59.999) of the local day containing `d`.
 */
export function getEndOfDay(d: Date): number {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy.getTime();
}

/**
 * Returns the Mon–Sun range that contains `d`.
 */
export function getWeekRangeForDate(d: Date): PeriodRange {
  const date = new Date(d);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: getStartOfDay(monday), end: getEndOfDay(sunday) };
}

/**
 * Computes the range of a named preset period for the current moment.
 */
export function getDefaultRangeForPeriod(period: PeriodType): PeriodRange {
  const now = new Date();
  switch (period) {
    case PeriodType.Today:
      return { start: getStartOfDay(now), end: getEndOfDay(now) };
    case PeriodType.Yesterday: {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return { start: getStartOfDay(yesterday), end: getEndOfDay(yesterday) };
    }
    case PeriodType.Week:
      return getWeekRangeForDate(now);
    case PeriodType.Month:
      return rangeForMonth(now.getFullYear(), now.getMonth());
    case PeriodType.Year:
      return rangeForYear(now.getFullYear());
    case PeriodType.Custom:
    default:
      return { start: getStartOfDay(now), end: getEndOfDay(now) };
  }
}

/**
 * Local `YYYY-MM-DD` key used for daily aggregation and rollups.
 */
export function dateKey(ts: number): string {
  return toISODateLocal(ts);
}

/**
 * Formats a timestamp as local `YYYY-MM-DD` (never UTC).
 *
 * `Date#toISOString()` would shift the date around midnight in non-UTC zones.
 */
export function toISODateLocal(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parses a local `YYYY-MM-DD` value into a timestamp.
 *
 * `which === "start"` resolves to local midnight of that day,
 * `which === "end"` resolves to the last millisecond of that day
 * (so picking an end date never silently drops that whole day).
 */
export function fromISODateLocal(value: string, which: "start" | "end"): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(year, month, day, 0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return which === "start" ? getStartOfDay(date) : getEndOfDay(date);
}

/**
 * Range for a whole calendar year.
 */
export function rangeForYear(year: number): PeriodRange {
  return {
    start: new Date(year, 0, 1, 0, 0, 0, 0).getTime(),
    end: new Date(year, 11, 31, 23, 59, 59, 999).getTime(),
  };
}

/**
 * Range for a whole calendar month (`monthIndex` is 0-based).
 */
export function rangeForMonth(year: number, monthIndex: number): PeriodRange {
  return {
    start: new Date(year, monthIndex, 1, 0, 0, 0, 0).getTime(),
    end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999).getTime(),
  };
}

/**
 * Returns the previous period that is comparable to the current one.
 *
 * Today → yesterday, Week → previous calendar week (Mon–Sun), Month → previous
 * month, Year → previous year, Custom → the same number of days shifted back.
 */
export function getPreviousRange(range: PeriodRange, period: PeriodType): PeriodRange {
  switch (period) {
    case PeriodType.Today: {
      const yesterday = new Date(range.start - DAY_MS);
      return { start: getStartOfDay(yesterday), end: getEndOfDay(yesterday) };
    }
    case PeriodType.Yesterday: {
      const dayBefore = new Date(range.start - DAY_MS);
      return { start: getStartOfDay(dayBefore), end: getEndOfDay(dayBefore) };
    }
    case PeriodType.Week: {
      const previousMonday = new Date(range.start - 7 * DAY_MS);
      return getWeekRangeForDate(new Date(getStartOfDay(previousMonday) + 12 * 60 * 60 * 1000));
    }
    case PeriodType.Month: {
      const start = new Date(range.start);
      return rangeForMonth(start.getFullYear(), start.getMonth() - 1);
    }
    case PeriodType.Year: {
      const startYear = new Date(range.start).getFullYear();
      return rangeForYear(startYear - 1);
    }
    case PeriodType.Custom:
    default: {
      const length = Math.max(DAY_MS, range.end - range.start + 1);
      const end = range.start - 1;
      return { start: Math.max(0, end - length + 1), end };
    }
  }
}

/**
 * Splits a range into fixed hourly buckets of `bucketMs`.
 *
 * Used for the Today/Yesterday chart. If the range crosses more than one local
 * day, the buckets still run continuously from `range.start`.
 */
export function getHourlyBuckets(range: PeriodRange, bucketMs = 60 * 60 * 1000): PeriodRange[] {
  const buckets: PeriodRange[] = [];
  if (range.end <= range.start) return buckets;
  let cursor = range.start;
  while (cursor <= range.end) {
    const bucketEnd = Math.min(range.end, cursor + bucketMs - 1);
    buckets.push({ start: cursor, end: bucketEnd });
    cursor = bucketEnd + 1;
  }
  return buckets;
}

/**
 * Localized short month labels (Jan..Dec) for the active locale.
 */
export function getMonthLabels(lang: string): string[] {
  return Array.from({ length: 12 }, (_, index) =>
    new Date(2021, index, 1).toLocaleString(lang, { month: "short" })
  );
}
