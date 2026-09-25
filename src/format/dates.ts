/** ISO local date (YYYY-MM-DD). */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Today's date in the given IANA time zone (falls back to UTC for unknown zones). */
export function todayIn(timeZone: string | undefined, now: Date = new Date()): IsoDate {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface DateRange {
  oldest: IsoDate;
  newest: IsoDate;
}

/**
 * Resolves an optional oldest/newest pair, defaulting to the last `defaultDays` days
 * (inclusive) ending today in the athlete's time zone.
 */
export function resolveRange(
  input: { oldest?: string | undefined; newest?: string | undefined },
  today: IsoDate,
  defaultDays: number,
): DateRange {
  const newest = input.newest ?? today;
  const oldest = input.oldest ?? addDays(newest, -(defaultDays - 1));
  if (oldest > newest) {
    throw new RangeError(`"oldest" (${oldest}) must not be after "newest" (${newest}).`);
  }
  return { oldest, newest };
}
