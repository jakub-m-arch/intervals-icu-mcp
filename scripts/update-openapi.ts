/**
 * Refreshes the Intervals.icu OpenAPI snapshot and regenerates typed API definitions.
 *
 *   npm run openapi:update   # download the latest spec, then regenerate types
 *   npm run openapi:generate # regenerate types from the committed snapshot only
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const SPEC_URL = 'https://intervals.icu/api/v1/docs';
const SPEC_PATH = fileURLToPath(new URL('../openapi/intervals-icu.openapi.json', import.meta.url));
const TYPES_PATH = fileURLToPath(new URL('../src/api/schema.d.ts', import.meta.url));
const ENDPOINTS_PATH = fileURLToPath(new URL('../src/api/endpoints.generated.ts', import.meta.url));

const offline = process.argv.includes('--offline');

async function downloadSpec(): Promise<void> {
  const res = await fetch(SPEC_URL, {
    headers: { 'User-Agent': 'intervals-icu-mcp/openapi-updater' },
  });
  if (!res.ok) throw new Error(`Failed to download spec: HTTP ${res.status}`);
  const spec: unknown = await res.json();
  // Stable, diff-friendly formatting so spec drift shows up clearly in PRs.
  await writeFile(SPEC_PATH, `${JSON.stringify(spec, null, 2)}\n`);
  console.error(`Saved spec to ${SPEC_PATH}`);
}

type Responses = Record<string, unknown>;
type Operation = { operationId?: string; summary?: string; responses?: Responses };
type Spec = { paths: Record<string, Record<string, Operation>> };

/**
 * Some operations only document a `default` response (e.g. getActivity). openapi-fetch
 * treats `default` as an error type, which would make `data` unusable, so we expose it
 * as `200` in the generated types. The committed snapshot stays untouched.
 */
function normalizeDefaultResponses(spec: Spec): void {
  for (const pathItem of Object.values(spec.paths)) {
    for (const op of Object.values(pathItem)) {
      const responses = op.responses;
      if (!responses || Object.keys(responses).some((code) => code.startsWith('2'))) continue;
      if (responses.default) {
        responses['200'] = responses.default;
        delete responses.default;
      }
    }
  }
}

type Parameter = { name: string; in: string; required?: boolean };

/**
 * Known inaccuracies in the published spec. Each patch must be verified against the real
 * API before being added here.
 */
function patchKnownSpecIssues(spec: Spec): void {
  for (const pathItem of Object.values(spec.paths)) {
    for (const op of Object.values(pathItem) as Array<{ parameters?: Parameter[] }>) {
      for (const param of op.parameters ?? []) {
        // The curve comparison filters (f1..f3) are optional; the API works without them.
        if (param.in === 'query' && /^f[123]$/.test(param.name)) param.required = false;
      }
    }
  }
}

async function generateTypes(): Promise<void> {
  const spec: Spec = JSON.parse(await readFile(SPEC_PATH, 'utf8'));
  normalizeDefaultResponses(spec);
  patchKnownSpecIssues(spec);
  // biome-ignore lint/suspicious/noExplicitAny: openapi-typescript accepts a loosely typed document
  const ast = await openapiTS(spec as any, { alphabetize: true });
  const header = `/**
 * GENERATED FILE — DO NOT EDIT.
 * Source: ${SPEC_URL} (snapshot in openapi/intervals-icu.openapi.json)
 * Regenerate with: npm run openapi:generate
 */

`;
  await writeFile(TYPES_PATH, header + astToString(ast));
  console.error(`Generated ${TYPES_PATH}`);
  await generateEndpointCatalog(spec);
}

/** Compact catalog of GET endpoints for the generic `api_get` tool (avoids bundling the spec). */
async function generateEndpointCatalog(spec: Spec): Promise<void> {
  const endpoints = Object.entries(spec.paths)
    .flatMap(([path, item]) =>
      item.get?.operationId
        ? [{ operation: item.get.operationId, path, summary: (item.get.summary ?? '').trim() }]
        : [],
    )
    .sort((a, b) => a.path.localeCompare(b.path));
  const body = `/**
 * GENERATED FILE — DO NOT EDIT. GET endpoints from the OpenAPI snapshot.
 * Regenerate with: npm run openapi:generate
 */

export interface EndpointInfo {
  operation: string;
  path: string;
  summary: string;
}

export const GET_ENDPOINTS: readonly EndpointInfo[] = ${JSON.stringify(endpoints, null, 2)};
`;
  await writeFile(ENDPOINTS_PATH, body);
  console.error(`Generated ${ENDPOINTS_PATH}`);
}

if (!offline) await downloadSpec();
await generateTypes();
