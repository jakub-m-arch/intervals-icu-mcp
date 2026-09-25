import { z } from 'zod';
import { unwrap } from '../api/client.js';
import type { components } from '../api/schema.js';
import { compact } from '../format/compact.js';
import { formatPace, type PaceUnits, paceUnitMeters } from '../format/units.js';
import { defineTool } from './define-tool.js';

type SportSettings = components['schemas']['SportSettings'];

// Note: these tools are covered by mocked tests only. Live tests do not run them because they
// would change the athlete's real thresholds. They rely on the partial-update (merge) behaviour
// verified live for other PUT endpoints.

const pace = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, 'Use "m:ss", e.g. "5:30"')
  .describe('Threshold pace as "m:ss" in the sport\'s pace units (e.g. per km).');

function describeSettings(s: SportSettings) {
  const units = (s.pace_units as PaceUnits | undefined) ?? 'NONE';
  return compact({
    id: s.id ?? undefined,
    types: s.types ? [...s.types] : undefined,
    lthr: s.lthr ?? undefined,
    max_hr: s.max_hr ?? undefined,
    threshold_pace: formatPace(s.threshold_pace, units === 'NONE' ? 'MINS_KM' : units),
    ftp_watts: s.ftp ?? undefined,
    pace_units: s.pace_units ?? undefined,
  });
}

const SettingsSchema = z.object({
  id: z.number().optional(),
  types: z.array(z.string()).optional(),
  lthr: z.number().optional(),
  max_hr: z.number().optional(),
  threshold_pace: z.string().optional(),
  ftp_watts: z.number().optional(),
  pace_units: z.string().optional(),
});

export const updateSportSettings = defineTool({
  name: 'update_sport_settings',
  title: 'Update sport thresholds',
  description:
    'Set training thresholds for a sport: threshold pace, lactate threshold HR (LTHR), max HR ' +
    'or FTP. Pace and HR zones are defined relative to these, so this changes how future ' +
    'workouts and zones are calculated. Only the fields you pass are changed. Confirm the ' +
    'new values with the user first. Existing activities are only recalculated with ' +
    'apply_sport_settings.',
  toolset: 'settings',
  access: 'write',
  idempotent: true,
  operations: ['updateSettings'],
  input: z.object({
    sport: z.string().describe('Activity type whose settings to change, e.g. "Run".'),
    threshold_pace: pace.optional(),
    lthr: z.number().int().min(80).max(230).optional(),
    max_hr: z.number().int().min(100).max(240).optional(),
    ftp_watts: z.number().int().min(30).max(700).optional(),
    recalc_hr_zones: z
      .boolean()
      .optional()
      .describe('Recompute HR zones from the new LTHR/max HR (default false).'),
  }),
  output: z.object({ settings: SettingsSchema }),
  async handler(args, ctx) {
    const { sport, recalc_hr_zones, ...changes } = args;
    if (Object.values(changes).every((v) => v === undefined)) {
      throw new RangeError('Nothing to update: pass at least one threshold.');
    }
    const athlete = await ctx.athlete();
    const current = athlete.sportSettingsFor(sport);
    if (!current) throw new RangeError(`No sport settings include "${sport}".`);

    let thresholdSpeed: number | undefined;
    if (args.threshold_pace) {
      const units = athlete.paceUnitsFor(sport);
      const meters = paceUnitMeters(units);
      if (meters === undefined) throw new RangeError(`"${sport}" does not use pace.`);
      const [m, s] = args.threshold_pace.split(':').map(Number) as [number, number];
      thresholdSpeed = meters / (m * 60 + s);
    }
    const updated = unwrap(
      await ctx.api.PUT('/api/v1/athlete/{athleteId}/sport-settings/{id}', {
        params: {
          path: { athleteId: ctx.athleteId, id: String(current.id) },
          query: { recalcHrZones: recalc_hr_zones ?? false },
        },
        body: compact({
          threshold_pace: thresholdSpeed,
          lthr: args.lthr,
          max_hr: args.max_hr,
          ftp: args.ftp_watts,
        }) as SportSettings,
      }),
    );
    ctx.invalidateAthlete();
    return { settings: describeSettings(updated) };
  },
});

export const applySportSettings = defineTool({
  name: 'apply_sport_settings',
  title: 'Recalculate activities with current settings',
  description:
    'Re-apply the current sport settings (zones, thresholds) to all past activities of that ' +
    'sport, e.g. after changing threshold pace. Runs in the background on Intervals.icu and ' +
    'changes stored zone times and training load of past activities.',
  toolset: 'settings',
  access: 'write',
  idempotent: true,
  operations: ['applyToActivities'],
  input: z.object({ sport: z.string().describe('e.g. "Run".') }),
  output: z.object({ started: z.boolean(), sport_types: z.array(z.string()) }),
  async handler(args, ctx) {
    const athlete = await ctx.athlete();
    const current = athlete.sportSettingsFor(args.sport);
    if (!current) throw new RangeError(`No sport settings include "${args.sport}".`);
    unwrap(
      await ctx.api.PUT('/api/v1/athlete/{athleteId}/sport-settings/{id}/apply', {
        params: { path: { athleteId: ctx.athleteId, id: String(current.id) } },
      }),
    );
    return { started: true, sport_types: [...(current.types ?? [])] };
  },
});
