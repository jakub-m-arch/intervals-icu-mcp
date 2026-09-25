import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import * as fx from '../fixtures/intervals.js';
import { api, mockApi } from '../helpers/msw.js';
import { useMockApi } from '../helpers/setup-msw.js';

const call = useMockApi();

function capture(
  method: 'post' | 'put' | 'delete',
  path: string,
  reply: (body: unknown) => unknown,
) {
  const requests: Array<{ body: unknown; url: URL }> = [];
  mockApi.use(
    http[method](api(path), async ({ request }) => {
      const text = await request.text();
      const body = text ? JSON.parse(text) : undefined;
      requests.push({ body, url: new URL(request.url) });
      return HttpResponse.json(reply(body) as never);
    }),
  );
  return requests;
}

describe('raw toolset', () => {
  it('lists endpoints with an optional filter', async () => {
    const { json } = await call('list_api_endpoints', { filter: 'weather' });
    const paths = (json.endpoints as Array<{ path: string }>).map((e) => e.path);
    expect(paths).toContain('/athlete/{id}/weather-forecast');
    expect(paths.every((p) => p.includes('weather'))).toBe(true);
  });

  it('calls a GET endpoint, prunes nulls and maps "me" to the athlete', async () => {
    let requested = '';
    mockApi.use(
      http.get(api('/athlete/:id/weather-forecast'), ({ request }) => {
        requested = new URL(request.url).pathname;
        return HttpResponse.json({ forecasts: [{ label: 'Home', lat: null, days: [] }] });
      }),
    );
    const { json } = await call('api_get', { path: '/athlete/me/weather-forecast' });
    expect(requested).toBe('/api/v1/athlete/0/weather-forecast');
    expect(json).toEqual({
      operation: 'getForecast',
      truncated: false,
      data: { forecasts: [{ label: 'Home' }] },
    });
  });

  it('truncates very large responses', async () => {
    mockApi.use(
      http.get(api('/athlete/:id/routes'), () =>
        HttpResponse.json(Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `Route ${i}` }))),
      ),
    );
    const { json } = await call('api_get', { path: '/athlete/0/routes' });
    expect(json.truncated).toBe(true);
    expect(String(json.data_text).length).toBeLessThanOrEqual(40_001);
  });

  it('refuses paths that are not available read endpoints', async () => {
    const { result, text } = await call('api_get', { path: '/activity/i1/map' });
    expect(result.isError).toBe(true);
    expect(text).toMatch(/list_api_endpoints/);
  });
});

describe('update_sport_settings', () => {
  it('converts threshold pace to m/s using the sport pace units', async () => {
    const requests = capture('put', '/athlete/:athleteId/sport-settings/:id', (body) => ({
      ...fx.athlete.sportSettings[0],
      ...(body as object),
    }));
    const { json } = await call('update_sport_settings', { sport: 'Run', threshold_pace: '5:00' });
    expect(requests[0]?.url.pathname).toBe('/api/v1/athlete/0/sport-settings/1');
    expect(requests[0]?.url.searchParams.get('recalcHrZones')).toBe('false');
    expect(requests[0]?.body).toEqual({ threshold_pace: 1000 / 300 });
    expect(json.settings).toMatchObject({ threshold_pace: '5:00 /km', lthr: 170 });
  });

  it('rejects unknown sports and pace for non-pace sports', async () => {
    expect((await call('update_sport_settings', { sport: 'Swim', lthr: 150 })).result.isError).toBe(
      true,
    );
    const ride = await call('update_sport_settings', { sport: 'Ride', threshold_pace: '2:00' });
    expect(ride.text).toMatch(/does not use pace/);
  });
});

describe('apply_plan', () => {
  it('only applies PLAN folders', async () => {
    const requests = capture('post', '/athlete/:id/events/apply-plan', () => ({}));
    const folder = await call('apply_plan', { plan_id: 900, start_date: '2026-10-05' });
    expect(folder.text).toMatch(/folder, not a training plan/);
    const { json } = await call('apply_plan', { plan_id: 901, start_date: '2026-10-05' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toEqual({ folder_id: 901, start_date_local: '2026-10-05T00:00:00' });
    expect(json).toEqual({ plan: '5k beginner', start_date: '2026-10-05', workouts: 1 });
  });
});

describe('add_activity_comment', () => {
  it('posts the comment text', async () => {
    const requests = capture('post', '/activity/:id/messages', () => ({ id: 1 }));
    const { json } = await call('add_activity_comment', { id: 'i2000001', text: 'Felt great' });
    expect(requests[0]?.body).toEqual({ content: 'Felt great' });
    expect(json).toEqual({ posted: true, activity_id: 'i2000001' });
  });
});

describe('gear reminders', () => {
  it('resets a reminder and reports reminder ids', async () => {
    const requests = capture('put', '/athlete/:id/gear/:gearId/reminder/:reminderId', () => ({
      ...fx.gear[0],
      reminders: [{ id: 7, name: 'Replace', percent_used: 0 }],
    }));
    const { json } = await call('update_gear_reminder', {
      gear_id: 'g1',
      reminder_id: 7,
      reset: true,
    });
    expect(requests[0]?.url.searchParams.get('reset')).toBe('true');
    expect(requests[0]?.url.searchParams.get('snoozeDays')).toBe('0');
    expect(json.gear).toMatchObject({ reminders: [{ id: 7, name: 'Replace', used_percent: 0 }] });
  });
});
