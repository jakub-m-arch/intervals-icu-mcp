import type { Client } from '@modelcontextprotocol/client';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { callTool, connectClient } from './mcp.js';
import { mockApi } from './msw.js';

/** Installs msw for the current test file and returns a `call(tool, args)` helper. */
export function useMockApi() {
  let client: Client | undefined;
  beforeAll(() => mockApi.listen({ onUnhandledRequest: 'error' }));
  afterEach(async () => {
    mockApi.resetHandlers();
    vi.useRealTimers();
    await client?.close();
    client = undefined;
  });
  afterAll(() => mockApi.close());

  return async function call(name: string, args: Record<string, unknown> = {}) {
    client ??= await connectClient();
    return callTool(client, name, args);
  };
}
