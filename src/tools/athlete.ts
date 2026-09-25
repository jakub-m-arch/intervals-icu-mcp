import { z } from 'zod';
import { unwrap } from '../api/client.js';
import { compact } from '../format/compact.js';
import { addDays, isIsoDate, resolveRange, todayIn } from '../format/dates.js';
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatPaceValue,
  type PaceUnits,
  paceUnitLabel,
  round,
} from '../format/units.js';
import type { SportSettings } from './athlete-context.js';
import { defineTool } from './define-tool.js';
import { isoDate } from './schemas.js';

const optStr = z.string().optional();
const optNum = z.number().optional();

const ZoneSchema = z.object({ zone: z.string(), name: optStr, range: optStr });

const SportSchema = z.object({
  types: z.array(z.string()),
  lthr: optNum.describe('Lactate threshold heart rate (bpm)'),
  max_hr: optNum,
  threshold_pace: optStr,
  ftp_watts: optNum,
  pace_units: optStr,
  hr_zones: z.array(ZoneSchema).optional(),
  pace_zones: z.array(ZoneSchema).optional(),
  power_zones: z.array(ZoneSchema).optional(),
});

export const getAthleteProfile = defineTool({
  name: 'get_athlete_profile',
  title: 'Get athlete profile',
  description:
    'Get the athlete profile: time zone, units, weight, resting HR and per-sport settings ' +
    '(threshold HR/pace/power and training zones). Use it to interpret zones and paces or ' +
    'before planning workouts.',
  toolset: 'athlete',
  access: 'read',
  operations: ['getAthlete'],
  input: z.object({}),
  output: z.object({
    athlete: z.object({
      id: optStr,
      name: optStr,
      sex: optStr,
      age: optNum,
      timezone: optStr,
      units: z.enum(['metric', 'imperial']),
      weight_kg: optNum,
      resting_hr: optNum,
    }),
    sports: z.array(SportSchema),
  }),
  async handler(_args, ctx) {
    const athlete = await ctx.athlete();
    const a = athlete.raw;
    return {
      athlete: compact({
        id: a.id ?? undefined,
        name: a.name ?? undefined,
        sex: a.sex ?? undefined,
        age: ageFrom(a.icu_date_of_birth, todayIn(athlete.timezone)),
        timezone: athlete.timezone,
        units: athlete.unitSystem,
        weight_kg: round(a.icu_weight, 1),
        resting_hr: round(a.icu_resting_hr),
      }),
      sports: (a.sportSettings ?? []).map(describeSport),
    };
  },
});

function describeSport(s: SportSettings) {
  const paceUnits = (s.pace_units as PaceUnits | undefined) ?? 'NONE';
  const threshold = s.threshold_pace ?? undefined;
  const ftp = s.ftp ?? undefined;
  return compact({
    types: [...(s.types ?? [])],
    lthr: s.lthr ?? undefined,
    max_hr: s.max_hr ?? undefined,
    threshold_pace: formatPace(s.threshold_pace, paceUnits === 'NONE' ? 'MINS_KM' : paceUnits),
    ftp_watts: s.ftp ?? undefined,
    pace_units: s.pace_units ?? undefined,
    hr_zones: upperBoundZones(s.hr_zones, s.hr_zone_names, {
      value: String,
      unit: 'bpm',
      step: 1,
    }),
    pace_zones:
      threshold && paceUnits !== 'NONE'
        ? upperBoundZones(s.pace_zones, s.pace_zone_names, {
            // Pace zones are % of threshold speed: higher % = faster pace.
            value: (pct) => formatPaceValue((threshold * pct) / 100, paceUnits) ?? '?',
            unit: paceUnitLabel(paceUnits),
            below: 'slower than ',
            above: 'faster than ',
          })
        : undefined,
    power_zones: ftp
      ? upperBoundZones(s.power_zones, s.power_zone_names, {
          value: (pct) => String(Math.round((ftp * pct) / 100)),
          unit: 'W',
        })
      : undefined,
  });
}

/**
 * Intervals.icu stores zones as ascending upper bounds; the last one is often an open-ended
 * sentinel (e.g. 999). `step` is added to the previous bound to get the next lower bound.
 */
function upperBoundZones(
  bounds: readonly number[] | null | undefined,
  names: readonly string[] | null | undefined,
  {
    value,
    unit,
    step = 0,
    below = '≤',
    above = '≥',
  }: {
    value: (n: number) => string;
    unit: string;
    step?: number;
    /** Prefix for the open-ended first/last zone (pace zones read "slower/faster than"). */
    below?: string;
    above?: string;
  },
) {
  if (!bounds?.length) return undefined;
  return bounds.map((upper, i) => {
    const lower = i > 0 ? (bounds[i - 1] as number) + step : undefined;
    let range: string;
    if (lower === undefined) range = `${below}${value(upper)} ${unit}`;
    else if (i === bounds.length - 1 && upper >= 999) range = `${above}${value(lower)} ${unit}`;
    else range = `${value(lower)}–${value(upper)} ${unit}`;
    return compact({ zone: `Z${i + 1}`, name: names?.[i] ?? undefined, range });
  });
}

function ageFrom(dateOfBirth: string | null | undefined, today: string): number | undefined {
  if (!dateOfBirth || !isIsoDate(dateOfBirth.slice(0, 10))) return undefined;
  const [by, bm, bd] = dateOfBirth.slice(0, 10).split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Below this fitness (CTL) the form-% zones are not meaningful. */
const MIN_FITNESS_FOR_FORM_ZONES = 10;

/** Intervals.icu "form" zones, expressed as form (TSB) as a percentage of fitness (CTL). */
export function formZone(formPercent: number): string {
  if (formPercent > 20) return 'transition (losing fitness)';
  if (formPercent > 5) return 'fresh';
  if (formPercent > -10) return 'grey zone (maintaining)';
  if (formPercent > -30) return 'optimal (productive training)';
  return 'high risk (overreaching)';
}

const DailyFitnessSchema = z.object({
  date: z.string(),
  fitness: optNum,
  fatigue: optNum,
  form: optNum,
});

const WeeklySchema = z.object({
  week_start: z.string(),
  activities: z.number(),
  moving_time: optStr,
  distance: optStr,
  training_load: optNum,
  by_type: z.array(
    z.object({
      type: z.string(),
      activities: z.number(),
      moving_time: optStr,
      distance: optStr,
      training_load: optNum,
    }),
  ),
});

export const getFitnessSummary = defineTool({
  name: 'get_fitness_summary',
  title: 'Get fitness, fatigue and form',
  description:
    'Get training fitness (CTL, 42-day load), fatigue (ATL, 7-day load) and form (TSB = ' +
    'fitness − fatigue) with the Intervals.icu form zone, a daily series, and weekly totals by ' +
    'sport. Defaults to the last 6 weeks. Use it for questions about training load, freshness ' +
    'or trends.',
  toolset: 'athlete',
  access: 'read',
  operations: ['listWellnessRecords', 'getAthleteSummary'],
  input: z.object({
    oldest: isoDate.optional().describe('First day (YYYY-MM-DD). Default: 6 weeks ago.'),
    newest: isoDate.optional().describe('Last day (YYYY-MM-DD). Default: today.'),
  }),
  output: z.object({
    current: z
      .object({
        date: z.string(),
        fitness: optNum,
        fatigue: optNum,
        form: optNum,
        form_percent: optNum,
        form_zone: optStr,
        ramp_rate: optNum.describe('Weekly change in fitness'),
      })
      .optional(),
    daily: z.array(DailyFitnessSchema),
    weekly: z.array(WeeklySchema),
  }),
  async handler(args, ctx) {
    const athlete = await ctx.athlete();
    const { oldest, newest } = resolveRange(args, todayIn(athlete.timezone), 42);

    const [wellness, summary] = await Promise.all([
      ctx.api
        .GET('/api/v1/athlete/{id}/wellness{ext}', {
          params: {
            path: { id: ctx.athleteId, ext: '' },
            query: { oldest, newest, fields: ['id', 'ctl', 'atl', 'rampRate'] },
          },
        })
        .then(unwrap),
      ctx.api
        .GET('/api/v1/athlete/{id}/athlete-summary{ext}', {
          params: { path: { id: ctx.athleteId, ext: '' }, query: { start: oldest, end: newest } },
        })
        .then(unwrap),
    ]);

    const daily = (wellness ?? [])
      .filter((w) => w.id)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((w) =>
        compact({
          date: String(w.id),
          fitness: round(w.ctl, 1),
          fatigue: round(w.atl, 1),
          form: w.ctl != null && w.atl != null ? round(w.ctl - w.atl, 1) : undefined,
        }),
      );

    const last = [...(wellness ?? [])]
      .filter((w) => w.id && w.ctl != null)
      .sort((a, b) => String(b.id).localeCompare(String(a.id)))[0];
    const current = last
      ? (() => {
          const fitness = last.ctl ?? 0;
          const form = fitness - (last.atl ?? 0);
          // Form zones are % of fitness; with very low fitness they swing wildly and mislead.
          const meaningful = fitness >= MIN_FITNESS_FOR_FORM_ZONES;
          const formPercent = meaningful ? (100 * form) / fitness : undefined;
          return compact({
            date: String(last.id),
            fitness: round(fitness, 1),
            fatigue: round(last.atl, 1),
            form: round(form, 1),
            form_percent: round(formPercent),
            form_zone:
              formPercent === undefined
                ? `not meaningful yet (fitness below ${MIN_FITNESS_FOR_FORM_ZONES})`
                : formZone(formPercent),
            ramp_rate: round(last.rampRate, 1),
          });
        })()
      : undefined;

    // The summary endpoint also returns followed athletes; keep only this athlete.
    const ownId = athlete.raw.id;
    const weekly = (summary ?? [])
      .filter((w) => !ownId || w.athlete_id === ownId)
      .filter((w) => w.date && w.date >= addDays(oldest, -6))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((w) =>
        compact({
          week_start: String(w.date),
          activities: w.count ?? 0,
          moving_time: w.moving_time ? formatDuration(w.moving_time) : undefined,
          distance: w.distance ? formatDistance(w.distance, athlete.unitSystem) : undefined,
          training_load: round(w.training_load),
          by_type: (w.byCategory ?? [])
            .filter((c) => (c.count ?? 0) > 0)
            .map((c) =>
              compact({
                type: String(c.category),
                activities: c.count ?? 0,
                moving_time: formatDuration(c.moving_time),
                distance: c.distance ? formatDistance(c.distance, athlete.unitSystem) : undefined,
                training_load: round(c.training_load),
              }),
            ),
        }),
      );

    return compact({ current, daily, weekly });
  },
});
