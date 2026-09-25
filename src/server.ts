import { McpServer } from '@modelcontextprotocol/server';
import { createIntervalsClient, type IntervalsClient } from './api/client.js';
import type { Config } from './config.js';
import { registerPrompts } from './prompts/index.js';
import { registerResources } from './resources/index.js';
import { createAthleteLoader } from './tools/athlete-context.js';
import { ALL_TOOLS } from './tools/index.js';
import { type AnyTool, registerTools } from './tools/registry.js';
import { SERVER_NAME, VERSION } from './version.js';

const INSTRUCTIONS = `Tools for reading and planning training data in Intervals.icu \
(activities, fitness/fatigue, wellness, calendar and workout library).
Dates are YYYY-MM-DD in the athlete's local time zone. Paces and distances are already \
converted to the athlete's preferred units.
Tools that change data act on the athlete's real account (planned workouts may sync to their \
watch). Before calling them, show the user what will change and get their agreement; for \
deletions, get explicit confirmation.`;

export interface CreateServerOptions {
  config: Config;
  /** Override the API client (tests). */
  api?: IntervalsClient;
  /** Override the tool list (tests). */
  tools?: readonly AnyTool[];
}

/**
 * Builds a fully configured MCP server instance. Transport-agnostic: the same factory is
 * used for stdio, HTTP and in-memory tests.
 */
export function createServer({ config, api, tools = ALL_TOOLS }: CreateServerOptions): McpServer {
  const client =
    api ??
    createIntervalsClient({
      baseUrl: config.baseUrl,
      auth: { type: 'apiKey', apiKey: config.apiKey },
    });

  const server = new McpServer(
    { name: SERVER_NAME, title: 'Intervals.icu', version: VERSION },
    { instructions: INSTRUCTIONS },
  );

  const context = {
    api: client,
    athleteId: config.athleteId,
    athlete: createAthleteLoader(client, config.athleteId),
  };
  const toolNames = registerTools(server, tools, { config, context });
  registerPrompts(server, new Set(toolNames));
  registerResources(server, context);

  return server;
}
