import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { api, mockApi } from '../helpers/msw.js';
import { useMockApi } from '../helpers/setup-msw.js';

const call = useMockApi();

describe('get_athlete_curves', () => {
  it('returns bests at standard distances with critical speed', async () => {
    let query: URLSearchParams | undefined;
    mockApi.use(
      http.get(api('/athlete/:id/pace-curves'), async ({ request }) => {
        query = new URL(request.url).searchParams;
        const { paceCurves } = await import('../fixtures/intervals.js');
        return HttpResponse.json(paceCurves);
      }),
    );
    const { result, json } = await call('get_athlete_curves', {
      metric: 'gap',
      periods: ['42d'],
    });
    expect(result.isError).toBeFalsy();
    expect(query?.get('type')).toBe('Run');
    expect(query?.get('curves')).toBe('42d');
    expect(query?.get('gap')).toBe('true');
    const [curve] = json.curves as Array<Record<string, unknown>>;
    expect(curve).toMatchObject({
      period: '42 days',
      from: '2026-08-15',
      critical_speed_pace: '5:00 /km',
      d_prime_m: 120,
    });
    expect(curve?.points).toEqual([
      {
        distance: '400 m',
        time: '1:40',
        pace: '4:10 /km',
        activity_id: 'i2000001',
        activity: 'Easy run (2026-09-22)',
      },
      expect.objectContaining({ distance: '800 m', time: '3:30' }),
      expect.objectContaining({ distance: '1 km', time: '4:30', pace: '4:30 /km' }),
      expect.objectContaining({ distance: '5 km', time: '25:00', pace: '5:00 /km' }),
    ]);
  });

  it('returns HR bests for durations', async () => {
    const { json } = await call('get_athlete_curves', { metric: 'hr', durations_s: [60, 1200] });
    const [curve] = json.curves as Array<{ points: unknown[] }>;
    expect(curve?.points).toEqual([
      { duration: '1:00', value: '180 bpm', activity_id: 'i2000001' },
      { duration: '20:00', value: '165 bpm', activity_id: 'i2000001' },
    ]);
  });

  it('rejects unsupported period formats', async () => {
    const { result } = await call('get_athlete_curves', { metric: 'hr', periods: ['2026'] });
    expect(result.isError).toBe(true);
  });
});

describe('get_wellness', () => {
  it('returns sorted days with readable sleep and averages', async () => {
    mockApi.use(
      http.get(api('/athlete/:id/wellness'), async () => {
        const { wellnessDays } = await import('../fixtures/intervals.js');
        return HttpResponse.json(wellnessDays);
      }),
    );
    const { json } = await call('get_wellness', { oldest: '2026-09-23', newest: '2026-09-24' });
    expect(json.averages).toEqual({
      resting_hr: 53,
      hrv_rmssd_ms: 65,
      sleep: '7h 30m',
      sleep_score: 85,
    });
    expect(json.days).toEqual([
      { date: '2026-09-23', resting_hr: 51, hrv_rmssd_ms: 70, sleep: '7h 47m', sleep_score: 90 },
      {
        date: '2026-09-24',
        resting_hr: 55,
        hrv_rmssd_ms: 60,
        sleep: '7h 13m',
        sleep_score: 80,
        soreness: 2,
        comments: 'Legs heavy',
      },
    ]);
  });
});

describe('calendar', () => {
  it('lists upcoming events sorted, defaulting to the next 14 days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-25T10:00:00Z'));
    let query: URLSearchParams | undefined;
    mockApi.use(
      http.get(api('/athlete/:id/events'), async ({ request }) => {
        query = new URL(request.url).searchParams;
        const { events } = await import('../fixtures/intervals.js');
        return HttpResponse.json(events);
      }),
    );
    const { json } = await call('list_events', { categories: ['WORKOUT', 'NOTE'] });
    expect(query?.get('oldest')).toBe('2026-09-25');
    expect(query?.get('newest')).toBe('2026-10-08');
    expect(query?.get('category')).toBe('WORKOUT,NOTE');
    const events = json.events as Array<Record<string, unknown>>;
    expect(events.map((e) => e.id)).toEqual([10, 11, 12]);
    expect(events[0]).toEqual({
      id: 10,
      date: '2026-09-26',
      time: '18:30',
      category: 'NOTE',
      name: 'Physio',
    });
    expect(events[1]).toMatchObject({
      category: 'WORKOUT',
      planned_duration: '45:00',
      planned_distance: '7 km',
      planned_load: 60,
      target: 'PACE',
      description: expect.stringContaining('Main set 4x'),
    });
    expect(events[2]).toMatchObject({ date: '2026-10-01', end_date: '2026-10-05' });
  });

  it('can omit descriptions and fetch one event', async () => {
    const list = await call('list_events', { oldest: '2026-09-25', include_descriptions: false });
    expect(JSON.stringify(list.json)).not.toContain('Main set');
    const one = await call('get_event', { id: 11 });
    expect(one.json.event).toMatchObject({ id: 11, name: 'Intervals' });
    const missing = await call('get_event', { id: 99 });
    expect(missing.result.isError).toBe(true);
  });
});

describe('workout library', () => {
  it('lists folders and plans with workouts', async () => {
    const { json } = await call('list_workout_library');
    expect(json.folders).toEqual([
      {
        id: 900,
        name: 'Run workouts',
        kind: 'FOLDER',
        workouts_count: 1,
        workouts: [{ id: 501, name: 'Tempo 3x10', type: 'Run', duration: '50:00', load: 70 }],
      },
      {
        id: 901,
        name: '5k beginner',
        kind: 'PLAN',
        plan_weeks: 8,
        plan_sports: ['Run'],
        hours_per_week: '2–3 h',
        workouts_count: 1,
        workouts: [expect.objectContaining({ id: 502, day: 3 })],
      },
    ]);
    const missing = await call('list_workout_library', { folder_id: 1 });
    expect(missing.result.isError).toBe(true);
  });

  it('gets a workout with its steps and reports no active plan', async () => {
    const { json } = await call('get_workout', { id: 501 });
    expect(json.workout).toMatchObject({ id: 501, folder_id: 900, description: '- 3x10m Z3 Pace' });
    const plan = await call('get_training_plan');
    expect(plan.json).toEqual({ active: false });
  });
});

describe('list_gear', () => {
  it('shows active gear with reminder progress', async () => {
    const { json } = await call('list_gear', { type: 'shoes' });
    expect(json.gear).toEqual([
      {
        id: 'g1',
        name: 'Daily trainers',
        type: 'Shoes',
        distance: '412.5 km',
        time: '38:53:20',
        activities: 52,
        reminders: [{ name: 'Replace', used_percent: 69, distance: '412.5 km / 600 km' }],
      },
    ]);
    const all = await call('list_gear', { include_retired: true });
    expect((all.json.gear as unknown[]).length).toBe(3);
  });
});
