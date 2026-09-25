#!/usr/bin/env node
// stdout is reserved for the MCP protocol when running over stdio.
// Diagnostics must go to stderr (console.error), never console.log.
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { ConfigError, loadConfig } from './config.js';
import { createServer } from './server.js';

function main(): void {
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig(process.env, process.argv.slice(2));
  } catch (error) {
    if (error instanceof ConfigError || error instanceof TypeError) {
      // TypeError comes from node:util parseArgs for unknown/invalid flags.
      console.error(`[intervals-icu-mcp] ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  serveStdio(() => createServer({ config }), {
    onerror: (error) => console.error('[intervals-icu-mcp]', error.message),
  });
}

main();
