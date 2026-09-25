import { z } from 'zod';
import { unwrap } from '../api/client.js';
import type { components } from '../api/schema.js';
import { compact } from '../format/compact.js';
import { formatDistance, formatDuration, round, type UnitSystem } from '../format/units.js';
import { defineTool } from './define-tool.js';
import { isoDate } from './schemas.js';

const ReminderSchema = z.object({
  id: z.number().optional(),
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
                    id: r.id ?? undefined,
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

// ---------------------------------------------------------------------------------------
// Write tools
// ---------------------------------------------------------------------------------------

const GEAR_TYPES = [
  'Shoes',
  'Bike',
  'Wetsuit',
  'RowingMachine',
  'Skis',
  'Snowboard',
  'Boat',
  'Board',
  'Equipment',
  'Accessories',
  'Apparel',
  'Computer',
] as const;

type Gear = components['schemas']['Gear'];

function describeGear(g: Gear, system: UnitSystem) {
  return compact({
    id: String(g.id),
    name: g.name ?? undefined,
    type: g.type ?? undefined,
    distance: g.distance ? formatDistance(g.distance, system) : undefined,
    retired: g.retired?.slice(0, 10),
    reminders: g.reminders?.length
      ? g.reminders.map((r) =>
          compact({
            id: r.id ?? undefined,
            name: r.name ?? undefined,
            used_percent: round(r.percent_used),
          }),
        )
      : undefined,
  });
}

const WrittenGearSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  distance: z.string().optional(),
  retired: z.string().optional(),
  reminders: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string().optional(),
        used_percent: z.number().optional(),
      }),
    )
    .optional(),
});

export const createGear = defineTool({
  name: 'create_gear',
  title: 'Add gear',
  description:
    'Add gear such as a new pair of running shoes, optionally with distance already covered. ' +
    'Activities are linked to gear by the device sync or manually in Intervals.icu.',
  toolset: 'gear',
  access: 'write',
  operations: ['createGear'],
  input: z.object({
    type: z.enum(GEAR_TYPES),
    name: z.string().min(1).max(200),
    starting_distance_km: z.number().min(0).optional().describe('Distance already covered.'),
    purchased: isoDate.optional(),
    notes: z.string().max(5000).optional(),
  }),
  output: z.object({ gear: WrittenGearSchema }),
  async handler(args, ctx) {
    const [athlete, gear] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .POST('/api/v1/athlete/{id}/gear', {
          params: { path: { id: ctx.athleteId } },
          body: compact({
            type: args.type,
            name: args.name,
            distance:
              args.starting_distance_km === undefined
                ? undefined
                : args.starting_distance_km * 1000,
            purchased: args.purchased ? `${args.purchased}T00:00:00` : undefined,
            notes: args.notes,
          }),
        })
        .then(unwrap),
    ]);
    return { gear: describeGear(gear, athlete.unitSystem) };
  },
});

export const updateGear = defineTool({
  name: 'update_gear',
  title: 'Update or retire gear',
  description:
    'Rename gear, change its notes, or retire it (e.g. worn-out shoes; then add the new pair ' +
    'with create_gear). Only the fields you pass are changed.',
  toolset: 'gear',
  access: 'write',
  idempotent: true,
  operations: ['updateGear'],
  input: z.object({
    id: z.string().describe('Gear id (from list_gear).'),
    name: z.string().min(1).max(200).optional(),
    notes: z.string().max(5000).optional(),
    retired: isoDate.optional().describe('Retire the gear as of this date.'),
  }),
  output: z.object({ gear: WrittenGearSchema }),
  async handler({ id, ...f }, ctx) {
    if (Object.values(f).every((v) => v === undefined)) {
      throw new RangeError('Nothing to update: pass a name, notes or retired date.');
    }
    const [athlete, gear] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .PUT('/api/v1/athlete/{id}/gear/{gearId}', {
          params: { path: { id: ctx.athleteId, gearId: id } },
          body: compact({
            name: f.name,
            notes: f.notes,
            retired: f.retired ? `${f.retired}T00:00:00` : undefined,
          }),
        })
        .then(unwrap),
    ]);
    return { gear: describeGear(gear, athlete.unitSystem) };
  },
});

export const addGearReminder = defineTool({
  name: 'add_gear_reminder',
  title: 'Add a gear reminder',
  description:
    'Add a replacement or maintenance reminder to gear, e.g. "replace shoes after 600 km". ' +
    'Set at least one limit.',
  toolset: 'gear',
  access: 'write',
  operations: ['createReminder'],
  input: z.object({
    gear_id: z.string(),
    name: z.string().min(1).max(200).describe('e.g. "Replace" or "Chain wax".'),
    distance_km: z.number().positive().optional(),
    hours: z.number().positive().optional(),
    activities: z.number().int().positive().optional(),
    days: z.number().int().positive().optional(),
  }),
  output: z.object({ gear: WrittenGearSchema }),
  async handler(args, ctx) {
    if (
      args.distance_km === undefined &&
      args.hours === undefined &&
      args.activities === undefined &&
      args.days === undefined
    ) {
      throw new RangeError('Set at least one limit: distance_km, hours, activities or days.');
    }
    const [athlete, gear] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .POST('/api/v1/athlete/{id}/gear/{gearId}/reminder', {
          params: { path: { id: ctx.athleteId, gearId: args.gear_id } },
          body: compact({
            name: args.name,
            distance: args.distance_km === undefined ? undefined : args.distance_km * 1000,
            time: args.hours === undefined ? undefined : Math.round(args.hours * 3600),
            activities: args.activities,
            days: args.days,
          }),
        })
        .then(unwrap),
    ]);
    return { gear: describeGear(gear, athlete.unitSystem) };
  },
});

export const deleteGear = defineTool({
  name: 'delete_gear',
  title: 'Delete gear',
  description:
    'Permanently delete gear and its reminders. To stop using gear but keep its history, ' +
    'retire it with update_gear instead. Get explicit confirmation first.',
  toolset: 'gear',
  access: 'destructive',
  operations: ['deleteGear', 'listGear'],
  input: z.object({ id: z.string() }),
  output: z.object({ deleted: WrittenGearSchema }),
  async handler(args, ctx) {
    const [athlete, all] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .GET('/api/v1/athlete/{id}/gear{ext}', { params: { path: { id: ctx.athleteId, ext: '' } } })
        .then(unwrap),
    ]);
    const gear = (all ?? []).find((g) => String(g.id) === args.id);
    if (!gear) throw new RangeError(`No gear with id ${args.id}.`);
    unwrap(
      await ctx.api.DELETE('/api/v1/athlete/{id}/gear/{gearId}', {
        params: { path: { id: ctx.athleteId, gearId: args.id } },
      }),
    );
    return { deleted: describeGear(gear, athlete.unitSystem) };
  },
});

export const updateGearReminder = defineTool({
  name: 'update_gear_reminder',
  title: 'Reset, snooze or change a gear reminder',
  description:
    'Reset a gear reminder after doing the maintenance (starts counting again), snooze it, ' +
    'or change its limits.',
  toolset: 'gear',
  access: 'write',
  operations: ['updateReminder', 'listGear'],
  input: z.object({
    gear_id: z.string(),
    reminder_id: z.number().int().describe('Reminder id (from list_gear with details).'),
    reset: z.boolean().optional().describe('Start counting from zero again.'),
    snooze_days: z.number().int().min(0).max(365).optional(),
    name: z.string().min(1).max(200).optional(),
    distance_km: z.number().positive().optional(),
    days: z.number().int().positive().optional(),
  }),
  output: z.object({ gear: WrittenGearSchema }),
  async handler(args, ctx) {
    const [athlete, gear] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .PUT('/api/v1/athlete/{id}/gear/{gearId}/reminder/{reminderId}', {
          params: {
            path: { id: ctx.athleteId, gearId: args.gear_id, reminderId: args.reminder_id },
            query: { reset: args.reset ?? false, snoozeDays: args.snooze_days ?? 0 },
          },
          body: compact({
            name: args.name,
            distance: args.distance_km === undefined ? undefined : args.distance_km * 1000,
            days: args.days,
          }),
        })
        .then(unwrap),
    ]);
    return { gear: describeGear(gear, athlete.unitSystem) };
  },
});

export const deleteGearReminder = defineTool({
  name: 'delete_gear_reminder',
  title: 'Delete a gear reminder',
  description: 'Permanently delete a reminder from gear. Confirm with the user first.',
  toolset: 'gear',
  access: 'destructive',
  operations: ['deleteReminder'],
  input: z.object({ gear_id: z.string(), reminder_id: z.number().int() }),
  output: z.object({ gear: WrittenGearSchema }),
  async handler(args, ctx) {
    const [athlete, gear] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .DELETE('/api/v1/athlete/{id}/gear/{gearId}/reminder/{reminderId}', {
          params: {
            path: { id: ctx.athleteId, gearId: args.gear_id, reminderId: args.reminder_id },
          },
        })
        .then(unwrap),
    ]);
    return { gear: describeGear(gear, athlete.unitSystem) };
  },
});
