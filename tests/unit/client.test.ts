import { describe, expect, it, vi } from 'vitest';
import { createIntervalsClient, parseRetryAfterMs, unwrap } from '../../src/api/client.js';
import { IntervalsApiError } from '../../src/api/errors.js';

type Handler = (request: Request) => Response | Promise<Response>;

function setup(handlers: Handler[], options: { timeoutMs?: number } = {}) {
  const requests: Request[] = [];
  const sleeps: number[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    const handler = handlers[Math.min(requests.length - 1, handlers.length - 1)] as Handler;
    return handler(request);
  });
  const client = createIntervalsClient({
    baseUrl: 'https://intervals.test',
    auth: { type: 'apiKey', apiKey: 'secret-key' },
    fetch: fetchMock as unknown as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    ...options,
  });
  return { client, requests, sleeps };
}

const ok = () => Response.json([]);
const status =
  (code: number, headers: Record<string, string> = {}) =>
  () =>
    new Response(null, { status: code, headers });

const listActivities = (client: ReturnType<typeof setup>['client']) =>
  client.GET('/api/v1/athlete/{id}/activities', {
    params: { path: { id: '0' }, query: { oldest: '2026-01-01', fields: ['id', 'name'] } },
  });

describe('createIntervalsClient', () => {
  it('sends basic auth, a user agent and comma-separated arrays', async () => {
    const { client, requests } = setup([ok]);
    await listActivities(client);
    const [request] = requests;
    expect(request?.headers.get('authorization')).toBe(
      `Basic ${Buffer.from('API_KEY:secret-key').toString('base64')}`,
    );
    expect(request?.headers.get('user-agent')).toMatch(/^intervals-icu-mcp\//);
    expect(new URL(request?.url ?? '').search).toBe('?oldest=2026-01-01&fields=id,name');
  });

  it('supports bearer tokens', async () => {
    const requests: Request[] = [];
    const client = createIntervalsClient({
      baseUrl: 'https://intervals.test',
      auth: { type: 'bearer', token: 'tok' },
      fetch: (async (input: string | URL | Request, init?: RequestInit) => {
        requests.push(new Request(input, init));
        return Response.json({});
      }) as typeof fetch,
    });
    await client.GET('/api/v1/athlete/{id}', { params: { path: { id: '0' } } });
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer tok');
  });

  it('retries 429 after Retry-After', async () => {
    const { client, requests, sleeps } = setup([status(429, { 'Retry-After': '2' }), ok]);
    const result = await listActivities(client);
    expect(result.response.status).toBe(200);
    expect(requests).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it('does not wait for very long Retry-After values', async () => {
    const { client, requests } = setup([status(429, { 'Retry-After': '600' })]);
    const result = await listActivities(client);
    expect(requests).toHaveLength(1);
    expect(() => unwrap(result)).toThrow(/rate limit.*600 s/);
  });

  it('retries transient 5xx for idempotent requests with backoff', async () => {
    const { client, requests, sleeps } = setup([status(503), status(502), ok]);
    const result = await listActivities(client);
    expect(result.response.status).toBe(200);
    expect(requests).toHaveLength(3);
    expect(sleeps).toEqual([500, 1000]);
  });

  it('gives up after max retries', async () => {
    const { client, requests } = setup([status(503)]);
    const result = await listActivities(client);
    expect(requests).toHaveLength(3);
    expect(() => unwrap(result)).toThrow(/having problems \(HTTP 503\)/);
  });

  it('never retries non-idempotent requests on 5xx', async () => {
    const { client, requests } = setup([status(503), ok]);
    await client.POST('/api/v1/athlete/{id}/events', {
      params: { path: { id: '0' }, query: { upsertOnUid: false } },
      body: { category: 'NOTE', start_date_local: '2026-09-25T00:00:00' },
    });
    expect(requests).toHaveLength(1);
  });

  it('turns network failures into friendly errors without leaking the key', async () => {
    const { client } = setup([
      () => {
        throw new TypeError('fetch failed for secret-key');
      },
    ]);
    const error = await listActivities(client).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IntervalsApiError);
    expect((error as Error).message).toMatch(/Could not reach Intervals.icu/);
    expect((error as Error).message).not.toContain('secret-key');
  });

  it('reports timeouts', async () => {
    const { client } = setup(
      [
        (request) =>
          new Promise<Response>((_, reject) => {
            request.signal.addEventListener('abort', () => reject(request.signal.reason));
          }),
      ],
      { timeoutMs: 10 },
    );
    const error = await listActivities(client).catch((e: unknown) => e);
    expect((error as Error).message).toMatch(/did not respond within/);
  });
});

describe('parseRetryAfterMs', () => {
  it('parses seconds and HTTP dates', () => {
    expect(parseRetryAfterMs('3')).toBe(3000);
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('garbage')).toBeUndefined();
    const inFuture = new Date(Date.now() + 5000).toUTCString();
    expect(parseRetryAfterMs(inFuture)).toBeGreaterThan(3000);
  });
});
