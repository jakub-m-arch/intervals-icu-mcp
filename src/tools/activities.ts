import { z } from 'zod';
import { unwrap } from '../api/client.js';
import {
  type Activity,
  ActivityDetailSchema,
  ActivitySummarySchema,
  describeActivity,
  type Interval,
  IntervalSummarySchema,
  summarizeActivity,
  summarizeInterval,
} from '../format/activity.js';
import { compact } from '../format/compact.js';
import { isIsoDate, resolveRange, todayIn } from '../format/dates.js';
import { formatDistance, formatDuration, round } from '../format/units.js';
import { defineTool } from './define-tool.js';

const isoDate = z.string().refine(isIsoDate, 'Expected a date in YYYY-MM-DD format');

const DEFAULT_LIST_DAYS = 30;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Heavy or internal fields dropped from `include_raw` output. */
const RAW_EXCLUDED_FIELDS = new Set([
  'skyline_chart_bytes',
  'icu_training_load_data',
  'icu_intervals',
  'icu_groups',
  'stream_types',
  'icu_sync_date',
  'created',
  'analyzed',
  'external_id',
  'file_sport_index',
]);

export const listActivities = defineTool({
  name: 'list_activities',
  title: 'List activities',
  description:
    'List completed activities (runs, rides, etc.) in a date range, newest first, with ' +
    'distance, time, pace/GAP, heart rate and training load, plus totals per activity type. ' +
    `Defaults to the last ${DEFAULT_LIST_DAYS} days. Use get_activity for details of one activity.`,
  toolset: 'activities',
  access: 'read',
  operations: ['listActivities'],
  input: z.object({
    oldest: isoDate
      .optional()
      .describe(`First day (YYYY-MM-DD). Default: ${DEFAULT_LIST_DAYS} days ago.`),
    newest: isoDate.optional().describe('Last day (YYYY-MM-DD), inclusive. Default: today.'),
    type: z
      .string()
      .optional()
      .describe('Only this activity type, e.g. "Run", "Ride", "Walk" (case-insensitive).'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .optional()
      .describe(`Maximum activities to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).`),
  }),
  output: z.object({
    range: z.object({ oldest: z.string(), newest: z.string() }),
    count: z.number(),
    truncated: z.boolean().describe('True if more activities exist than were returned'),
    totals_by_type: z.array(
      z.object({
        type: z.string(),
        activities: z.number(),
        distance: z.string().optional(),
        moving_time: z.string().optional(),
        training_load: z.number().optional(),
      }),
    ),
    activities: z.array(ActivitySummarySchema),
  }),
  async handler(args, ctx) {
    const athlete = await ctx.athlete();
    const range = resolveRange(args, todayIn(athlete.timezone), DEFAULT_LIST_DAYS);
    const limit = args.limit ?? DEFAULT_LIMIT;

    // A type filter is applied locally, so fetch the whole range in that case.
    const data = unwrap(
      await ctx.api.GET('/api/v1/athlete/{id}/activities', {
        params: {
          path: { id: ctx.athleteId },
          query: {
            oldest: range.oldest,
            // `newest` accepts date-time; include the whole last day.
            newest: `${range.newest}T23:59:59`,
            ...(args.type ? {} : { limit: limit + 1 }),
          },
        },
      }),
    );

    const typeFilter = args.type?.toLowerCase();
    const matching = (data ?? []).filter(
      (a) => !typeFilter || a.type?.toLowerCase() === typeFilter,
    );
    const returned = matching.slice(0, limit);

    return {
      range,
      count: returned.length,
      truncated: matching.length > limit,
      totals_by_type: totalsByType(args.type ? matching : returned, athlete.unitSystem),
      activities: returned.map((a) => summarizeActivity(a, athlete)),
    };
  },
});

function totalsByType(activities: Activity[], system: 'metric' | 'imperial') {
  const groups = new Map<string, { count: number; distance: number; time: number; load: number }>();
  for (const a of activities) {
    const key = a.type ?? 'Unknown';
    const g = groups.get(key) ?? { count: 0, distance: 0, time: 0, load: 0 };
    g.count += 1;
    g.distance += a.distance ?? a.icu_distance ?? 0;
    g.time += a.moving_time ?? 0;
    g.load += a.icu_training_load ?? 0;
    groups.set(key, g);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([type, g]) =>
      compact({
        type,
        activities: g.count,
        distance: g.distance > 0 ? formatDistance(g.distance, system) : undefined,
        moving_time: formatDuration(g.time),
        training_load: round(g.load),
      }),
    );
}

export const getActivity = defineTool({
  name: 'get_activity',
  title: 'Get activity details',
  description:
    'Get details of one activity: summary metrics, description, time in heart-rate and pace ' +
    'zones, aerobic decoupling, HR recovery, fitness/fatigue after the session and, ' +
    'optionally, the list of intervals/laps with pace and HR. Activity ids look like ' +
    '"i123456789" (see list_activities).',
  toolset: 'activities',
  access: 'read',
  operations: ['getActivity'],
  input: z.object({
    id: z.string().min(1).describe('Activity id, e.g. "i123456789".'),
    include_intervals: z
      .boolean()
      .optional()
      .describe('Include intervals/laps (work and recovery segments). Default: false.'),
    include_raw: z
      .boolean()
      .optional()
      .describe('Also include all raw non-empty API fields (large). Default: false.'),
  }),
  output: z.object({
    activity: ActivityDetailSchema,
    intervals: z.array(IntervalSummarySchema).optional(),
    raw: z.record(z.string(), z.unknown()).optional(),
  }),
  async handler(args, ctx) {
    const [athlete, activity] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .GET('/api/v1/activity/{id}', {
          params: {
            path: { id: args.id },
            query: { intervals: args.include_intervals ?? false },
          },
        })
        .then(unwrap),
    ]);
    const a = activity as Activity & { icu_intervals?: Interval[] };
    return compact({
      activity: describeActivity(a, athlete),
      intervals: args.include_intervals
        ? (a.icu_intervals ?? []).map((i) => summarizeInterval(i, a.type ?? '', athlete))
        : undefined,
      raw: args.include_raw ? rawFields(a) : undefined,
    });
  },
});

function rawFields(activity: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(activity).filter(
      ([key, value]) =>
        value !== null &&
        value !== undefined &&
        !(Array.isArray(value) && value.length === 0) &&
        !RAW_EXCLUDED_FIELDS.has(key),
    ),
  );
}
