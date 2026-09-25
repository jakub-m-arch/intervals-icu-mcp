/**
 * Write-tool round trips against the REAL Intervals.icu account. Opt-in only:
 *
 *   LIVE_WRITE=1 npm run test:live
 *
 * Every object is named "[mcp-test] …" and dated in Dec 2027 (calendar, library, gear) or on
 * 2020-01-01 (manual activities, which cannot be in the future), and is deleted again.
 * Wellness is not tested live because measurements cannot be cleared through the API.
 */
import type { Client } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createIntervalsClient, unwrap } from '../../src/api/client.js';
import { loadConfig } from '../../src/config.js';
import { callTool, connectClient } from '../helpers/mcp.js';

const enabled = Boolean(process.env.INTERVALS_ICU_API_KEY) && process.env.LIVE_WRITE === '1';
const PREFIX = '[mcp-test]';

describe.skipIf(!enabled)('live write tools (creates and deletes test data)', () => {
  let client: Client;
  const config = enabled ? { ...loadConfig(), writeMode: 'full' as const } : undefined;

  beforeAll(async () => {
    client = await connectClient(config);
  });

  afterAll(async () => {
    await client?.close();
    if (config) await sweepTestData(config.baseUrl, config.apiKey);
  });

  async function call(name: string, args: Record<string, unknown>) {
    const { result, text, json } = await callTool(client, name, args);
    expect(result.isError, `${name}: ${text}`).toBeFalsy();
    return json;
  }

  it('calendar: create, update, duplicate, delete', async () => {
    const created = await call('create_events', {
      events: [
        {
          date: '2027-12-06',
          type: 'Run',
          name: `${PREFIX} easy`,
          description: 'Warmup\n- 10m Z1 HR\n\nMain set 3x\n- 1km Z3 HR\n- 90s Z1 HR',
        },
      ],
    });
    const [event] = created.created as Array<{
      id: number;
      workout_check: { parsed_steps: number };
    }>;
    expect(event?.workout_check.parsed_steps).toBe(3);

    const again = await call('create_events', {
      events: [{ date: '2027-12-06', type: 'Run', name: `${PREFIX} easy` }],
    });
    expect(again.skipped).toHaveLength(1);

    const updated = await call('update_event', {
      id: event?.id,
      time: '07:30',
      name: `${PREFIX} easy v2`,
    });
    expect(updated.event).toMatchObject({ date: '2027-12-06', time: '07:30' });

    const copies = await call('duplicate_events', { ids: [event?.id], copies: 1 });
    const copyIds = (copies.created as Array<{ id: number; date: string }>).map((e) => e.id);
    expect((copies.created as Array<{ date: string }>)[0]?.date).toBe('2027-12-13');

    const deleted = await call('delete_events', { ids: [event?.id, ...copyIds] });
    expect(deleted.deleted).toBe(2);
  });

  it('library: folder and workouts', async () => {
    const folder = await call('create_folder', { name: `${PREFIX} folder` });
    const folderId = (folder.folder as { id: number }).id;
    const created = await call('create_workouts', {
      folder_id: folderId,
      workouts: [
        { name: `${PREFIX} tempo`, type: 'Run', description: '- 20m Z3 HR' },
        { name: `${PREFIX} bad`, type: 'Run', description: '- 400m Z2 HR' },
      ],
    });
    const [tempo, bad] = created.created as Array<{
      id: number;
      workout_check: { parsed_steps: number; warnings?: string[] };
    }>;
    expect(tempo?.workout_check.parsed_steps).toBe(1);
    expect(bad?.workout_check.warnings?.join(' ')).toMatch(/400mtr/);

    await call('update_workout', { id: tempo?.id, name: `${PREFIX} tempo v2` });
    await call('delete_workout', { id: bad?.id });
    const deleted = await call('delete_folder', { id: folderId });
    expect((deleted.deleted as { workouts_count: number }).workouts_count).toBe(1);
  });

  it('gear: create, reminder, retire, delete', async () => {
    const created = await call('create_gear', {
      type: 'Shoes',
      name: `${PREFIX} shoes`,
      starting_distance_km: 100,
    });
    const gear = created.gear as { id: string; distance: string };
    expect(gear.distance).toBe('100 km');
    const withReminder = await call('add_gear_reminder', {
      gear_id: gear.id,
      name: 'Replace',
      distance_km: 600,
    });
    expect((withReminder.gear as { reminders: unknown[] }).reminders).toHaveLength(1);
    const retired = await call('update_gear', { id: gear.id, retired: '2027-12-31' });
    expect((retired.gear as { retired: string }).retired).toBe('2027-12-31');
    await call('delete_gear', { id: gear.id });
  });

  it('activities: manual, update, mark done, delete', async () => {
    const manual = await call('create_manual_activity', {
      date: '2020-01-01',
      time: '07:00',
      type: 'Run',
      name: `${PREFIX} manual`,
      duration: '30:00',
      distance_km: 5,
    });
    const activity = manual.activity as { id: string; pace: string };
    expect(activity.pace).toBe('6:00 /km');
    const updated = await call('update_activity', { id: activity.id, rpe: 4, feel: 2 });
    expect(updated.activity).toMatchObject({ rpe: 4, feel: 2 });

    const planned = await call('create_events', {
      events: [
        { date: '2020-01-02', type: 'Run', name: `${PREFIX} planned`, description: '- 30m Z2 HR' },
      ],
    });
    const eventId = (planned.created as Array<{ id: number }>)[0]?.id;
    const done = await call('mark_event_done', { id: eventId });
    await call('delete_activity', { id: (done.activity as { id: string }).id });
    await call('delete_events', { ids: [eventId] });
    await call('delete_activity', { id: activity.id });
  });
});

/** Removes anything named "[mcp-test]" left behind by a failed run. */
async function sweepTestData(baseUrl: string, apiKey: string) {
  const api = createIntervalsClient({ baseUrl, auth: { type: 'apiKey', apiKey } });
  const id = '0';
  const isTest = (name: string | null | undefined) => Boolean(name?.startsWith(PREFIX));

  for (const [oldest, newest] of [
    ['2019-12-25', '2020-01-10'],
    ['2027-12-01', '2028-01-31'],
  ] as const) {
    const events = unwrap(
      await api.GET('/api/v1/athlete/{id}/events{format}', {
        params: { path: { id, format: '' }, query: { oldest, newest } },
      }),
    );
    const doomed = (events ?? [])
      .filter((e) => isTest(e.name))
      .map((e) => ({ id: e.id as number }));
    if (doomed.length) {
      await api.PUT('/api/v1/athlete/{id}/events/bulk-delete', {
        params: { path: { id } },
        body: doomed,
      });
    }
    const activities = unwrap(
      await api.GET('/api/v1/athlete/{id}/activities', {
        params: { path: { id }, query: { oldest, newest: `${newest}T23:59:59` } },
      }),
    );
    for (const a of (activities ?? []).filter((x) => isTest(x.name))) {
      await api.DELETE('/api/v1/activity/{id}', { params: { path: { id: String(a.id) } } });
    }
  }
  const folders = unwrap(
    await api.GET('/api/v1/athlete/{id}/folders', { params: { path: { id } } }),
  );
  for (const f of (folders ?? []).filter((x) => isTest(x.name))) {
    await api.DELETE('/api/v1/athlete/{id}/folders/{folderId}', {
      params: { path: { id, folderId: f.id as number } },
    });
  }
  const gear = unwrap(
    await api.GET('/api/v1/athlete/{id}/gear{ext}', { params: { path: { id, ext: '' } } }),
  );
  for (const g of (gear ?? []).filter((x) => isTest(x.name))) {
    await api.DELETE('/api/v1/athlete/{id}/gear/{gearId}', {
      params: { path: { id, gearId: String(g.id) } },
    });
  }
}
