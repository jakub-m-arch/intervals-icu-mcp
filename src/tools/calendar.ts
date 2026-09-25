import { z } from 'zod';
import { unwrap } from '../api/client.js';
import type { components } from '../api/schema.js';
import { compact } from '../format/compact.js';
import { addDays, todayIn } from '../format/dates.js';
import { formatDistance, formatDuration, round, type UnitSystem } from '../format/units.js';
import { defineTool } from './define-tool.js';
import { isoDate } from './schemas.js';

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
