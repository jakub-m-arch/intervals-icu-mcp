import { z } from 'zod';
import { unwrap } from '../api/client.js';
import { compact } from '../format/compact.js';
import { formatDistance, formatDuration, round } from '../format/units.js';
import { defineTool } from './define-tool.js';

const ReminderSchema = z.object({
  name: z.string().optional(),
  used_percent: z.number().optional(),
  distance: z.string().optional().describe('Used / limit'),
  time: z.string().optional().describe('Used / limit'),
  activities: z.string().optional().describe('Used / limit'),
  days: z.string().optional().describe('Used / limit'),
});

const GearSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  distance: z.string().optional(),
  time: z.string().optional(),
  activities: z.number().optional(),
  purchased: z.string().optional(),
  retired: z.string().optional(),
  notes: z.string().optional(),
  reminders: z.array(ReminderSchema).optional(),
});

const usedOf = (used: number | undefined, limit: number | undefined, fmt: (n: number) => string) =>
  limit ? `${fmt(used ?? 0)} / ${fmt(limit)}` : undefined;

export const listGear = defineTool({
  name: 'list_gear',
  title: 'List gear',
  description:
    'List gear such as running shoes and bikes with accumulated distance, time and number of ' +
    'activities, plus maintenance/replacement reminders (e.g. shoes at 600 km).',
  toolset: 'gear',
  access: 'read',
  operations: ['listGear'],
  input: z.object({
    include_retired: z.boolean().optional().describe('Include retired gear (default false).'),
    type: z.string().optional().describe('Only this gear type, e.g. "Shoes" or "Bike".'),
  }),
  output: z.object({ gear: z.array(GearSchema) }),
  async handler(args, ctx) {
    const [athlete, gear] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .GET('/api/v1/athlete/{id}/gear{ext}', { params: { path: { id: ctx.athleteId, ext: '' } } })
        .then(unwrap),
    ]);
    const system = athlete.unitSystem;
    const dist = (m: number) => formatDistance(m, system) ?? `${m} m`;
    return {
      gear: (gear ?? [])
        .filter((g) => args.include_retired || !g.retired)
        .filter((g) => !args.type || g.type?.toLowerCase() === args.type.toLowerCase())
        .map((g) =>
          compact({
            id: String(g.id),
            name: g.name ?? undefined,
            type: g.type ?? undefined,
            // Gear distance is in meters and time in seconds, like the rest of the API.
            distance: g.distance ? formatDistance(g.distance, system) : undefined,
            time: g.time ? formatDuration(g.time) : undefined,
            activities: g.activities ?? undefined,
            purchased: g.purchased?.slice(0, 10),
            retired: g.retired?.slice(0, 10),
            notes: g.notes?.trim() || undefined,
            reminders: g.reminders?.length
              ? g.reminders.map((r) =>
                  compact({
                    name: r.name ?? undefined,
                    used_percent: round(r.percent_used),
                    distance: usedOf(r.distance_used, r.distance, dist),
                    time: usedOf(r.time_used, r.time, (s) => formatDuration(s) ?? `${s} s`),
                    activities: usedOf(r.activities_used, r.activities, String),
                    days: usedOf(r.days_used, r.days, String),
                  }),
                )
              : undefined,
          }),
        ),
    };
  },
});
