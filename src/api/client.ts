import createClient, { type Client } from 'openapi-fetch';
import { VERSION } from '../version.js';
import { describeHttpError, IntervalsApiError, redact } from './errors.js';
import type { paths } from './schema.js';

export type IntervalsClient = Client<paths>;

export type IntervalsAuth = { type: 'apiKey'; apiKey: string } | { type: 'bearer'; token: string };

export interface IntervalsClientOptions {
  baseUrl: string;
  auth: IntervalsAuth;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Retries for 429 and transient failures (not counting the first attempt). */
  maxRetries?: number;
  /** Longest Retry-After we are willing to wait for inside a single tool call. */
  maxRetryAfterMs?: number;
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
}

const USER_AGENT = `intervals-icu-mcp/${VERSION} (+https://github.com/jakub-m-arch/intervals-icu-mcp)`;
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']);
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createIntervalsClient(options: IntervalsClientOptions): IntervalsClient {
  const authorization =
    options.auth.type === 'apiKey'
      ? `Basic ${Buffer.from(`API_KEY:${options.auth.apiKey}`).toString('base64')}`
      : `Bearer ${options.auth.token}`;
  const secret = options.auth.type === 'apiKey' ? options.auth.apiKey : options.auth.token;

  return createClient<paths>({
    baseUrl: options.baseUrl,
    headers: { Authorization: authorization, 'User-Agent': USER_AGENT, Accept: 'application/json' },
    // Intervals.icu expects comma-separated lists (e.g. fields=a,b).
    querySerializer: { array: { style: 'form', explode: false } },
    fetch: createResilientFetch(options, secret),
  });
}

function createResilientFetch(options: IntervalsClientOptions, secret: string) {
  // Resolved per call so test interceptors (msw) installed later are honoured.
  const baseFetch: typeof fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const sleep = options.sleep ?? defaultSleep;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxRetries = options.maxRetries ?? 2;
  const maxRetryAfterMs = options.maxRetryAfterMs ?? 20_000;

  return async (request: Request): Promise<Response> => {
    const idempotent = IDEMPOTENT_METHODS.has(request.method);

    for (let attempt = 0; ; attempt++) {
      const canRetry = attempt < maxRetries;
      let response: Response;
      try {
        response = await baseFetch(request.clone(), { signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        if (canRetry && idempotent) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new IntervalsApiError(
          redact(networkErrorMessage(error, timeoutMs), secret),
          undefined,
        );
      }

      if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
        if (canRetry && retryAfterMs !== undefined && retryAfterMs <= maxRetryAfterMs) {
          await sleep(retryAfterMs);
          continue;
        }
      } else if (TRANSIENT_STATUSES.has(response.status) && canRetry && idempotent) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return response;
    }
  };
}

function backoffMs(attempt: number): number {
  return 500 * 2 ** attempt;
}

export function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function networkErrorMessage(error: unknown, timeoutMs: number): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return `Intervals.icu did not respond within ${Math.round(timeoutMs / 1000)} s. Try again.`;
  }
  const reason = error instanceof Error ? error.message : String(error);
  return `Could not reach Intervals.icu (${reason}). Check your network connection.`;
}

/**
 * Unwraps an openapi-fetch result: returns the data or throws an {@link IntervalsApiError}
 * with an actionable message.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  const { response } = result;
  if (!response.ok) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    const retryAfterSeconds =
      retryAfterMs === undefined ? undefined : Math.ceil(retryAfterMs / 1000);
    throw new IntervalsApiError(
      describeHttpError(response.status, result.error, retryAfterSeconds),
      response.status,
      retryAfterSeconds,
    );
  }
  return result.data as T;
}
