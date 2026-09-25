import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../../src/server.js';
import { SERVER_NAME, VERSION } from '../../src/version.js';

describe('MCP server', () => {
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
  });

  async function connect(): Promise<Client> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createServer().connect(serverTransport);
    client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    return client;
  }

  it('reports its name and version', async () => {
    const c = await connect();
    expect(c.getServerVersion()).toMatchObject({ name: SERVER_NAME, version: VERSION });
  });

  it('provides usage instructions', async () => {
    const c = await connect();
    expect(c.getInstructions()).toContain('Intervals.icu');
  });
});
