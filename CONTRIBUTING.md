# Contributing

Thanks for your interest in improving this project! Bug reports, feature ideas and
pull requests are all welcome.

## Getting started

```bash
git clone https://github.com/jakub-m-arch/intervals-icu-mcp.git
cd intervals-icu-mcp
nvm use            # Node version from .nvmrc
npm install
npm run check      # lint + typecheck + tests + build
```

To try the server interactively, run `npm run inspect`. This builds the server
and opens it in the [MCP Inspector](https://github.com/modelcontextprotocol/inspector).

For tests against the real API, copy `.env.example` to `.env` and set your own
Intervals.icu API key. **Never commit API keys or real personal training data.**
Test fixtures must be anonymised.

## Project layout

| Path | Purpose |
|---|---|
| `src/index.ts` | CLI entry point (stdio transport) |
| `src/server.ts` | `createServer()`: builds the MCP server (transport-agnostic) |
| `src/config.ts` | Environment and CLI configuration |
| `src/api/` | Typed Intervals.icu client (`schema.d.ts` is generated, do not edit) |
| `src/tools/` | Tool definitions, grouped by toolset, plus the registry |
| `src/format/` | Unit, date and response formatting |
| `openapi/` | Snapshot of the Intervals.icu OpenAPI spec |
| `tests/unit`, `tests/e2e` | Vitest tests (e2e runs a real MCP client against the server with the API mocked by msw) |
| `tests/live` | Opt-in, read-only smoke tests against the real API |

## Adding a tool

1. Define it with `defineTool()` in the matching `src/tools/<toolset>.ts` file. Set
   `access` (`read`, `write` or `destructive`), `operations` (the OpenAPI operationIds it
   uses), and zod `input` and `output` schemas.
2. Add it to `ALL_TOOLS` in `src/tools/index.ts`.
3. Shape the output for a language model: human-readable units, no internal fields, and
   limits on list sizes.
4. Add e2e tests with msw fixtures in `tests/fixtures/`. Fixtures must be synthetic, and
   `satisfies` keeps them in line with the OpenAPI types.

## Updating the API spec

`npm run openapi:update` downloads the latest spec and regenerates `src/api/schema.d.ts`.
`npm run typecheck` then shows what has changed.

## Guidelines

- **stdout is reserved for the MCP protocol.** Use `console.error` for
  diagnostics. Biome rejects `console.log`.
- Keep tools focused and well described. The tool description is what the model
  reads when it decides which tool to call.
- Add or update tests for every behaviour change.
- Run `npm run check` before pushing.

## Commit messages and pull requests

This project uses [Conventional Commits](https://www.conventionalcommits.org/).
Releases and the changelog are generated from commit messages. Examples:

```
feat(activities): add search_activities tool
fix(client): retry on 429 using Retry-After
docs: document INTERVALS_ICU_TOOLSETS
```

Keep pull requests small and focused. Explain *why* the change is needed, not
only what it does.

## Code of Conduct

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
