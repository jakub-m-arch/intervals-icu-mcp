# Architecture

```
src/
├── index.ts          stdio entry point: load config, serveStdio(createServer)
├── server.ts         createServer(): transport-agnostic MCP server factory
├── config.ts         environment and CLI flags → Config
├── api/              typed Intervals.icu client (openapi-fetch) and errors
├── tools/            tool definitions per toolset, registry, coverage exclusions
├── format/           units, dates, activities, streams, workout text
├── prompts/          ready-made analysis prompts
└── resources/        athlete profile and workout syntax guide
```

## Principles

- **`createServer()` knows nothing about transports.** stdio, the in-memory e2e tests and a
  future HTTP transport all use it. Transport and process concerns live in `index.ts`.
- **stdout belongs to the protocol.** Diagnostics go to stderr; Biome rejects `console.log`.
- **Tools are hand-designed, not generated 1:1 from the OpenAPI spec.** One tool can cover
  several operations and shape the output for a language model: human units, no internal fields,
  explicit limits and truncation notes.
- **Gating happens at registration.** A tool outside the configured toolsets or write mode is
  never registered.
- **Errors are results.** Handlers throw; the registry turns errors into `isError: true` results
  with actionable text. API keys are redacted from everything that can reach a log or an error.

## Request flow

1. The client calls a tool. The registry has registered it only if `isToolEnabled()` is true
   (toolset enabled and access level allowed by the write mode).
2. The handler receives validated input (zod) and a `ToolContext`: the API client, the athlete id
   and a lazily loaded, cached athlete context (time zone, unit system, pace units per sport).
3. The handler calls the API client and formats the response with `src/format/`.
4. The registry returns the result as JSON text plus `structuredContent` when the tool declares an
   output schema.

## API client

`src/api/client.ts` wraps openapi-fetch with:

- Basic auth with the API key (`API_KEY:<key>`), or a bearer token for the future remote mode;
- a per-attempt timeout and retries for `429` and transient `5xx` (see
  [configuration.md](configuration.md#rate-limits-and-retries));
- actionable error messages per status (`src/api/errors.ts`).

Types come from `openapi/` (a snapshot of the official spec) through `openapi-typescript`. The
spec has known inaccuracies; patches live in `scripts/update-openapi.ts`.

## Defining a tool

A tool declares its `toolset`, its `access` (`read`, `write` or `destructive`), the OpenAPI
`operations` it covers, and zod `input` and optional `output` schemas (`define-tool.ts`). The
`operations` feed `docs/coverage.md`: `tests/unit/coverage.test.ts` fails if an API operation is
neither covered by a tool, readable through `api_get`, nor excluded with a reason in
`src/tools/coverage.ts`.

## Write safety

- Delete tools resolve every id first and delete nothing if any id is unknown.
- `create_events` skips duplicates (same date, category and name), because Intervals.icu ignores
  client-provided uids.
- Saved workouts are checked: the server reports how Intervals.icu parsed the text, plus warnings for
  common mistakes (for example `400m` means 400 minutes).

## Distribution

The same build (`dist/index.mjs`) ships as an npm package, an `.mcpb` bundle for Claude Desktop
(`mcpb/manifest.json`), a Docker image and a MCP Registry entry (`server.json`).
