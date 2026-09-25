import type { Client } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import { parseToolsets } from '../../src/config.js';
import { SERVER_NAME, VERSION } from '../../src/version.js';
import { connectClient, testConfig } from '../helpers/mcp.js';

describe('MCP server', () => {
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
  });

  it('reports its name, version and instructions', async () => {
    client = await connectClient();
    expect(client.getServerVersion()).toMatchObject({ name: SERVER_NAME, version: VERSION });
    expect(client.getInstructions()).toContain('Intervals.icu');
  });

  it('lists the phase-1 tools with read-only annotations', async () => {
    client = await connectClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_activity',
      'get_athlete_profile',
      'get_fitness_summary',
      'list_activities',
    ]);
    for (const tool of tools) {
      expect(tool.description?.length).toBeGreaterThan(40);
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it('registers only tools from enabled toolsets', async () => {
    client = await connectClient(testConfig({ toolsets: parseToolsets('athlete') }));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['get_athlete_profile', 'get_fitness_summary']);
  });
});
