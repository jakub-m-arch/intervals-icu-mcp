import { z } from 'zod';
import { unwrap } from '../api/client.js';
import {
  type Activity,
  ActivitySummarySchema,
  IntervalSummarySchema,
  summarizeActivity,
  summarizeInterval,
} from '../format/activity.js';
import { compact } from '../format/compact.js';
import { bucketRanges, fetchStreams, indexAtTime, mean, type Stream } from '../format/streams.js';
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatPaceValue,
  formatSpeed,
  type PaceUnits,
  paceUnitLabel,
  paceUnitMeters,
  round,
} from '../format/units.js';
import type { AthleteContext } from './athlete-context.js';
import { defineTool, type ToolContext } from './define-tool.js';
import { activityId, elapsedTime } from './schemas.js';

const DEFAULT_STREAMS = [
  'distance',
  'heartrate',
  'velocity_smooth',
  'cadence',
  'altitude',
  'watts',
] as const;
const DEFAULT_MAX_POINTS = 120;
const MAX_POINTS = 1000;
const isStepSport = (type: string) => /Run|Walk|Hike/i.test(type);
/** Below this speed (m/s) the athlete is effectively stopped; pace would be meaningless. */
const MIN_MOVING_SPEED = 0.5;
/** Preferred column order; unknown streams go last. */
const COLUMN_ORDER = [
  'distance',
  'velocity_smooth',
  'heartrate',
  'cadence',
  'fixed_altitude',
  'altitude',
  'watts',
];

/** Time at an exclusive end index (the first sample after the range). */
const timeAtEnd = (time: readonly (number | null)[], endIndex: number) =>
  time[Math.min(endIndex, time.length - 1)];

async function loadActivity(ctx: ToolContext, id: string): Promise<Activity> {
  return unwrap(await ctx.api.GET('/api/v1/activity/{id}', { params: { path: { id } } }));
}

// ---------------------------------------------------------------------------------------
// get_activity_streams
// ---------------------------------------------------------------------------------------

interface Column {
  name: string;
  /** Value for samples [start, end). */
  value(start: number, end: number): number | string | null;
}

function columnsFor(
  streams: Map<string, Stream>,
  activityType: string,
  athlete: AthleteContext,
): Column[] {
  const paceUnits = athlete.paceUnitsFor(activityType);
  const imperial = athlete.unitSystem === 'imperial';
  const avg = (s: Stream, start: number, end: number) => mean(s.data.slice(start, end));
  const columns: Column[] = [];
  const rank = (type: string) => {
    const i = COLUMN_ORDER.indexOf(type);
    return i < 0 ? COLUMN_ORDER.length : i;
  };
  const ordered = [...streams.entries()].sort(([a], [b]) => rank(a) - rank(b));

  for (const [type, s] of ordered) {
    switch (type) {
      case 'time':
        break; // always the first column, added below
      case 'distance':
        columns.push({
          name: imperial ? 'distance_mi' : 'distance_km',
          value: (_start, end) => {
            const v = s.data[end - 1];
            return typeof v === 'number'
              ? (round(v / (imperial ? 1609.344 : 1000), 2) ?? null)
              : null;
          },
        });
        break;
      case 'heartrate':
        columns.push({ name: 'heartrate_bpm', value: (a, b) => round(avg(s, a, b)) ?? null });
        break;
      case 'velocity_smooth':
        if (paceUnits === 'NONE') {
          columns.push({
            name: imperial ? 'speed_mph' : 'speed_kmh',
            value: (a, b) => {
              const v = avg(s, a, b);
              return v === undefined ? null : (round(v * (imperial ? 2.236936 : 3.6), 1) ?? null);
            },
          });
        } else {
          columns.push({
            name: `pace${paceUnitLabel(paceUnits).replace('/', '_per_')}`,
            value: (a, b) => {
              const v = avg(s, a, b);
              return v === undefined || v < MIN_MOVING_SPEED
                ? null
                : (formatPaceValue(v, paceUnits) ?? null);
            },
          });
        }
        break;
      case 'cadence':
        columns.push({
          name: isStepSport(activityType) ? 'cadence_spm' : 'cadence_rpm',
          value: (a, b) => {
            const v = avg(s, a, b);
            return v === undefined ? null : (round(isStepSport(activityType) ? v * 2 : v) ?? null);
          },
        });
        break;
      case 'altitude':
      case 'fixed_altitude':
        if (type === 'altitude' && streams.has('fixed_altitude')) break;
        columns.push({
          name: imperial ? 'altitude_ft' : 'altitude_m',
          value: (a, b) => {
            const v = avg(s, a, b);
            return v === undefined ? null : (round(imperial ? v * 3.28084 : v) ?? null);
          },
        });
        break;
      case 'watts':
        columns.push({ name: 'power_w', value: (a, b) => round(avg(s, a, b)) ?? null });
        break;
      case 'latlng':
        columns.push({ name: 'lat', value: (a) => round(s.data[a], 5) ?? null });
        columns.push({ name: 'lng', value: (a) => round(s.data2?.[a], 5) ?? null });
        break;
      default:
        columns.push({ name: type, value: (a, b) => round(avg(s, a, b), 2) ?? null });
    }
  }
  return columns;
}

export const getActivityStreams = defineTool({
  name: 'get_activity_streams',
  title: 'Get activity time series',
  description:
    'Get second-by-second data of one activity (heart rate, pace/speed, cadence, altitude, ' +
    'distance, power), downsampled to a compact table: each row averages a time window. ' +
    'Use it to analyse pacing, HR drift or how effort changed during the session. GPS ' +
    'coordinates are only included when "latlng" is requested explicitly.',
  toolset: 'analysis',
  access: 'read',
  operations: ['getActivityStreams'],
  input: z.object({
    id: activityId,
    types: z
      .array(z.string())
      .optional()
      .describe(
        `Stream types. Default: ${DEFAULT_STREAMS.join(', ')}. Others include temp, ` +
          'respiration, grade_smooth, latlng (GPS).',
      ),
    max_points: z
      .number()
      .int()
      .min(10)
      .max(MAX_POINTS)
      .optional()
      .describe(`Maximum rows (default ${DEFAULT_MAX_POINTS}).`),
    start: elapsedTime.optional().describe('Only from this elapsed time (seconds or "m:ss").'),
    end: elapsedTime.optional().describe('Only up to this elapsed time (seconds or "m:ss").'),
  }),
  output: z.object({
    activity_id: z.string(),
    source_points: z.number(),
    rows_count: z.number(),
    seconds_per_row: z.number().optional(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.union([z.number(), z.string(), z.null()]))),
  }),
  async handler(args, ctx) {
    const requested = args.types?.length ? args.types : [...DEFAULT_STREAMS];
    const [athlete, activity, streams] = await Promise.all([
      ctx.athlete(),
      loadActivity(ctx, args.id),
      fetchStreams(ctx, args.id, ['time', ...requested]),
    ]);
    const time = streams.get('time')?.data ?? [];
    if (time.length === 0) throw new RangeError('This activity has no time-series data.');

    const from = args.start === undefined ? 0 : indexAtTime(time, args.start);
    const to = args.end === undefined ? time.length : indexAtTime(time, args.end + 0.001);
    if (to <= from) throw new RangeError('"start" must be before "end" and within the activity.');

    const columns = columnsFor(streams, activity.type ?? '', athlete);
    const ranges = bucketRanges(to - from, args.max_points ?? DEFAULT_MAX_POINTS).map(
      ([a, b]) => [a + from, b + from] as const,
    );
    const rows = ranges.map(([a, b]) => [
      formatDuration(time[a]) ?? null,
      ...columns.map((c) => c.value(a, b)),
    ]);
    const span = (time[to - 1] ?? 0) - (time[from] ?? 0);

    return compact({
      activity_id: args.id,
      source_points: to - from,
      rows_count: rows.length,
      seconds_per_row: rows.length > 0 ? round(span / rows.length, 1) : undefined,
      columns: ['elapsed', ...columns.map((c) => c.name)],
      rows,
    });
  },
});

// ---------------------------------------------------------------------------------------
// get_activity_histogram
// ---------------------------------------------------------------------------------------

type HistogramBucket = { min?: number; max?: number; secs?: number };

const BucketSchema = z.object({ range: z.string(), time: z.string(), percent: z.number() });

export const getActivityHistogram = defineTool({
  name: 'get_activity_histogram',
  title: 'Get activity time distribution',
  description:
    'Get how much time was spent at each heart rate, pace or power level in one activity ' +
    '(a histogram with ranges, time and % of total). Finer-grained than time in zones.',
  toolset: 'analysis',
  access: 'read',
  operations: ['getHRHistogram', 'getPowerHistogram', 'getActivityStreams'],
  input: z.object({
    id: activityId,
    metric: z.enum(['hr', 'pace', 'power']).describe('What to bucket by.'),
    bucket_size: z
      .number()
      .positive()
      .optional()
      .describe(
        'Bucket width: bpm (default 5), seconds of pace (default 15) or watts (default 25).',
      ),
  }),
  output: z.object({ metric: z.string(), buckets: z.array(BucketSchema) }),
  async handler(args, ctx) {
    if (args.metric === 'pace') return paceHistogram(args.id, args.bucket_size ?? 15, ctx);

    const size = Math.round(args.bucket_size ?? (args.metric === 'hr' ? 5 : 25));
    // The spec's Bucket schema does not match reality: the API returns {min, max, secs}
    // (verified against live responses), so we describe the real shape here.
    const buckets = unwrap(
      args.metric === 'hr'
        ? await ctx.api.GET('/api/v1/activity/{id}/hr-histogram', {
            params: { path: { id: args.id }, query: { bucketSize: size } },
          })
        : await ctx.api.GET('/api/v1/activity/{id}/power-histogram', {
            params: { path: { id: args.id }, query: { bucketSize: size } },
          }),
    ) as HistogramBucket[] | undefined;
    const unit = args.metric === 'hr' ? 'bpm' : 'W';
    const total = (buckets ?? []).reduce((sum, b) => sum + (b.secs ?? 0), 0);
    return {
      metric: args.metric,
      buckets: (buckets ?? [])
        .filter((b) => (b.secs ?? 0) > 0)
        .map((b) => ({
          range: `${b.min}–${b.max} ${unit}`,
          time: formatDuration(b.secs) ?? '0:00',
          percent: total > 0 ? (round((100 * (b.secs ?? 0)) / total, 1) ?? 0) : 0,
        })),
    };
  },
});

/** Pace histogram computed from the velocity stream (the API endpoint is often empty). */
async function paceHistogram(id: string, bucketSeconds: number, ctx: ToolContext) {
  const [athlete, activity, streams] = await Promise.all([
    ctx.athlete(),
    loadActivity(ctx, id),
    fetchStreams(ctx, id, ['time', 'velocity_smooth']),
  ]);
  const units: PaceUnits = athlete.paceUnitsFor(activity.type ?? '');
  const time = streams.get('time')?.data ?? [];
  const velocity = streams.get('velocity_smooth')?.data ?? [];
  const unitMeters = paceUnitMeters(units);
  if (unitMeters === undefined || velocity.length === 0) {
    throw new RangeError(
      'Pace is not available for this activity (no speed data or not a pace-based sport).',
    );
  }
  const seconds = new Map<number, number>();
  let total = 0;
  for (let i = 0; i < velocity.length - 1; i++) {
    const v = velocity[i];
    const dt = (time[i + 1] ?? 0) - (time[i] ?? 0);
    if (typeof v !== 'number' || v < 0.5 || dt <= 0 || dt > 30) continue; // skip stops/gaps
    const pace = unitMeters / v; // seconds per pace unit
    const bucket = Math.floor(pace / bucketSeconds) * bucketSeconds;
    seconds.set(bucket, (seconds.get(bucket) ?? 0) + dt);
    total += dt;
  }
  const label = paceUnitLabel(units);
  return {
    metric: 'pace',
    buckets: [...seconds.entries()]
      .sort(([a], [b]) => a - b)
      .filter(([, secs]) => secs >= 1)
      .map(([start, secs]) => ({
        range: `${formatDuration(start)}–${formatDuration(start + bucketSeconds)} ${label}`,
        time: formatDuration(secs) ?? '0:00',
        percent: round((100 * secs) / total, 1) ?? 0,
      })),
  };
}

// ---------------------------------------------------------------------------------------
// get_activity_best_efforts
// ---------------------------------------------------------------------------------------

const EFFORT_STREAM = { pace: 'velocity_smooth', hr: 'heartrate', power: 'watts' } as const;

export const getActivityBestEfforts = defineTool({
  name: 'get_activity_best_efforts',
  title: 'Find best efforts in an activity',
  description:
    'Find the best efforts inside one activity: fastest pace over a distance (e.g. best 1 km), ' +
    'highest average heart rate or power over a duration (e.g. best 5 min). Returns when each ' +
    'effort happened. For all-time or period bests across activities use get_athlete_curves.',
  toolset: 'analysis',
  access: 'read',
  operations: ['findBestEfforts', 'getActivityStreams'],
  input: z.object({
    id: activityId,
    metric: z
      .enum(['pace', 'hr', 'power'])
      .describe('pace = fastest over a distance; hr/power = highest average over a duration.'),
    distance_m: z
      .number()
      .positive()
      .optional()
      .describe('Effort distance in meters (pace efforts), e.g. 1000.'),
    duration_s: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Effort duration in seconds (hr/power, or pace), e.g. 300.'),
    count: z.number().int().min(1).max(20).optional().describe('How many efforts (default 3).'),
  }),
  output: z.object({
    metric: z.string(),
    target: z.string(),
    efforts: z.array(
      z.object({
        rank: z.number(),
        start: z.string().optional(),
        end: z.string().optional(),
        duration: z.string().optional(),
        distance: z.string().optional(),
        average: z.string(),
      }),
    ),
  }),
  async handler(args, ctx) {
    if (args.distance_m === undefined && args.duration_s === undefined) {
      throw new RangeError('Provide either distance_m or duration_s.');
    }
    const [athlete, activity, result, streams] = await Promise.all([
      ctx.athlete(),
      loadActivity(ctx, args.id),
      ctx.api
        .GET('/api/v1/activity/{id}/best-efforts', {
          params: {
            path: { id: args.id },
            query: {
              stream: EFFORT_STREAM[args.metric],
              count: args.count ?? 3,
              ...(args.distance_m !== undefined
                ? { distance: args.distance_m }
                : { duration: args.duration_s as number }),
            },
          },
        })
        .then(unwrap),
      fetchStreams(ctx, args.id, ['time']),
    ]);
    const time = streams.get('time')?.data ?? [];
    const paceUnits = athlete.paceUnitsFor(activity.type ?? '');
    const format = (value: number | undefined) => {
      if (args.metric === 'hr') return `${round(value)} bpm`;
      if (args.metric === 'power') return `${round(value)} W`;
      return (
        (paceUnits === 'NONE'
          ? formatSpeed(value, athlete.unitSystem)
          : formatPace(value, paceUnits)) ?? '?'
      );
    };

    return {
      metric: args.metric,
      target:
        args.distance_m !== undefined
          ? (formatDistance(args.distance_m, athlete.unitSystem) ?? `${args.distance_m} m`)
          : (formatDuration(args.duration_s) ?? `${args.duration_s} s`),
      efforts: (result?.efforts ?? []).map((e, i) => {
        const start = time[e.start_index ?? 0];
        const end = timeAtEnd(time, e.end_index ?? 0);
        return compact({
          rank: i + 1,
          start: formatDuration(start),
          end: formatDuration(end),
          duration:
            typeof start === 'number' && typeof end === 'number'
              ? formatDuration(end - start)
              : formatDuration(e.duration),
          distance: formatDistance(e.distance, athlete.unitSystem),
          average: format(e.average),
        });
      }),
    };
  },
});

// ---------------------------------------------------------------------------------------
// get_activity_segment_stats
// ---------------------------------------------------------------------------------------

export const getActivitySegmentStats = defineTool({
  name: 'get_activity_segment_stats',
  title: 'Get stats for part of an activity',
  description:
    'Get pace, heart rate, cadence and intensity for a chosen part of an activity, e.g. ' +
    '"from 10:00 to 20:00". Use it to compare the first and second half or a climb.',
  toolset: 'analysis',
  access: 'read',
  operations: ['getIntervalStats', 'getActivityStreams'],
  input: z.object({
    id: activityId,
    start: elapsedTime.describe('Start (elapsed seconds or "m:ss").'),
    end: elapsedTime.describe('End (elapsed seconds or "m:ss").'),
  }),
  output: z.object({ start: z.string(), end: z.string(), stats: IntervalSummarySchema }),
  async handler(args, ctx) {
    const [athlete, activity, streams] = await Promise.all([
      ctx.athlete(),
      loadActivity(ctx, args.id),
      fetchStreams(ctx, args.id, ['time']),
    ]);
    const time = streams.get('time')?.data ?? [];
    const startIndex = indexAtTime(time, args.start);
    const endIndex = indexAtTime(time, args.end);
    if (endIndex <= startIndex) {
      throw new RangeError('"start" must be before "end" and within the activity.');
    }
    const stats = unwrap(
      await ctx.api.GET('/api/v1/activity/{id}/interval-stats', {
        params: { path: { id: args.id }, query: { start_index: startIndex, end_index: endIndex } },
      }),
    );
    const { type: _type, ...rest } = summarizeInterval(stats, activity.type ?? '', athlete);
    return {
      start: formatDuration(time[startIndex]) ?? '0:00',
      end: formatDuration(timeAtEnd(time, endIndex)) ?? '0:00',
      stats: rest,
    };
  },
});

// ---------------------------------------------------------------------------------------
// search_intervals
// ---------------------------------------------------------------------------------------

export const searchIntervals = defineTool({
  name: 'search_intervals',
  title: 'Find workouts with matching intervals',
  description:
    'Find past activities containing intervals of a given duration and intensity, e.g. ' +
    '"4–6 minute reps at 95–105% of threshold". Intensity is % of threshold (FTP, threshold ' +
    'pace or LTHR depending on the metric).',
  toolset: 'analysis',
  access: 'read',
  operations: ['searchForIntervals'],
  input: z.object({
    min_duration_s: z.number().int().positive(),
    max_duration_s: z.number().int().positive(),
    min_intensity: z.number().int().min(0).describe('Minimum intensity, % of threshold.'),
    max_intensity: z.number().int().min(0).describe('Maximum intensity, % of threshold.'),
    metric: z
      .enum(['AUTO', 'POWER', 'HR', 'PACE'])
      .optional()
      .describe('Which intensity to use (default AUTO).'),
    min_reps: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Minimum matching intervals (default 1).'),
    limit: z.number().int().min(1).max(100).optional().describe('Max activities (default 20).'),
  }),
  output: z.object({ count: z.number(), activities: z.array(ActivitySummarySchema) }),
  async handler(args, ctx) {
    if (args.max_duration_s < args.min_duration_s || args.max_intensity < args.min_intensity) {
      throw new RangeError('Maximum values must not be smaller than minimum values.');
    }
    const [athlete, found] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .GET('/api/v1/athlete/{id}/activities/interval-search', {
          params: {
            path: { id: ctx.athleteId },
            query: {
              minSecs: args.min_duration_s,
              maxSecs: args.max_duration_s,
              minIntensity: args.min_intensity,
              maxIntensity: args.max_intensity,
              type: args.metric ?? 'AUTO',
              minReps: args.min_reps ?? 1,
              limit: args.limit ?? 20,
            },
          },
        })
        .then(unwrap),
    ]);
    const activities = (found ?? []).map((a) => summarizeActivity(a, athlete));
    return { count: activities.length, activities };
  },
});
