import type { Client } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { WriteMode } from '../../src/config.js';
import { parseToolsets } from '../../src/config.js';
import { connectClient, testConfig } from '../helpers/mcp.js';

let client: Client | undefined;
afterEach(async () => {
  await client?.close();
});

async function toolsIn(writeMode: WriteMode) {
  client = await connectClient(testConfig({ writeMode }));
  const { tools } = await client.listTools();
  await client.close();
  client = undefined;
  return tools;
}

describe('toolsets', () => {
  it('keeps opt-in toolsets off by default', async () => {
    client = await connectClient(testConfig({ toolsets: parseToolsets('default') }));
    const names = (await client.listTools()).tools.map((t) => t.name);
    for (const optIn of ['api_get', 'update_sport_settings', 'add_activity_comment']) {
      expect(names).not.toContain(optIn);
    }
  });
});

describe('write modes', () => {
  it('read-only exposes no tool that changes data', async () => {
    const tools = await toolsIn('read-only');
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
  });

  it('safe adds create/update tools but never destructive ones', async () => {
    const tools = await toolsIn('safe');
    const names = tools.map((t) => t.name);
    expect(names).toContain('create_events');
    expect(names).toContain('update_wellness');
    expect(tools.some((t) => t.annotations?.destructiveHint)).toBe(false);
    expect(names.some((n) => n.startsWith('delete_'))).toBe(false);
  });

  it('full adds destructive tools, flagged as such', async () => {
    const tools = await toolsIn('full');
    const destructive = tools.filter((t) => t.annotations?.destructiveHint).map((t) => t.name);
    expect(destructive.sort()).toEqual([
      'delete_activity',
      'delete_events',
      'delete_folder',
      'delete_gear',
      'delete_gear_reminder',
      'delete_workout',
    ]);
    for (const tool of tools.filter((t) => t.name.startsWith('delete_'))) {
      expect(tool.description).toMatch(/cannot be undone|Permanently/i);
    }
  });
});
