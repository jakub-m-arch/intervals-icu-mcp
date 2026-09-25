import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { api, mockApi } from '../helpers/msw.js';
import { useMockApi } from '../helpers/setup-msw.js';

const call = useMockApi();
const RUN = 'i2000001';

describe('search_activities and comments', () => {
  it('searches and formats results', async () => {
    let q: string | null = null;
    mockApi.use(
      http.get(api('/athlete/:id/activities/search'), async ({ request }) => {
        q = new URL(request.url).searchParams.get('q');
        const { runActivity } = await import('../fixtures/intervals.js');
        return HttpResponse.json([runActivity]);
      }),
    );
    const { json } = await call('search_activities', { query: '#race' });
    expect(q).toBe('#race');
    expect(json).toMatchObject({ count: 1, activities: [{ id: RUN, pace: '5:30 /km' }] });
  });

  it('lists comments without deleted ones', async () => {
    const { json } = await call('list_activity_comments', { id: RUN });
    expect(json.comments).toEqual([
      { author: 'Coach', created: '2026-09-22 09:00', text: 'Nice even pacing!' },
    ]);
  });
});

describe('get_activity_streams', () => {
  it('downsamples into an ordered, unit-aware table', async () => {
    const { result, json } = await call('get_activity_streams', { id: RUN, max_points: 10 });
    expect(result.isError).toBeFalsy();
    expect(json).toMatchObject({
      source_points: 600,
      rows_count: 10,
      seconds_per_row: 59.9,
      columns: ['elapsed', 'distance_km', 'pace_per_km', 'heartrate_bpm', 'cadence_spm'],
    });
    const rows = json.rows as unknown[][];
    // Each row averages 60 s; distance is the value at the end of the window.
    expect(rows[0]).toEqual(['0:00', 0.2, '5:00', 150, 170]);
    expect(rows[9]).toEqual(['9:00', 1.43, '11:30', 120, 110]);

    const tooFew = await call('get_activity_streams', { id: RUN, max_points: 2 });
    expect(tooFew.result.isError).toBe(true);
  });

  it('only includes GPS when explicitly requested', async () => {
    const { json } = await call('get_activity_streams', {
      id: RUN,
      types: ['latlng'],
      max_points: 10,
      start: '1:00',
      end: 120,
    });
    expect(json.columns).toEqual(['elapsed', 'lat', 'lng']);
    expect((json.rows as unknown[][])[0]).toEqual(['1:00', 52.1, 21]);
    expect(json.source_points).toBe(61);
  });

  it('rejects an empty window', async () => {
    const { result, text } = await call('get_activity_streams', { id: RUN, start: 300, end: 100 });
    expect(result.isError).toBe(true);
    expect(text).toMatch(/"start" must be before "end"/);
  });
});

describe('get_activity_histogram', () => {
  it('uses the API for heart rate and drops empty buckets', async () => {
    const { json } = await call('get_activity_histogram', { id: RUN, metric: 'hr' });
    expect(json).toEqual({
      metric: 'hr',
      buckets: [
        { range: '115–119 bpm', time: '5:00', percent: 50 },
        { range: '150–154 bpm', time: '5:00', percent: 50 },
      ],
    });
  });

  it('computes pace buckets from the velocity stream', async () => {
    const { json } = await call('get_activity_histogram', {
      id: RUN,
      metric: 'pace',
      bucket_size: 30,
    });
    expect(json.buckets).toEqual([
      { range: '5:00–5:30 /km', time: '5:00', percent: 50.1 },
      { range: '11:30–12:00 /km', time: '4:59', percent: 49.9 },
    ]);
  });
});

describe('get_activity_best_efforts', () => {
  it('reports when efforts happened with formatted averages', async () => {
    const { json } = await call('get_activity_best_efforts', {
      id: RUN,
      metric: 'pace',
      distance_m: 1000,
      count: 2,
    });
    expect(json).toMatchObject({
      target: '1 km',
      efforts: [
        { rank: 1, start: '0:10', end: '5:10', duration: '5:00', average: '5:00 /km' },
        { rank: 2, start: '0:00', end: '5:01', duration: '5:01', average: '5:03 /km' },
      ],
    });
  });

  it('requires a distance or duration', async () => {
    const { result, text } = await call('get_activity_best_efforts', { id: RUN, metric: 'hr' });
    expect(result.isError).toBe(true);
    expect(text).toMatch(/distance_m or duration_s/);
  });
});

describe('get_activity_segment_stats', () => {
  it('maps elapsed times to stream indices', async () => {
    let query: URLSearchParams | undefined;
    mockApi.use(
      http.get(api('/activity/:id/interval-stats'), async ({ request }) => {
        query = new URL(request.url).searchParams;
        const { intervalStats } = await import('../fixtures/intervals.js');
        return HttpResponse.json(intervalStats);
      }),
    );
    const { json } = await call('get_activity_segment_stats', {
      id: RUN,
      start: '0:00',
      end: '5:00',
    });
    expect(query?.get('start_index')).toBe('0');
    expect(query?.get('end_index')).toBe('300');
    expect(json).toMatchObject({
      start: '0:00',
      end: '5:00',
      stats: { distance: '1 km', pace: '5:00 /km', avg_hr: 150, avg_cadence: 170 },
    });
    expect(json.stats).not.toHaveProperty('type');
  });
});

describe('search_intervals', () => {
  it('validates ranges and returns activities', async () => {
    const bad = await call('search_intervals', {
      min_duration_s: 300,
      max_duration_s: 60,
      min_intensity: 90,
      max_intensity: 110,
    });
    expect(bad.result.isError).toBe(true);
    const { json } = await call('search_intervals', {
      min_duration_s: 60,
      max_duration_s: 300,
      min_intensity: 90,
      max_intensity: 110,
    });
    expect(json).toMatchObject({ count: 1, activities: [{ id: RUN }] });
  });
});
