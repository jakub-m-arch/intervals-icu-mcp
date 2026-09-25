import { z } from 'zod';
import type { components } from '../api/schema.js';
import type { AthleteContext } from '../tools/athlete-context.js';
import { compact } from './compact.js';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  formatSpeed,
  round,
} from './units.js';

export type Activity = components['schemas']['Activity'];
export type Interval = components['schemas']['Interval'];

const optStr = z.string().optional();
const optNum = z.number().optional();

export const ActivitySummarySchema = z.object({
  id: z.string(),
  name: optStr,
  type: optStr,
  start_local: optStr.describe('Local start time (ISO-8601)'),
  distance: optStr,
  moving_time: optStr,
  elapsed_time: optStr,
  pace: optStr.describe('Average moving pace (pace-based sports)'),
  gap: optStr.describe('Grade-adjusted pace (running)'),
  speed: optStr.describe('Average speed (non pace-based sports)'),
  avg_hr: optNum,
  max_hr: optNum,
  elevation_gain: optStr,
  training_load: optNum,
  intensity_percent: optNum,
  rpe: optNum.describe('Perceived exertion 1-10'),
  feel: optNum.describe('How the athlete felt, 1 (strong) to 5 (weak)'),
  race: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  note: optStr.describe('Why data may be limited (e.g. Strava-only activities)'),
});
export type ActivitySummary = z.infer<typeof ActivitySummarySchema>;

const ZoneTimeSchema = z.object({
  zone: z.string(),
  name: optStr,
  range: optStr,
  time: z.string(),
  percent: z.number(),
});

export const ActivityDetailSchema = ActivitySummarySchema.extend({
  description: optStr,
  device: optStr,
  source: optStr,
  calories: optNum,
  avg_cadence: optNum.describe('Steps/min for running and walking, rpm for cycling'),
  trimp: optNum,
  hr_load: optNum,
  decoupling_percent: optNum.describe('Aerobic decoupling (pace/power vs HR drift)'),
  efficiency_factor: optNum,
  polarization_index: optNum,
  hr_recovery_bpm: optNum.describe('HR drop in the 60 s after the hardest effort'),
  fitness_after: optNum.describe('Fitness (CTL) after this activity'),
  fatigue_after: optNum.describe('Fatigue (ATL) after this activity'),
  avg_temp_c: optNum,
  lap_count: optNum,
  interval_summary: z.array(z.string()).optional(),
  time_in_hr_zones: z.array(ZoneTimeSchema).optional(),
  time_in_pace_zones: z.array(ZoneTimeSchema).optional(),
  paired_planned_workout_id: optNum,
  compliance_percent: optNum,
});
export type ActivityDetail = z.infer<typeof ActivityDetailSchema>;

export const IntervalSummarySchema = z.object({
  type: optStr.describe('WORK or RECOVERY'),
  label: optStr,
  distance: optStr,
  moving_time: optStr,
  pace: optStr,
  gap: optStr,
  speed: optStr,
  avg_hr: optNum,
  max_hr: optNum,
  avg_cadence: optNum.describe('Steps/min for running and walking, rpm for cycling'),
  intensity_percent: optNum,
  zone: optNum,
  elevation_gain: optStr,
});
export type IntervalSummary = z.infer<typeof IntervalSummarySchema>;

function speedFields(
  type: string,
  speed: number | undefined,
  gap: number | undefined,
  athlete: AthleteContext,
) {
  const paceUnits = athlete.paceUnitsFor(type);
  if (paceUnits === 'NONE') return { speed: formatSpeed(speed, athlete.unitSystem) };
  return {
    pace: formatPace(speed, paceUnits),
    gap: /Run/i.test(type) ? formatPace(gap, paceUnits) : undefined,
  };
}

export function summarizeActivity(a: Activity, athlete: AthleteContext): ActivitySummary {
  const type = a.type ?? '';
  const note = (a as Record<string, unknown>)._note;
  return compact({
    id: String(a.id),
    name: a.name ?? undefined,
    type: a.type ?? undefined,
    start_local: a.start_date_local ?? undefined,
    distance: formatDistance(a.distance ?? a.icu_distance, athlete.unitSystem),
    moving_time: formatDuration(a.moving_time),
    elapsed_time: formatDuration(a.elapsed_time),
    ...speedFields(type, a.average_speed ?? undefined, a.gap ?? undefined, athlete),
    avg_hr: round(a.average_heartrate),
    max_hr: round(a.max_heartrate),
    elevation_gain: formatElevation(a.total_elevation_gain, athlete.unitSystem),
    training_load: round(a.icu_training_load),
    intensity_percent: round(a.icu_intensity),
    rpe: round(a.icu_rpe ?? a.perceived_exertion),
    feel: round(a.feel),
    race: a.race || undefined,
    tags: a.tags?.length ? a.tags : undefined,
    note: typeof note === 'string' ? note : undefined,
  });
}

export function describeActivity(a: Activity, athlete: AthleteContext): ActivityDetail {
  const type = a.type ?? '';
  const sport = athlete.sportSettingsFor(type);
  return compact({
    ...summarizeActivity(a, athlete),
    description: a.description?.trim() || undefined,
    device: a.device_name ?? undefined,
    source: a.source ?? undefined,
    calories: round(a.calories),
    avg_cadence: cadence(a.average_cadence, type),
    trimp: round(a.trimp),
    hr_load: round(a.hr_load),
    decoupling_percent: round(a.decoupling, 1),
    efficiency_factor: round(a.icu_efficiency_factor, 3),
    polarization_index: round(a.polarization_index, 2),
    hr_recovery_bpm: round(a.icu_hrr?.hrr),
    fitness_after: round(a.icu_ctl, 1),
    fatigue_after: round(a.icu_atl, 1),
    avg_temp_c: round(a.average_weather_temp ?? a.average_temp, 1),
    lap_count: a.icu_lap_count ?? undefined,
    interval_summary: a.interval_summary?.length ? a.interval_summary : undefined,
    time_in_hr_zones: zoneTimes(a.icu_hr_zone_times, {
      names: sport?.hr_zone_names,
      bounds: a.icu_hr_zones ?? sport?.hr_zones,
      unit: 'bpm',
    }),
    time_in_pace_zones: zoneTimes(a.use_gap_zone_times ? a.gap_zone_times : a.pace_zone_times, {
      names: sport?.pace_zone_names,
    }),
    paired_planned_workout_id: a.paired_event_id ?? undefined,
    compliance_percent: round(a.compliance),
  });
}

export function summarizeInterval(
  i: Interval,
  activityType: string,
  athlete: AthleteContext,
): IntervalSummary {
  return compact({
    type: i.type ?? undefined,
    label: i.label ?? undefined,
    distance: formatDistance(i.distance, athlete.unitSystem),
    moving_time: formatDuration(i.moving_time),
    ...speedFields(activityType, i.average_speed ?? undefined, i.gap ?? undefined, athlete),
    avg_hr: round(i.average_heartrate),
    max_hr: round(i.max_heartrate),
    avg_cadence: cadence(i.average_cadence, activityType),
    intensity_percent: round(i.intensity),
    zone: i.zone ?? undefined,
    elevation_gain: formatElevation(i.total_elevation_gain, athlete.unitSystem),
  });
}

/**
 * Intervals.icu stores running/walking cadence per leg (strides per minute, as in FIT
 * files); runners think in steps per minute, which is twice that.
 */
function cadence(value: number | null | undefined, activityType: string): number | undefined {
  if (value == null) return undefined;
  return /Run|Walk|Hike/i.test(activityType) ? round(value * 2) : round(value);
}

/**
 * Converts per-zone seconds into labelled rows. `bounds` are zone upper limits as used by
 * Intervals.icu (e.g. HR zones `[145, 153, …]` → Z1 ≤145, Z2 146–153, …).
 */
function zoneTimes(
  seconds: readonly number[] | null | undefined,
  opts: {
    names?: readonly string[] | null | undefined;
    bounds?: readonly number[] | null | undefined;
    unit?: string;
  },
) {
  if (!seconds?.length) return undefined;
  const total = seconds.reduce((sum, s) => sum + (s ?? 0), 0);
  if (total <= 0) return undefined;
  return seconds.map((s, index) =>
    compact({
      zone: `Z${index + 1}`,
      name: opts.names?.[index] ?? undefined,
      range: zoneRange(opts.bounds, index, opts.unit),
      time: formatDuration(s) ?? '0:00',
      percent: round((100 * s) / total, 1) ?? 0,
    }),
  );
}

function zoneRange(bounds: readonly number[] | null | undefined, index: number, unit = '') {
  const upper = bounds?.[index];
  if (upper === undefined) return undefined;
  const suffix = unit ? ` ${unit}` : '';
  if (index === 0) return `≤${upper}${suffix}`;
  const lower = bounds?.[index - 1];
  return lower === undefined ? undefined : `${lower + 1}–${upper}${suffix}`;
}
