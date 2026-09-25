/**
 * Read-only smoke tests against the real Intervals.icu API.
 * Run with: npm run test:live (needs INTERVALS_ICU_API_KEY, e.g. in .env).
 */
import { appendFileSync } from 'node:fs';
import type { Client } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { callTool, connectClient } from '../helpers/mcp.js';

const hasKey = Boolean(process.env.INTERVALS_ICU_API_KEY);
/** Path to append tool outputs to, for manual inspection. */
const verbose = process.env.LIVE_OUTPUT;

describe.skipIf(!hasKey)('live Intervals.icu API (read-only)', () => {
  let client: Client;

  beforeAll(async () => {
    client = await connectClient({ ...loadConfig(), writeMode: 'read-only' });
  });
  afterAll(async () => {
    await client?.close();
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const { result, text, json } = await callTool(client, name, args);
    if (verbose) appendFileSync(verbose, `\n=== ${name} ${JSON.stringify(args)}\n${text}\n`);
    expect(result.isError, text).toBeFalsy();
    return json;
  }

  it('get_athlete_profile', async () => {
    const json = await call('get_athlete_profile');
    expect(json.athlete).toBeDefined();
  });

  it('get_fitness_summary', async () => {
    const json = await call('get_fitness_summary');
    expect(Array.isArray(json.daily)).toBe(true);
  });

  it('activities and analysis', async () => {
    const list = await call('list_activities', { oldest: '2026-01-01', type: 'Run', limit: 5 });
    const run = (list.activities as Array<{ id: string; name?: string }>)[0];
    if (!run) return;
    const id = run.id;
    await call('get_activity', { id, include_intervals: true });
    await call('search_activities', { query: run.name?.split(' ')[0] ?? 'a', limit: 3 });
    await call('list_activity_comments', { id });
    await call('get_activity_streams', { id, max_points: 12 });
    await call('get_activity_histogram', { id, metric: 'hr', bucket_size: 10 });
    await call('get_activity_histogram', { id, metric: 'pace', bucket_size: 30 });
    await call('get_activity_best_efforts', { id, metric: 'pace', distance_m: 1000, count: 2 });
    await call('get_activity_best_efforts', { id, metric: 'hr', duration_s: 300, count: 2 });
    await call('get_activity_segment_stats', { id, start: '0:00', end: '10:00' });
  });

  it('curves, wellness, calendar, library, gear', async () => {
    await call('get_athlete_curves', { metric: 'pace', periods: ['42d', 'all'] });
    await call('get_athlete_curves', { metric: 'hr' });
    await call('search_intervals', {
      min_duration_s: 60,
      max_duration_s: 600,
      min_intensity: 80,
      max_intensity: 120,
      limit: 3,
    });
    await call('get_wellness', {});
    await call('list_events', {});
    await call('list_workout_library', {});
    await call('get_training_plan', {});
    await call('list_gear', {});
  });
});
