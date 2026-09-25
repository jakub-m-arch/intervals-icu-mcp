import type { Client } from '@modelcontextprotocol/client';
import { HttpResponse, http } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ATHLETE_ID } from '../fixtures/intervals.js';
import { callTool, connectClient, TEST_API_KEY } from '../helpers/mcp.js';
import { api, mockApi } from '../helpers/msw.js';

let client: Client;

beforeAll(() => mockApi.listen({ onUnhandledRequest: 'error' }));
afterEach(async () => {
  mockApi.resetHandlers();
  vi.useRealTimers();
  await client?.close();
});
afterAll(() => mockApi.close());

async function call(name: string, args: Record<string, unknown> = {}) {
  client = await connectClient();
  return callTool(client, name, args);
}

describe('get_athlete_profile', () => {
  it('returns a whitelisted profile with readable zones', async () => {
    const { result, json } = await call('get_athlete_profile');
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(json);
    expect(json.athlete).toEqual({
      id: ATHLETE_ID,
      name: 'Test Runner',
      sex: 'F',
      age: expect.any(Number),
      timezone: 'Europe/Warsaw',
      units: 'metric',
      weight_kg: 62.5,
      resting_hr: 52,
    });
    // Private fields must never be exposed.
    expect(JSON.stringify(json)).not.toMatch(/runner@example\.com|1990-06-15/);

    const [run, ride] = json.sports as Array<Record<string, unknown>>;
    expect(run).toMatchObject({ threshold_pace: '4:30 /km', lthr: 170 });
    expect(run?.hr_zones).toContainEqual({ zone: 'Z1', name: 'Recovery', range: '≤140 bpm' });
    expect(run?.hr_zones).toContainEqual({ zone: 'Z2', name: 'Aerobic', range: '141–152 bpm' });
    expect(run?.pace_zones).toContainEqual({
      zone: 'Z1',
      name: 'Z1',
      range: 'slower than 5:48 /km',
    });
    expect(run?.pace_zones).toContainEqual({ zone: 'Z4', name: 'Z4', range: '4:46–4:30 /km' });
    expect(run?.pace_zones).toContainEqual({
      zone: 'Z7',
      name: 'Z5c',
      range: 'faster than 4:02 /km',
    });
    expect(ride?.power_zones).toContainEqual({
      zone: 'Z7',
      name: 'Neuromuscular',
      range: '≥300 W',
    });
  });
});

describe('list_activities', () => {
  it('formats activities with sport-aware pace or speed and totals', async () => {
    let query: URLSearchParams | undefined;
    mockApi.use(
      http.get(api('/athlete/:id/activities'), async ({ request }) => {
        query = new URL(request.url).searchParams;
        const { activities } = await import('../fixtures/intervals.js');
        return HttpResponse.json(activities);
      }),
    );
    const { result, json } = await call('list_activities', {
      oldest: '2026-09-01',
      newest: '2026-09-25',
    });
    expect(result.isError).toBeFalsy();
    expect(query?.get('oldest')).toBe('2026-09-01');
    expect(query?.get('newest')).toBe('2026-09-25T23:59:59');

    const [run, ride] = json.activities as Array<Record<string, unknown>>;
    expect(run).toMatchObject({
      id: 'i2000001',
      distance: '8 km',
      moving_time: '44:00',
      pace: '5:30 /km',
      gap: '5:23 /km',
      avg_hr: 148,
      elevation_gain: '42 m',
    });
    expect(run).not.toHaveProperty('speed');
    expect(ride).toMatchObject({ speed: '24 km/h' });
    expect(ride).not.toHaveProperty('pace');
    expect(json.totals_by_type).toContainEqual({
      type: 'Run',
      activities: 1,
      distance: '8 km',
      moving_time: '44:00',
      training_load: 55,
    });
    expect(json).toMatchObject({ count: 3, truncated: false });
  });

  it('filters by type and reports truncation', async () => {
    const { json } = await call('list_activities', {
      oldest: '2026-09-01',
      newest: '2026-09-25',
      type: 'run',
    });
    expect((json.activities as unknown[]).length).toBe(1);

    const limited = await call('list_activities', {
      oldest: '2026-09-01',
      newest: '2026-09-25',
      limit: 2,
    });
    expect(limited.json).toMatchObject({ count: 2, truncated: true });
  });

  it('defaults to the last 30 days in the athlete time zone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 23:30 UTC on Sep 25 is already Sep 26 in Warsaw.
    vi.setSystemTime(new Date('2026-09-25T23:30:00Z'));
    const { json } = await call('list_activities');
    expect(json.range).toEqual({ oldest: '2026-08-28', newest: '2026-09-26' });
  });

  it('rejects an inverted date range', async () => {
    const { result, text } = await call('list_activities', {
      oldest: '2026-09-25',
      newest: '2026-09-01',
    });
    expect(result.isError).toBe(true);
    expect(text).toContain('must not be after');
  });

  it('explains limited Strava activities', async () => {
    const { stravaStub } = await import('../fixtures/intervals.js');
    mockApi.use(http.get(api('/athlete/:id/activities'), () => HttpResponse.json([stravaStub])));
    const { json } = await call('list_activities', { oldest: '2026-09-01' });
    expect((json.activities as Array<{ note?: string }>)[0]?.note).toMatch(/STRAVA/);
  });
});

describe('get_activity', () => {
  it('returns details with zones, cadence in spm and HR recovery', async () => {
    const { result, json } = await call('get_activity', { id: 'i2000001' });
    expect(result.isError).toBeFalsy();
    const activity = json.activity as Record<string, unknown>;
    expect(activity).toMatchObject({
      description: 'Felt good',
      avg_cadence: 168,
      hr_recovery_bpm: 28,
      fitness_after: 21.3,
      fatigue_after: 30.5,
    });
    expect(activity.time_in_hr_zones).toContainEqual({
      zone: 'Z2',
      name: 'Aerobic',
      range: '141–152 bpm',
      time: '25:00',
      percent: 56.8,
    });
    expect(json).not.toHaveProperty('intervals');
    expect(json).not.toHaveProperty('raw');
  });

  it('optionally includes intervals and raw fields', async () => {
    const { json } = await call('get_activity', {
      id: 'i2000001',
      include_intervals: true,
      include_raw: true,
    });
    expect(json.intervals).toEqual([
      {
        type: 'WORK',
        label: 'Warmup',
        distance: '2 km',
        moving_time: '11:30',
        pace: '5:45 /km',
        avg_hr: 138,
        avg_cadence: 164,
        zone: 1,
      },
      { type: 'RECOVERY', moving_time: '1:00', avg_hr: 120 },
    ]);
    const raw = json.raw as Record<string, unknown>;
    expect(raw.average_cadence).toBe(84);
    expect(raw).not.toHaveProperty('stream_types');
    expect(raw).not.toHaveProperty('tags'); // empty arrays are dropped
  });

  it('returns an actionable error for unknown ids', async () => {
    const { result, text } = await call('get_activity', { id: 'i404' });
    expect(result.isError).toBe(true);
    expect(text).toMatch(/Not found \(HTTP 404\).*Activity not found/);
  });
});

describe('get_fitness_summary', () => {
  it('returns current form, a sorted daily series and own weekly totals', async () => {
    const { result, json } = await call('get_fitness_summary', {
      oldest: '2026-09-22',
      newest: '2026-09-24',
    });
    expect(result.isError).toBeFalsy();
    expect(json.current).toEqual({
      date: '2026-09-24',
      fitness: 21.1,
      fatigue: 29.4,
      form: -8.3,
      form_percent: -39,
      form_zone: 'high risk (overreaching)',
      ramp_rate: 2.8,
    });
    expect((json.daily as Array<{ date: string }>).map((d) => d.date)).toEqual([
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
    ]);
    const weekly = json.weekly as Array<{ by_type: Array<{ type: string }> }>;
    expect(weekly).toHaveLength(1); // followed athlete filtered out
    expect(weekly[0]?.by_type.map((c) => c.type)).toEqual(['Run', 'Ride']); // zero rows dropped
  });

  it('flags form zones as not meaningful when fitness is very low', async () => {
    mockApi.use(
      http.get(api('/athlete/:id/wellness'), () =>
        HttpResponse.json([{ id: '2026-09-24', ctl: 2, atl: 6 }]),
      ),
    );
    const { json } = await call('get_fitness_summary', { oldest: '2026-09-24' });
    expect(json.current).toMatchObject({
      form: -4,
      form_zone: expect.stringMatching(/not meaningful/),
    });
    expect(json.current).not.toHaveProperty('form_percent');
  });
});

describe('API errors', () => {
  it('explains a rejected API key without leaking it', async () => {
    mockApi.use(
      http.get(api('/athlete/:id'), () =>
        HttpResponse.json({ error: `bad key ${TEST_API_KEY}` }, { status: 401 }),
      ),
    );
    const { result, text } = await call('get_athlete_profile');
    expect(result.isError).toBe(true);
    expect(text).toContain('INTERVALS_ICU_API_KEY');
    expect(text).not.toContain(TEST_API_KEY);
  });

  it('recovers after a failed athlete lookup (no cached failure)', async () => {
    mockApi.use(
      http.get(api('/athlete/:id'), () => new HttpResponse(null, { status: 401 }), { once: true }),
    );
    client = await connectClient();
    const first = await callTool(client, 'get_athlete_profile');
    expect(first.result.isError).toBe(true);
    const second = await callTool(client, 'get_athlete_profile');
    expect(second.result.isError).toBeFalsy();
  });
});
