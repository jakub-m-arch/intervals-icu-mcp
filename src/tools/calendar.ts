import { z } from 'zod';
import { unwrap } from '../api/client.js';
import type { components } from '../api/schema.js';
import { ActivitySummarySchema, summarizeActivity } from '../format/activity.js';
import { compact } from '../format/compact.js';
import { addDays, todayIn } from '../format/dates.js';
import { formatDistance, formatDuration, round, type UnitSystem } from '../format/units.js';
import { checkWorkout, WORKOUT_SYNTAX_SUMMARY } from '../format/workout.js';
import { defineTool, type ToolContext } from './define-tool.js';
import { elapsedTime, isoDate } from './schemas.js';

type Event = components['schemas']['Event'];

export const EVENT_CATEGORIES = [
  'WORKOUT',
  'RACE_A',
  'RACE_B',
  'RACE_C',
  'NOTE',
  'PLAN',
  'HOLIDAY',
  'SICK',
  'INJURED',
  'SET_EFTP',
  'FITNESS_DAYS',
  'SEASON_START',
] as const;

const DEFAULT_DAYS_AHEAD = 14;

export const EventSchema = z.object({
  id: z.number(),
  date: z.string(),
  time: z.string().optional(),
  end_date: z.string().optional(),
  category: z.string().optional(),
  type: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional().describe('Notes or the workout in Intervals.icu text format'),
  planned_duration: z.string().optional(),
  planned_distance: z.string().optional(),
  planned_load: z.number().optional(),
  intensity_percent: z.number().optional(),
  target: z.string().optional().describe('What the workout targets: POWER, HR or PACE'),
  indoor: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export function describeEvent(e: Event, system: UnitSystem, withDescription = true) {
  const start = e.start_date_local ?? '';
  const time = start.slice(11, 16);
  const endDate = e.end_date_local?.slice(0, 10);
  return compact({
    id: e.id as number,
    date: start.slice(0, 10),
    time: time && time !== '00:00' ? time : undefined,
    end_date: endDate && endDate !== start.slice(0, 10) ? endDate : undefined,
    category: e.category ?? undefined,
    type: e.type ?? undefined,
    name: e.name ?? undefined,
    description: withDescription ? e.description?.trim() || undefined : undefined,
    planned_duration: e.moving_time ? formatDuration(e.moving_time) : undefined,
    planned_distance: e.distance ? formatDistance(e.distance, system) : undefined,
    planned_load: round(e.icu_training_load),
    intensity_percent: round(e.icu_intensity),
    target: e.target ?? undefined,
    indoor: e.indoor || undefined,
    tags: e.tags?.length ? e.tags : undefined,
  });
}

export const listEvents = defineTool({
  name: 'list_events',
  title: 'List calendar events',
  description:
    'List calendar entries: planned workouts (with the workout steps as text), races, notes, ' +
    'holidays, sickness and injuries. Defaults to today and the next 2 weeks. Use it to see ' +
    'what is planned or to compare the plan with completed activities.',
  toolset: 'calendar',
  access: 'read',
  operations: ['listEvents'],
  input: z.object({
    oldest: isoDate.optional().describe('First day (YYYY-MM-DD). Default: today.'),
    newest: isoDate
      .optional()
      .describe(
        `Last day (YYYY-MM-DD), inclusive. Default: oldest + ${DEFAULT_DAYS_AHEAD - 1} days.`,
      ),
    categories: z
      .array(z.enum(EVENT_CATEGORIES))
      .optional()
      .describe('Only these categories, e.g. ["WORKOUT"] or ["RACE_A","RACE_B","RACE_C"].'),
    include_descriptions: z
      .boolean()
      .optional()
      .describe('Include workout text and notes (default true).'),
  }),
  output: z.object({
    range: z.object({ oldest: z.string(), newest: z.string() }),
    count: z.number(),
    events: z.array(EventSchema),
  }),
  async handler(args, ctx) {
    const athlete = await ctx.athlete();
    const oldest = args.oldest ?? todayIn(athlete.timezone);
    const newest = args.newest ?? addDays(oldest, DEFAULT_DAYS_AHEAD - 1);
    if (oldest > newest) {
      throw new RangeError(`"oldest" (${oldest}) must not be after "newest" (${newest}).`);
    }
    const events = unwrap(
      await ctx.api.GET('/api/v1/athlete/{id}/events{format}', {
        params: {
          path: { id: ctx.athleteId, format: '' },
          query: {
            oldest,
            newest,
            ...(args.categories?.length ? { category: [...args.categories] } : {}),
          },
        },
      }),
    );
    const list = (events ?? [])
      .sort((a, b) => String(a.start_date_local).localeCompare(String(b.start_date_local)))
      .map((e) => describeEvent(e, athlete.unitSystem, args.include_descriptions ?? true));
    return { range: { oldest, newest }, count: list.length, events: list };
  },
});

export const getEvent = defineTool({
  name: 'get_event',
  title: 'Get calendar event',
  description:
    'Get one calendar event (planned workout, race or note) by id, including the full ' +
    'workout description.',
  toolset: 'calendar',
  access: 'read',
  operations: ['showEvent'],
  input: z.object({ id: z.number().int().describe('Event id (from list_events).') }),
  output: z.object({ event: EventSchema }),
  async handler(args, ctx) {
    const [athlete, event] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .GET('/api/v1/athlete/{id}/events/{eventId}', {
          params: { path: { id: ctx.athleteId, eventId: args.id } },
        })
        .then(unwrap),
    ]);
    return { event: describeEvent(event, athlete.unitSystem) };
  },
});

// ---------------------------------------------------------------------------------------
// Write tools
// ---------------------------------------------------------------------------------------

/** Categories that make sense to create from a conversation. */
export const WRITABLE_CATEGORIES = [
  'WORKOUT',
  'RACE_A',
  'RACE_B',
  'RACE_C',
  'NOTE',
  'HOLIDAY',
  'SICK',
  'INJURED',
] as const;

const MAX_EVENTS_PER_CALL = 50;
const clock = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Use 24h "HH:MM"');

const WorkoutCheckSchema = z.object({
  parsed_steps: z.number(),
  duration: z.string().optional(),
  distance: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});

const WrittenEventSchema = EventSchema.extend({
  workout_check: WorkoutCheckSchema.optional().describe(
    'How Intervals.icu understood the workout text; fix the text if there are warnings',
  ),
});

const eventFields = {
  time: clock.optional().describe('Start time "HH:MM" (optional).'),
  type: z
    .string()
    .optional()
    .describe('Sport, e.g. "Run", "Ride", "Walk". Required for workouts and races.'),
  name: z.string().min(1).max(200),
  description: z
    .string()
    .max(10_000)
    .optional()
    .describe('For workouts: the steps in workout text syntax. Otherwise free-text notes.'),
  end_date: isoDate.optional().describe('Last day for multi-day entries (holiday, sick, …).'),
  duration: elapsedTime
    .optional()
    .describe('Planned duration ("45:00" or seconds) when there are no workout steps.'),
  distance_km: z.number().positive().optional().describe('Planned distance in km.'),
  indoor: z.boolean().optional(),
};

const EventInput = z.object({
  date: isoDate,
  category: z.enum(WRITABLE_CATEGORIES).optional().describe('Default WORKOUT.'),
  ...eventFields,
});
type EventInputT = z.infer<typeof EventInput>;
/** A full event input or a partial set of changes (update_event). */
type EventChanges = { [K in keyof EventInputT]?: EventInputT[K] | undefined };

function needsSport(category: string | undefined) {
  return category === undefined || category === 'WORKOUT' || category.startsWith('RACE');
}

/**
 * Builds an API body from event fields. For updates, `existingStart` keeps the current date or
 * time when only the other one changes.
 */
function eventBody(e: EventChanges, existingStart?: string) {
  const date = e.date ?? existingStart?.slice(0, 10);
  const time = e.time ?? existingStart?.slice(11, 16) ?? '00:00';
  return compact({
    category: e.category,
    type: e.type,
    name: e.name,
    description: e.description,
    start_date_local:
      e.date !== undefined || e.time !== undefined
        ? `${date}T${time.padStart(5, '0')}:00`
        : undefined,
    end_date_local: e.end_date ? `${e.end_date}T00:00:00` : undefined,
    moving_time: e.duration,
    distance: e.distance_km === undefined ? undefined : e.distance_km * 1000,
    indoor: e.indoor,
  });
}

function withWorkoutCheck(event: Event, system: UnitSystem) {
  const described = describeEvent(event, system);
  const hasSteps = event.category === 'WORKOUT' && Boolean(event.description?.trim());
  return compact({
    ...described,
    workout_check: hasSteps ? checkWorkout(event.workout_doc, system) : undefined,
  });
}

const sameName = (a: string | undefined, b: string | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

export const createEvents = defineTool({
  name: 'create_events',
  title: 'Add events to the calendar',
  description:
    'Add planned workouts, races, notes or holidays/sickness to the athlete calendar ' +
    `(up to ${MAX_EVENTS_PER_CALL} per call). Planned workouts sync to the athlete's watch ` +
    'when their device integration is enabled. Show the plan to the user and get agreement ' +
    'before calling. An entry with the same date, category and name as an existing one is ' +
    'skipped unless allow_duplicates is true. Check workout_check in the result and fix any ' +
    `warnings with update_event.\n\n${WORKOUT_SYNTAX_SUMMARY}`,
  toolset: 'calendar',
  access: 'write',
  operations: ['createMultipleEvents', 'listEvents'],
  input: z.object({
    events: z.array(EventInput).min(1).max(MAX_EVENTS_PER_CALL),
    allow_duplicates: z.boolean().optional().describe('Create even if an identical entry exists.'),
  }),
  output: z.object({
    created: z.array(WrittenEventSchema),
    skipped: z.array(
      z.object({ date: z.string(), name: z.string(), existing_id: z.number(), reason: z.string() }),
    ),
  }),
  async handler(args, ctx) {
    for (const e of args.events) {
      if (needsSport(e.category) && !e.type) {
        throw new RangeError(
          `"${e.name}" on ${e.date}: "type" (sport) is required for workouts and races.`,
        );
      }
      if (e.end_date && e.end_date < e.date) {
        throw new RangeError(`"${e.name}": end_date must not be before date.`);
      }
    }
    const athlete = await ctx.athlete();
    const dates = args.events.map((e) => e.date).sort();

    const skipped: Array<{ date: string; name: string; existing_id: number; reason: string }> = [];
    let toCreate = args.events;
    if (!args.allow_duplicates) {
      const existing = unwrap(
        await ctx.api.GET('/api/v1/athlete/{id}/events{format}', {
          params: {
            path: { id: ctx.athleteId, format: '' },
            query: { oldest: dates[0] as string, newest: dates[dates.length - 1] as string },
          },
        }),
      );
      toCreate = args.events.filter((e) => {
        const match = (existing ?? []).find(
          (x) =>
            x.start_date_local?.slice(0, 10) === e.date &&
            (x.category ?? 'WORKOUT') === (e.category ?? 'WORKOUT') &&
            sameName(x.name, e.name),
        );
        if (match?.id) {
          skipped.push({
            date: e.date,
            name: e.name,
            existing_id: match.id,
            reason: 'An entry with the same date, category and name already exists.',
          });
        }
        return !match;
      });
    }

    if (toCreate.length === 0) return { created: [], skipped };
    const created = unwrap(
      await ctx.api.POST('/api/v1/athlete/{id}/events/bulk', {
        params: {
          path: { id: ctx.athleteId },
          query: { upsertOnUid: false, updatePlanApplied: false },
        },
        body: toCreate.map((e) =>
          eventBody({ ...e, category: e.category ?? 'WORKOUT' }),
        ) as components['schemas']['EventEx'][],
      }),
    );
    return {
      created: (created ?? []).map((e) => withWorkoutCheck(e, athlete.unitSystem)),
      skipped,
    };
  },
});

async function loadEvent(ctx: ToolContext, id: number): Promise<Event> {
  return unwrap(
    await ctx.api.GET('/api/v1/athlete/{id}/events/{eventId}', {
      params: { path: { id: ctx.athleteId, eventId: id } },
    }),
  );
}

export const updateEvent = defineTool({
  name: 'update_event',
  title: 'Update a calendar event',
  description:
    'Change a calendar event: move it to another date, rename it, or rewrite the workout ' +
    'steps. Only the fields you pass are changed. Confirm the change with the user first.' +
    `\n\n${WORKOUT_SYNTAX_SUMMARY}`,
  toolset: 'calendar',
  access: 'write',
  idempotent: true,
  operations: ['updateEvent', 'showEvent'],
  input: z.object({
    id: z.number().int().describe('Event id (from list_events).'),
    date: isoDate.optional().describe('Move to this date.'),
    category: z.enum(WRITABLE_CATEGORIES).optional(),
    ...eventFields,
    name: z.string().min(1).max(200).optional(),
  }),
  output: z.object({ event: WrittenEventSchema }),
  async handler({ id, ...changes }, ctx) {
    if (Object.values(changes).every((v) => v === undefined)) {
      throw new RangeError('Nothing to update: pass at least one field to change.');
    }
    const [athlete, existing] = await Promise.all([ctx.athlete(), loadEvent(ctx, id)]);
    const updated = unwrap(
      await ctx.api.PUT('/api/v1/athlete/{id}/events/{eventId}', {
        params: { path: { id: ctx.athleteId, eventId: id } },
        body: eventBody(changes, existing.start_date_local) as components['schemas']['EventEx'],
      }),
    );
    return { event: withWorkoutCheck(updated, athlete.unitSystem) };
  },
});

export const markEventDone = defineTool({
  name: 'mark_event_done',
  title: 'Mark a planned workout as done',
  description:
    'Mark a planned workout as completed without a recorded file: creates a manual activity ' +
    'matching the plan (for sessions done without a watch). Only for today or past dates.',
  toolset: 'calendar',
  access: 'write',
  operations: ['markEventAsDone', 'showEvent'],
  input: z.object({ id: z.number().int().describe('Planned workout event id.') }),
  output: z.object({ activity: ActivitySummarySchema }),
  async handler(args, ctx) {
    const [athlete, event] = await Promise.all([ctx.athlete(), loadEvent(ctx, args.id)]);
    const date = event.start_date_local?.slice(0, 10) ?? '';
    if (date > todayIn(athlete.timezone)) {
      throw new RangeError(
        `This workout is planned for ${date}; it can only be marked done on or after that day.`,
      );
    }
    const activity = unwrap(
      await ctx.api.POST('/api/v1/athlete/{id}/events/{eventId}/mark-done', {
        params: { path: { id: ctx.athleteId, eventId: args.id } },
      }),
    );
    return { activity: summarizeActivity(activity, athlete) };
  },
});

export const duplicateEvents = defineTool({
  name: 'duplicate_events',
  title: 'Repeat events in later weeks',
  description:
    "Copy calendar events to later weeks, e.g. repeat this week's workouts for the next 3 " +
    'weeks. Confirm with the user first.',
  toolset: 'calendar',
  access: 'write',
  operations: ['duplicateEvents'],
  input: z.object({
    ids: z.array(z.number().int()).min(1).max(MAX_EVENTS_PER_CALL).describe('Event ids to copy.'),
    copies: z.number().int().min(1).max(12).describe('How many copies of each event.'),
    weeks_between: z.number().int().min(1).max(8).optional().describe('Default 1 (weekly).'),
  }),
  output: z.object({ created: z.array(EventSchema) }),
  async handler(args, ctx) {
    const [athlete, created] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .POST('/api/v1/athlete/{id}/duplicate-events', {
          params: { path: { id: ctx.athleteId } },
          body: {
            eventIds: args.ids,
            numCopies: args.copies,
            weeksBetween: args.weeks_between ?? 1,
          },
        })
        .then(unwrap),
    ]);
    return {
      created: (created ?? [])
        .sort((a, b) => String(a.start_date_local).localeCompare(String(b.start_date_local)))
        .map((e) => describeEvent(e, athlete.unitSystem, false)),
    };
  },
});

export const deleteEvents = defineTool({
  name: 'delete_events',
  title: 'Delete calendar events',
  description:
    'Permanently delete calendar events (planned workouts, notes, races) by id. This cannot ' +
    'be undone: list what will be deleted and get explicit confirmation from the user first.',
  toolset: 'calendar',
  access: 'destructive',
  operations: ['deleteEventsBulk', 'showEvent'],
  input: z.object({
    ids: z.array(z.number().int()).min(1).max(MAX_EVENTS_PER_CALL).describe('Event ids.'),
  }),
  output: z.object({ deleted: z.number(), events: z.array(EventSchema) }),
  async handler(args, ctx) {
    const athlete = await ctx.athlete();
    // Resolve every id first so a typo cannot delete a partial set.
    const events = await Promise.all(args.ids.map((id) => loadEvent(ctx, id)));
    const result = unwrap(
      await ctx.api.PUT('/api/v1/athlete/{id}/events/bulk-delete', {
        params: { path: { id: ctx.athleteId } },
        body: args.ids.map((id) => ({ id })),
      }),
    );
    return {
      deleted: result?.eventsDeleted ?? 0,
      events: events.map((e) => describeEvent(e, athlete.unitSystem, false)),
    };
  },
});
