import { z } from 'zod';
import { unwrap } from '../api/client.js';
import type { components } from '../api/schema.js';
import { compact } from '../format/compact.js';
import { resolveRange, todayIn } from '../format/dates.js';
import { mean } from '../format/streams.js';
import { formatHoursMinutes, round } from '../format/units.js';
import { defineTool } from './define-tool.js';
import { isoDate } from './schemas.js';

type Wellness = components['schemas']['Wellness'];

const DEFAULT_DAYS = 14;

const DaySchema = z.object({
  date: z.string(),
  resting_hr: z.number().optional(),
  hrv_rmssd_ms: z.number().optional(),
  hrv_sdnn_ms: z.number().optional(),
  sleep: z.string().optional(),
  sleep_score: z.number().optional(),
  sleep_quality: z.number().optional(),
  avg_sleeping_hr: z.number().optional(),
  readiness: z.number().optional(),
  weight_kg: z.number().optional(),
  body_fat_percent: z.number().optional(),
  steps: z.number().optional(),
  spo2: z.number().optional(),
  respiration: z.number().optional(),
  vo2max: z.number().optional(),
  soreness: z.number().optional(),
  fatigue: z.number().optional(),
  stress: z.number().optional(),
  mood: z.number().optional(),
  motivation: z.number().optional(),
  injury: z.number().optional(),
  kcal_consumed: z.number().optional(),
  fitness: z.number().optional(),
  fatigue_atl: z.number().optional(),
  comments: z.string().optional(),
});

function describeDay(w: Wellness) {
  return compact({
    date: String(w.id),
    resting_hr: round(w.restingHR),
    hrv_rmssd_ms: round(w.hrv, 1),
    hrv_sdnn_ms: round(w.hrvSDNN, 1),
    sleep: w.sleepSecs ? formatHoursMinutes(w.sleepSecs) : undefined,
    sleep_score: round(w.sleepScore),
    sleep_quality: w.sleepQuality ?? undefined,
    avg_sleeping_hr: round(w.avgSleepingHR),
    readiness: round(w.readiness),
    weight_kg: round(w.weight, 1),
    body_fat_percent: round(w.bodyFat, 1),
    steps: w.steps ?? undefined,
    spo2: round(w.spO2, 1),
    respiration: round(w.respiration, 1),
    vo2max: round(w.vo2max, 1),
    soreness: w.soreness ?? undefined,
    fatigue: w.fatigue ?? undefined,
    stress: w.stress ?? undefined,
    mood: w.mood ?? undefined,
    motivation: w.motivation ?? undefined,
    injury: w.injury ?? undefined,
    kcal_consumed: w.kcalConsumed ?? undefined,
    fitness: round(w.ctl, 1),
    fatigue_atl: round(w.atl, 1),
    comments: w.comments?.trim() || undefined,
  });
}

export const getWellness = defineTool({
  name: 'get_wellness',
  title: 'Get wellness and recovery data',
  description:
    'Get daily wellness data: resting HR, HRV, sleep (duration, score), weight, steps, ' +
    'readiness and subjective ratings (soreness, fatigue, stress, mood, motivation on the ' +
    'Intervals.icu 1–4 scales), plus period averages. Defaults to the last 14 days. Use it ' +
    'for recovery and readiness questions.',
  toolset: 'wellness',
  access: 'read',
  operations: ['listWellnessRecords'],
  input: z.object({
    oldest: isoDate
      .optional()
      .describe(`First day (YYYY-MM-DD). Default: ${DEFAULT_DAYS} days ago.`),
    newest: isoDate.optional().describe('Last day (YYYY-MM-DD), inclusive. Default: today.'),
  }),
  output: z.object({
    range: z.object({ oldest: z.string(), newest: z.string() }),
    averages: z.object({
      resting_hr: z.number().optional(),
      hrv_rmssd_ms: z.number().optional(),
      sleep: z.string().optional(),
      sleep_score: z.number().optional(),
    }),
    days: z.array(DaySchema),
  }),
  async handler(args, ctx) {
    const athlete = await ctx.athlete();
    const range = resolveRange(args, todayIn(athlete.timezone), DEFAULT_DAYS);
    const records = unwrap(
      await ctx.api.GET('/api/v1/athlete/{id}/wellness{ext}', {
        params: { path: { id: ctx.athleteId, ext: '' }, query: range },
      }),
    );
    const days = (records ?? [])
      .filter((w) => w.id)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const avgSleep = mean(days.map((d) => d.sleepSecs || undefined));

    return {
      range,
      averages: compact({
        resting_hr: round(mean(days.map((d) => d.restingHR)), 1),
        hrv_rmssd_ms: round(mean(days.map((d) => d.hrv)), 1),
        sleep: formatHoursMinutes(avgSleep),
        sleep_score: round(mean(days.map((d) => d.sleepScore)), 1),
      }),
      days: days.map(describeDay),
    };
  },
});
