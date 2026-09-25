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

  it('lists tools with descriptions, annotations and output schemas', async () => {
    client = await connectClient();
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(38);
    for (const tool of tools) {
      expect(tool.description?.length, tool.name).toBeGreaterThan(40);
      expect(tool.annotations?.openWorldHint, tool.name).toBe(true);
      expect(tool.outputSchema, tool.name).toBeDefined();
    }
  });

  it('exposes the profile and workout syntax resources', async () => {
    client = await connectClient();
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual([
      'intervals://athlete/profile',
      'intervals://guides/workout-syntax',
    ]);
    const guide = await client.readResource({ uri: 'intervals://guides/workout-syntax' });
    expect(JSON.stringify(guide.contents)).toContain('400mtr');
  });

  it('registers only tools from enabled toolsets', async () => {
    client = await connectClient(testConfig({ toolsets: parseToolsets('athlete') }));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['get_athlete_profile', 'get_fitness_summary']);
  });

  it('offers prompts only when their tools are enabled', async () => {
    client = await connectClient();
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual([
      'analyze-activity',
      'plan-next-week',
      'race-prep',
      'recovery-check',
      'weekly-review',
    ]);
    const prompt = await client.getPrompt({
      name: 'race-prep',
      arguments: { race_date: '2026-11-01', distance: '10k' },
    });
    expect(JSON.stringify(prompt.messages)).toContain('10k race on 2026-11-01');
    await client.close();

    client = await connectClient(testConfig({ toolsets: parseToolsets('activities') }));
    expect((await client.listPrompts()).prompts).toEqual([]);
  });
});
