import { z } from 'zod';
import { isIsoDate } from '../format/dates.js';

/** Shared input schemas so tools describe common parameters consistently. */
export const isoDate = z.string().refine(isIsoDate, 'Expected a date in YYYY-MM-DD format');

export const activityId = z
  .string()
  .min(1)
  .describe('Activity id, e.g. "i123456789" (from list_activities or search_activities).');

/** Accepts seconds (`600`) or a clock string (`"10:00"`, `"1:02:30"`). */
export const elapsedTime = z
  .union([z.number().nonnegative(), z.string().regex(/^\d+(:\d{1,2}){0,2}$/)])
  .transform((value) => {
    if (typeof value === 'number') return value;
    return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  });
