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
import { resolveRange, todayIn } from '../format/dates.js';
import { formatDistance, formatDuration, round } from '../format/units.js';
import { defineTool } from './define-tool.js';
import { activityId, elapsedTime, isoDate } from './schemas.js';

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
    id: activityId,
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

export const searchActivities = defineTool({
  name: 'search_activities',
  title: 'Search activities',
  description:
    'Search all activities by name (case-insensitive substring) or by tag (start the query ' +
    'with #, e.g. "#race"). Use it to find specific sessions regardless of date.',
  toolset: 'activities',
  access: 'read',
  operations: ['searchForActivities'],
  input: z.object({
    query: z.string().min(1).describe('Text in the activity name, or "#tag" for an exact tag.'),
    limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe('Default 20.'),
  }),
  output: z.object({ count: z.number(), activities: z.array(ActivitySummarySchema) }),
  async handler(args, ctx) {
    const [athlete, found] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .GET('/api/v1/athlete/{id}/activities/search', {
          params: {
            path: { id: ctx.athleteId },
            query: { q: args.query, limit: args.limit ?? 20 },
          },
        })
        .then(unwrap),
    ]);
    const activities = (found ?? []).map((a) => summarizeActivity(a as Activity, athlete));
    return { count: activities.length, activities };
  },
});

export const listActivityComments = defineTool({
  name: 'list_activity_comments',
  title: 'List activity comments',
  description: 'List comments and notes (e.g. from a coach or the athlete) on one activity.',
  toolset: 'activities',
  access: 'read',
  operations: ['listActivityMessages'],
  input: z.object({ id: activityId }),
  output: z.object({
    comments: z.array(
      z.object({ author: z.string().optional(), created: z.string().optional(), text: z.string() }),
    ),
  }),
  async handler(args, ctx) {
    const messages = unwrap(
      await ctx.api.GET('/api/v1/activity/{id}/messages', { params: { path: { id: args.id } } }),
    );
    return {
      comments: (messages ?? [])
        .filter((m) => !m.deleted && m.content)
        .map((m) =>
          compact({
            author: m.name ?? undefined,
            created: m.created?.slice(0, 16).replace('T', ' '),
            text: String(m.content),
          }),
        ),
    };
  },
});

// ---------------------------------------------------------------------------------------
// Write tools
// ---------------------------------------------------------------------------------------

const rpe = z.number().int().min(1).max(10).optional().describe('Perceived exertion 1–10.');
const feel = z
  .number()
  .int()
  .min(1)
  .max(5)
  .optional()
  .describe('How the athlete felt: 1 strong … 5 weak.');

export const updateActivity = defineTool({
  name: 'update_activity',
  title: 'Update an activity',
  description:
    'Edit a completed activity: name, description/notes, sport type, perceived exertion ' +
    '(RPE), feel, tags, or race/commute flags. Only the fields you pass are changed.',
  toolset: 'activities',
  access: 'write',
  idempotent: true,
  operations: ['updateActivity'],
  input: z.object({
    id: activityId,
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(10_000).optional(),
    type: z.string().optional().describe('Sport type, e.g. "Run", "TrailRun", "Walk".'),
    rpe,
    feel,
    tags: z.array(z.string()).optional().describe('Replaces all tags.'),
    race: z.boolean().optional(),
    commute: z.boolean().optional(),
  }),
  output: z.object({ activity: ActivitySummarySchema }),
  async handler({ id, ...f }, ctx) {
    if (Object.values(f).every((v) => v === undefined)) {
      throw new RangeError('Nothing to update: pass at least one field to change.');
    }
    const [athlete, updated] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .PUT('/api/v1/activity/{id}', {
          params: { path: { id } },
          body: compact({
            name: f.name,
            description: f.description,
            type: f.type,
            icu_rpe: f.rpe,
            feel: f.feel,
            tags: f.tags,
            race: f.race,
            commute: f.commute,
          }) as Activity,
        })
        .then(unwrap),
    ]);
    return { activity: summarizeActivity(updated, athlete) };
  },
});

export const createManualActivity = defineTool({
  name: 'create_manual_activity',
  title: 'Log a manual activity',
  description:
    'Log an activity that was not recorded by a device (e.g. a treadmill run without a ' +
    'watch). Today or past dates only. It counts towards training load; confirm details ' +
    'with the user first.',
  toolset: 'activities',
  access: 'write',
  operations: ['createManualActivity'],
  input: z.object({
    date: isoDate,
    time: z
      .string()
      .regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
      .optional()
      .describe('Start time "HH:MM" (default 12:00).'),
    type: z.string().describe('Sport, e.g. "Run", "Walk", "WeightTraining".'),
    name: z.string().min(1).max(200),
    duration: elapsedTime.describe('Moving time ("45:00" or seconds).'),
    distance_km: z.number().positive().optional(),
    description: z.string().max(10_000).optional(),
    rpe,
    feel,
  }),
  output: z.object({ activity: ActivitySummarySchema }),
  async handler(args, ctx) {
    const athlete = await ctx.athlete();
    if (args.date > todayIn(athlete.timezone)) {
      throw new RangeError(
        'Activities cannot be in the future. Use create_events to plan a workout.',
      );
    }
    if (args.duration <= 0) throw new RangeError('"duration" must be greater than zero.');
    const created = unwrap(
      await ctx.api.POST('/api/v1/athlete/{id}/activities/manual', {
        params: { path: { id: ctx.athleteId } },
        body: compact({
          start_date_local: `${args.date}T${(args.time ?? '12:00').padStart(5, '0')}:00`,
          type: args.type,
          name: args.name,
          moving_time: args.duration,
          elapsed_time: args.duration,
          distance: args.distance_km === undefined ? undefined : args.distance_km * 1000,
          description: args.description,
          icu_rpe: args.rpe,
          feel: args.feel,
        }) as Activity,
      }),
    );
    return { activity: summarizeActivity(created, athlete) };
  },
});

export const deleteActivity = defineTool({
  name: 'delete_activity',
  title: 'Delete an activity',
  description:
    'Permanently delete a completed activity and its data. Cannot be undone (the original ' +
    'file is not re-imported automatically): get explicit confirmation from the user first.',
  toolset: 'activities',
  access: 'destructive',
  operations: ['deleteActivity', 'getActivity'],
  input: z.object({ id: activityId }),
  output: z.object({ deleted: ActivitySummarySchema }),
  async handler(args, ctx) {
    const [athlete, activity] = await Promise.all([
      ctx.athlete(),
      ctx.api.GET('/api/v1/activity/{id}', { params: { path: { id: args.id } } }).then(unwrap),
    ]);
    unwrap(await ctx.api.DELETE('/api/v1/activity/{id}', { params: { path: { id: args.id } } }));
    return { deleted: summarizeActivity(activity, athlete) };
  },
});
