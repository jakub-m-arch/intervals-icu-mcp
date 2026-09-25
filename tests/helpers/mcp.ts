import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { Config } from '../../src/config.js';
import { parseToolsets } from '../../src/config.js';
import { createServer } from '../../src/server.js';

export const TEST_API_KEY = 'test-api-key-0123456789';
export const TEST_BASE_URL = 'https://intervals.test';

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    apiKey: TEST_API_KEY,
    athleteId: '0',
    baseUrl: TEST_BASE_URL,
    toolsets: parseToolsets('all'),
    writeMode: 'full',
    ...overrides,
  };
}

/** Starts the server in memory and returns a connected MCP client. */
export async function connectClient(config: Config = testConfig()): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer({ config }).connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
}

/** Calls a tool and returns its parsed JSON text output plus the raw result. */
export async function callTool(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const first = (result.content as Array<{ type: string; text?: string }>)[0];
  const text = first?.type === 'text' ? (first.text ?? '') : '';
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { result, text, json: json as Record<string, unknown> };
}
