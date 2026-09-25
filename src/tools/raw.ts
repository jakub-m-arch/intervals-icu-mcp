import { z } from 'zod';
import { unwrap } from '../api/client.js';
import { type EndpointInfo, GET_ENDPOINTS } from '../api/endpoints.generated.js';
import { EXCLUDED_OPERATIONS } from './coverage.js';
import { defineTool, type OperationId } from './define-tool.js';

const API_PREFIX = '/api/v1';
/** Upper bound for the JSON returned by api_get, to protect the model's context. */
const MAX_OUTPUT_CHARS = 40_000;

/** Path shown to the model: no /api/v1 prefix and no {ext}/{format} suffix placeholders. */
const displayPath = (path: string) => path.replace(API_PREFIX, '').replace(/\{(ext|format)\}/g, '');

/** GET endpoints available through api_get (binary downloads and excluded ones removed). */
export const RAW_ENDPOINTS: readonly EndpointInfo[] = GET_ENDPOINTS.filter(
  (e) => !(e.operation in EXCLUDED_OPERATIONS),
);

interface Route {
  endpoint: EndpointInfo;
  pattern: RegExp;
  names: string[];
}

const ROUTES: Route[] = RAW_ENDPOINTS.map((endpoint) => {
  const names: string[] = [];
  const source = displayPath(endpoint.path)
    .split('/')
    .map((segment) =>
      segment.replace(/\{([^}]+)\}|[^{}]+/g, (match, name?: string) => {
        if (name) {
          names.push(name);
          return '([^/]+)';
        }
        return match.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      }),
    )
    .join('/');
  return { endpoint, pattern: new RegExp(`^${source}$`), names };
});

/** Resolves a concrete path such as "/activity/i123/weather-summary" to an endpoint. */
export function matchRoute(path: string) {
  const clean = `/${path
    .trim()
    .replace(/^\/+/, '')
    .replace(/^api\/v1\/?/, '')}`
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '');
  // Prefer static segments over placeholders (e.g. /activities/search over /activities/{ids}).
  const candidates = ROUTES.filter((r) => r.pattern.test(clean)).sort(
    (a, b) => a.names.length - b.names.length,
  );
  const route = candidates[0];
  if (!route) return undefined;
  const values = clean.match(route.pattern)?.slice(1) ?? [];
  const params = Object.fromEntries(
    route.names.map((n, i) => [n, decodeURIComponent(values[i] ?? '')]),
  );
  for (const placeholder of route.endpoint.path.match(/\{(ext|format)\}/g) ?? []) {
    params[placeholder.slice(1, -1)] = '';
  }
  return { endpoint: route.endpoint, params };
}

/** Recursively drops null values and empty arrays to keep raw responses compact. */
function prune(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(prune);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0))
        .map(([k, v]) => [k, prune(v)]),
    );
  }
  return value;
}

export const listApiEndpoints = defineTool({
  name: 'list_api_endpoints',
  title: 'List raw API endpoints',
  description:
    'List the Intervals.icu read endpoints available through api_get, for data no other tool ' +
    'provides (e.g. weather forecast, routes, chats, custom items, sport settings details). ' +
    'Optionally filter by a word in the path or summary.',
  toolset: 'raw',
  access: 'read',
  operations: [], // meta tool: reads the bundled endpoint catalog, not the API
  input: z.object({ filter: z.string().optional().describe('e.g. "weather", "route", "chat".') }),
  output: z.object({
    endpoints: z.array(z.object({ path: z.string(), summary: z.string() })),
  }),
  async handler(args) {
    const filter = args.filter?.toLowerCase();
    return {
      endpoints: RAW_ENDPOINTS.filter(
        (e) =>
          !filter ||
          e.path.toLowerCase().includes(filter) ||
          e.summary.toLowerCase().includes(filter),
      ).map((e) => ({ path: displayPath(e.path), summary: e.summary })),
    };
  },
});

export const apiGet = defineTool({
  name: 'api_get',
  title: 'Raw API read',
  description:
    'Call any Intervals.icu read (GET) endpoint and get its raw JSON (nulls removed, large ' +
    'responses truncated). Use only when no dedicated tool fits; see list_api_endpoints. ' +
    'Replace placeholders with real values, e.g. "/athlete/0/weather-forecast" (0 = the ' +
    'athlete) or "/activity/i123456/weather-summary". Values are in raw API units (meters, ' +
    'seconds, m/s).',
  toolset: 'raw',
  access: 'read',
  // Declared dynamically from the endpoint catalog so the coverage report is accurate.
  operations: RAW_ENDPOINTS.map((e) => e.operation) as OperationId[],
  input: z.object({
    path: z.string().min(1).describe('Concrete path, e.g. "/athlete/0/routes".'),
    query: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
      .optional()
      .describe('Query parameters, e.g. {"oldest": "2026-01-01"}.'),
  }),
  output: z.object({
    operation: z.string(),
    truncated: z.boolean(),
    data: z.unknown().optional(),
    data_text: z.string().optional().describe('Truncated JSON when the response was too large'),
  }),
  async handler(args, ctx) {
    const match = matchRoute(args.path);
    if (!match) {
      throw new RangeError(
        `"${args.path}" is not an available read endpoint. Use list_api_endpoints to see them.`,
      );
    }
    const path = { ...match.params };
    // Let "me" stand for the configured athlete.
    for (const key of ['id', 'athleteId']) if (path[key] === 'me') path[key] = ctx.athleteId;

    // biome-ignore lint/suspicious/noExplicitAny: dynamic dispatch over the typed client
    const client = ctx.api as any;
    const data = prune(
      unwrap(await client.GET(match.endpoint.path, { params: { path, query: args.query ?? {} } })),
    );
    const text = JSON.stringify(data) ?? 'null';
    if (text.length <= MAX_OUTPUT_CHARS) {
      return { operation: match.endpoint.operation, truncated: false, data };
    }
    return {
      operation: match.endpoint.operation,
      truncated: true,
      data_text: `${text.slice(0, MAX_OUTPUT_CHARS)}…`,
    };
  },
});
