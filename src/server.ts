import { McpServer } from '@modelcontextprotocol/server';
import { SERVER_NAME, VERSION } from './version.js';

const INSTRUCTIONS = `Tools for reading and planning training data in Intervals.icu \
(activities, fitness/fatigue, wellness, calendar and workout library).`;

/**
 * Builds a fully configured MCP server instance. Transport-agnostic: the same
 * factory is used for stdio, HTTP and in-memory tests.
 */
export function createServer(): McpServer {
  return new McpServer(
    { name: SERVER_NAME, title: 'Intervals.icu', version: VERSION },
    { instructions: INSTRUCTIONS },
  );
}
