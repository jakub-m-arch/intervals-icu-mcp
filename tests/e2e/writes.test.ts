import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import * as fx from '../fixtures/intervals.js';
import { api, mockApi } from '../helpers/msw.js';
import { useMockApi } from '../helpers/setup-msw.js';

const call = useMockApi();

/** Records request bodies for a route and replies with `reply(body)`. */
function capture(
  method: 'post' | 'put' | 'delete',
  path: string,
  reply: (body: unknown, url: URL) => unknown,
) {
  const requests: Array<{ body: unknown; url: URL }> = [];
  mockApi.use(
    http[method](api(path), async ({ request }) => {
      const text = await request.text();
      const body = text ? JSON.parse(text) : undefined;
      const url = new URL(request.url);
      requests.push({ body, url });
      return HttpResponse.json(reply(body, url) as never);
    }),
  );
  return requests;
}

const parsedDoc = {
  duration: 1800,
  steps: [{ duration: 1800, pace: { units: 'pace_zone', value: 2 } }],
};

describe('create_events', () => {
  it('maps fields, defaults to WORKOUT and reports how the workout was parsed', async () => {
    const requests = capture('post', '/athlete/:id/events/bulk', (body) =>
      (body as Array<Record<string, unknown>>).map((e, i) => ({
        ...e,
        id: 100 + i,
        workout_doc: e.category === 'WORKOUT' ? parsedDoc : undefined,
      })),
    );
    const { result, json } = await call('create_events', {
      events: [
        {
          date: '2026-10-01',
          type: 'Run',
          name: 'Easy',
          description: '- 30m Z2 Pace',
          time: '7:05',
        },
        {
          date: '2026-10-02',
          category: 'NOTE',
          name: 'Rest day',
          distance_km: 1.5,
          duration: '1:00',
        },
      ],
    });
    expect(result.isError).toBeFalsy();
    expect(requests[0]?.url.searchParams.get('upsertOnUid')).toBe('false');
    expect(requests[0]?.body).toEqual([
      {
        category: 'WORKOUT',
        type: 'Run',
        name: 'Easy',
        description: '- 30m Z2 Pace',
        start_date_local: '2026-10-01T07:05:00',
      },
      {
        category: 'NOTE',
        name: 'Rest day',
        start_date_local: '2026-10-02T00:00:00',
        moving_time: 60,
        distance: 1500,
      },
    ]);
    const created = json.created as Array<Record<string, unknown>>;
    expect(created[0]).toMatchObject({
      id: 100,
      time: '07:05',
      workout_check: { parsed_steps: 1, duration: '30:00' },
    });
    expect(created[1]).not.toHaveProperty('workout_check');
    expect(json.skipped).toEqual([]);
  });

  it('skips entries that already exist unless duplicates are allowed', async () => {
    const requests = capture('post', '/athlete/:id/events/bulk', (body) =>
      (body as unknown[]).map((e, i) => ({ ...(e as object), id: 200 + i })),
    );
    const existing = fx.events[0]; // WORKOUT "Intervals" on 2026-09-27
    const { json } = await call('create_events', {
      events: [
        { date: '2026-09-27', type: 'Run', name: ' intervals ' },
        { date: '2026-09-28', type: 'Run', name: 'Long run' },
      ],
    });
    expect(json.skipped).toEqual([
      {
        date: '2026-09-27',
        name: ' intervals ',
        existing_id: existing?.id,
        reason: expect.stringContaining('already exists'),
      },
    ]);
    expect(requests[0]?.body).toHaveLength(1);

    await call('create_events', {
      events: [{ date: '2026-09-27', type: 'Run', name: 'Intervals' }],
      allow_duplicates: true,
    });
    expect(requests[1]?.body).toHaveLength(1);
  });

  it('surfaces workout parsing problems', async () => {
    capture('post', '/athlete/:id/events/bulk', (body) =>
      (body as unknown[]).map((e) => ({ ...(e as object), id: 1, workout_doc: { steps: [] } })),
    );
    const { json } = await call('create_events', {
      events: [{ date: '2026-10-05', type: 'Run', name: 'Bad', description: 'run fast' }],
    });
    const [event] = json.created as Array<{ workout_check: { warnings: string[] } }>;
    expect(event?.workout_check.warnings[0]).toMatch(/not understood/);
  });

  it('requires a sport for workouts', async () => {
    const { result, text } = await call('create_events', {
      events: [{ date: '2026-10-05', name: 'Something' }],
    });
    expect(result.isError).toBe(true);
    expect(text).toMatch(/"type" \(sport\) is required/);
  });
});

describe('update_event', () => {
  it('keeps the existing time when moving to another date', async () => {
    const requests = capture('put', '/athlete/:id/events/:eventId', (body) => ({
      ...fx.events[1],
      ...(body as object),
    }));
    const { json } = await call('update_event', { id: 10, date: '2026-09-29' });
    expect(requests[0]?.body).toEqual({ start_date_local: '2026-09-29T18:30:00' });
    expect(json.event).toMatchObject({ id: 10, date: '2026-09-29', time: '18:30' });
  });

  it('rejects empty updates', async () => {
    const { result, text } = await call('update_event', { id: 10 });
    expect(result.isError).toBe(true);
    expect(text).toMatch(/Nothing to update/);
  });
});

describe('mark_event_done', () => {
  it('refuses future workouts without calling the API', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-25T10:00:00Z'));
    const requests = capture('post', '/athlete/:id/events/:eventId/mark-done', () => ({}));
    const { result, text } = await call('mark_event_done', { id: 11 });
    expect(result.isError).toBe(true);
    expect(text).toMatch(/planned for 2026-09-27/);
    expect(requests).toHaveLength(0);
  });
});

describe('delete_events', () => {
  it('deletes nothing if any id is unknown', async () => {
    const requests = capture('put', '/athlete/:id/events/bulk-delete', () => ({
      eventsDeleted: 2,
    }));
    const { result } = await call('delete_events', { ids: [10, 999] });
    expect(result.isError).toBe(true);
    expect(requests).toHaveLength(0);
  });

  it('reports what was deleted', async () => {
    const requests = capture('put', '/athlete/:id/events/bulk-delete', () => ({
      eventsDeleted: 2,
    }));
    const { json } = await call('delete_events', { ids: [10, 11] });
    expect(requests[0]?.body).toEqual([{ id: 10 }, { id: 11 }]);
    expect(json).toMatchObject({ deleted: 2, events: [{ name: 'Physio' }, { name: 'Intervals' }] });
  });
});

describe('library writes', () => {
  it('creates workouts in a folder with parse checks', async () => {
    const requests = capture('post', '/athlete/:id/workouts/bulk', (body) =>
      (body as unknown[]).map((w, i) => ({
        ...(w as object),
        id: 700 + i,
        workout_doc: parsedDoc,
      })),
    );
    const { json } = await call('create_workouts', {
      folder_id: 900,
      workouts: [{ name: 'Easy 30', type: 'Run', description: '- 30m Z2 Pace' }],
    });
    expect(requests[0]?.body).toEqual([
      { name: 'Easy 30', type: 'Run', description: '- 30m Z2 Pace', folder_id: 900 },
    ]);
    expect(json.created).toEqual([
      {
        id: 700,
        name: 'Easy 30',
        type: 'Run',
        workout_check: { parsed_steps: 1, duration: '30:00' },
      },
    ]);
  });

  it('refuses to delete an unknown folder', async () => {
    const requests = capture('delete', '/athlete/:id/folders/:folderId', () => ({}));
    const { result } = await call('delete_folder', { id: 12345 });
    expect(result.isError).toBe(true);
    expect(requests).toHaveLength(0);
  });
});

describe('update_wellness', () => {
  it('converts units and only sends the given fields', async () => {
    const requests = capture('put', '/athlete/:id/wellness/:date', (body) => body);
    const { json } = await call('update_wellness', {
      date: '2026-09-25',
      sleep_hours: 7.5,
      soreness: 0,
      comments: '',
    });
    expect(requests[0]?.body).toEqual({
      id: '2026-09-25',
      sleepSecs: 27_000,
      soreness: 0,
      comments: '',
    });
    expect(json.day).toMatchObject({ date: '2026-09-25', sleep: '7h 30m' });
  });
});

describe('activity writes', () => {
  it('maps rpe/feel when updating', async () => {
    const requests = capture('put', '/activity/:id', (body) => ({
      ...fx.runActivity,
      ...(body as object),
    }));
    await call('update_activity', { id: 'i2000001', rpe: 6, feel: 3, name: 'Tempo' });
    expect(requests[0]?.body).toEqual({ name: 'Tempo', icu_rpe: 6, feel: 3 });
  });

  it('rejects manual activities in the future', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-25T10:00:00Z'));
    const requests = capture('post', '/athlete/:id/activities/manual', (body) => body);
    const future = await call('create_manual_activity', {
      date: '2026-09-26',
      type: 'Run',
      name: 'x',
      duration: '30:00',
    });
    expect(future.result.isError).toBe(true);
    expect(requests).toHaveLength(0);

    await call('create_manual_activity', {
      date: '2026-09-25',
      type: 'Run',
      name: 'Treadmill',
      duration: '30:00',
      distance_km: 5,
    });
    expect(requests[0]?.body).toEqual({
      start_date_local: '2026-09-25T12:00:00',
      type: 'Run',
      name: 'Treadmill',
      moving_time: 1800,
      elapsed_time: 1800,
      distance: 5000,
    });
  });
});

describe('gear writes', () => {
  it('stores distances in meters and validates reminders', async () => {
    const requests = capture('post', '/athlete/:id/gear', (body) => ({
      ...(body as object),
      id: 'g9',
    }));
    const { json } = await call('create_gear', {
      type: 'Shoes',
      name: 'New trainers',
      starting_distance_km: 12.5,
    });
    expect(requests[0]?.body).toEqual({ type: 'Shoes', name: 'New trainers', distance: 12_500 });
    expect(json.gear).toEqual({
      id: 'g9',
      name: 'New trainers',
      type: 'Shoes',
      distance: '12.5 km',
    });

    const bad = await call('add_gear_reminder', { gear_id: 'g9', name: 'Replace' });
    expect(bad.result.isError).toBe(true);
  });
});
