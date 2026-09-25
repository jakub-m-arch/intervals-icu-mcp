#!/usr/bin/env node
// stdout is reserved for the MCP protocol when running over stdio.
// Diagnostics must go to stderr (console.error), never console.log.
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

serveStdio(() => createServer(), {
  onerror: (error) => console.error('[intervals-icu-mcp]', error),
});
