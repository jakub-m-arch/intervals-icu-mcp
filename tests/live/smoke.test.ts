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

  it('list_activities + get_activity', async () => {
    const list = await call('list_activities', { oldest: '2026-01-01', limit: 5 });
    const first = (list.activities as Array<{ id: string }>)[0];
    if (first) await call('get_activity', { id: first.id, include_intervals: true });
  });
});
