import { z } from 'zod';
import { unwrap } from '../api/client.js';
import { compact } from '../format/compact.js';
import { todayIn } from '../format/dates.js';
import { formatDistance, formatDuration, formatPace, type PaceUnits } from '../format/units.js';
import { defineTool } from './define-tool.js';

const DEFAULT_DISTANCES = [400, 800, 1000, 1609.34, 3000, 5000, 10000, 21097.5, 42195];
const DEFAULT_DURATIONS = [5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200];
const PERIOD = /^(\d+[dy]|all)$/;

const PointSchema = z.object({
  distance: z.string().optional(),
  duration: z.string().optional(),
  time: z.string().optional(),
  pace: z.string().optional(),
  value: z.string().optional(),
  activity_id: z.string().optional(),
  activity: z.string().optional(),
});

const CurveSchema = z.object({
  period: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
  critical_speed_pace: z
    .string()
    .optional()
    .describe('Pace at critical speed (≈ threshold pace, sustainable for ~30–60 min)'),
  d_prime_m: z.number().optional().describe("D': distance that can be covered above CS"),
  points: z.array(PointSchema),
});

type CurveSet = {
  list?: Array<{
    id?: string;
    label?: string;
    start_date_local?: string;
    end_date_local?: string;
    distance?: number[];
    secs?: number[];
    values?: number[];
    activity_id?: string[];
    paceModels?: Array<{ type?: string; criticalSpeed?: number; dPrime?: number }>;
  }>;
  activities?: Record<string, { name?: string; start_date_local?: string }>;
};

export const getAthleteCurves = defineTool({
  name: 'get_athlete_curves',
  title: 'Get personal bests curves',
  description:
    'Get personal bests for a sport over one or more periods: best times and paces at standard ' +
    'distances (pace), or highest average heart rate / power for standard durations. Pace ' +
    'curves include critical speed, a good estimate of threshold pace. Use it for PRs, race ' +
    'predictions and fitness progress (compare periods such as 42d vs 1y).',
  toolset: 'curves',
  access: 'read',
  operations: ['listAthletePaceCurves', 'listAthleteHRCurves', 'listAthletePowerCurves'],
  input: z.object({
    metric: z.enum(['pace', 'gap', 'hr', 'power']).describe('gap = grade-adjusted pace.'),
    sport: z.string().optional().describe('Activity type, e.g. "Run" (default) or "Ride".'),
    periods: z
      .array(z.string().regex(PERIOD, 'Use e.g. "42d", "90d", "1y", "2y" or "all"'))
      .min(1)
      .max(4)
      .optional()
      .describe('Periods to compare, e.g. ["42d", "1y", "all"] (default ["90d", "all"]).'),
    distances_m: z
      .array(z.number().positive())
      .optional()
      .describe("Pace only: distances in meters (default: the sport's best-effort distances)."),
    durations_s: z
      .array(z.number().int().positive())
      .optional()
      .describe('HR/power only: durations in seconds (default 5 s … 2 h).'),
  }),
  output: z.object({ metric: z.string(), sport: z.string(), curves: z.array(CurveSchema) }),
  async handler(args, ctx) {
    const athlete = await ctx.athlete();
    const sport = args.sport ?? 'Run';
    const curves = args.periods ?? ['90d', 'all'];
    const common = {
      path: { id: ctx.athleteId, ext: '' },
      query: { type: sport, curves, now: todayIn(athlete.timezone) },
    };
    // biome-ignore lint/suspicious/noExplicitAny: `type` is a large enum in the spec; validated by the API
    const params = common as any;
    const data = unwrap(
      args.metric === 'hr'
        ? await ctx.api.GET('/api/v1/athlete/{id}/hr-curves{ext}', { params })
        : args.metric === 'power'
          ? await ctx.api.GET('/api/v1/athlete/{id}/power-curves{ext}', { params })
          : await ctx.api.GET('/api/v1/athlete/{id}/pace-curves{ext}', {
              params: { ...params, query: { ...params.query, gap: args.metric === 'gap' } },
            }),
    ) as CurveSet;

    const activities = data?.activities ?? {};
    const describeActivity = (id: string | undefined) => {
      const a = id ? activities[id] : undefined;
      return a ? `${a.name ?? 'Activity'} (${a.start_date_local?.slice(0, 10) ?? '?'})` : undefined;
    };
    const isPace = args.metric === 'pace' || args.metric === 'gap';
    const paceUnits: PaceUnits = athlete.paceUnitsFor(sport);
    const sportSettings = athlete.sportSettingsFor(sport);

    return {
      metric: args.metric,
      sport,
      curves: (data?.list ?? []).map((curve) => {
        const values = curve.values ?? [];
        const ids = curve.activity_id ?? [];
        let points: z.infer<typeof PointSchema>[];

        if (isPace) {
          const targets =
            args.distances_m ?? sportSettings?.best_effort_distances ?? DEFAULT_DISTANCES;
          const distances = curve.distance ?? [];
          points = targets.flatMap((target) => {
            // Curve points sit at fixed distances; accept a point within 1%.
            const i = distances.findIndex((d) => Math.abs(d - target) <= target * 0.01);
            const seconds = values[i];
            if (i < 0 || seconds === undefined || seconds <= 0) return [];
            return [
              compact({
                distance: formatDistance(target, athlete.unitSystem),
                time: formatDuration(seconds),
                pace: formatPace(
                  (distances[i] as number) / seconds,
                  paceUnits === 'NONE' ? 'MINS_KM' : paceUnits,
                ),
                activity_id: ids[i],
                activity: describeActivity(ids[i]),
              }),
            ];
          });
        } else {
          const secs = curve.secs ?? [];
          const unit = args.metric === 'hr' ? 'bpm' : 'W';
          points = (args.durations_s ?? DEFAULT_DURATIONS).flatMap((target) => {
            const i = secs.indexOf(target);
            const value = values[i];
            if (i < 0 || value === undefined || value <= 0) return [];
            return [
              compact({
                duration: formatDuration(target),
                value: `${Math.round(value)} ${unit}`,
                activity_id: ids[i],
                activity: describeActivity(ids[i]),
              }),
            ];
          });
        }

        const cs = curve.paceModels?.find((m) => m.type === 'CS');
        return compact({
          period: curve.label ?? curve.id ?? '?',
          from: curve.start_date_local?.slice(0, 10),
          to: curve.end_date_local?.slice(0, 10),
          critical_speed_pace:
            isPace && cs?.criticalSpeed
              ? formatPace(cs.criticalSpeed, paceUnits === 'NONE' ? 'MINS_KM' : paceUnits)
              : undefined,
          d_prime_m: isPace && cs?.dPrime ? Math.round(cs.dPrime) : undefined,
          points,
        });
      }),
    };
  },
});
