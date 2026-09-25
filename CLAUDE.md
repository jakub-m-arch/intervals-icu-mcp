# CLAUDE.md

Guidance for AI coding assistants working in this repository.

## Project

An open-source MCP server for Intervals.icu, written in TypeScript on the official MCP SDK v2
(`@modelcontextprotocol/server`). It is published publicly, so code, docs and commit messages
are in English and should be ready for contributors.

## Commands

- `npm run check`: lint + typecheck + tests + build. Run it before every commit.
- `npm test` / `npm run test:watch`: Vitest.
- `npm run lint:fix`: apply Biome formatting and safe lint fixes.
- `npm run inspect`: build and open the MCP Inspector.

## Architecture rules

- `createServer()` in `src/server.ts` is transport-agnostic. It is used by stdio
  (`src/index.ts`), by the in-memory e2e tests, and later by HTTP. Do not put transport or
  process concerns in it.
- **Never write to stdout** (`console.log`, `process.stdout`). stdout carries the MCP
  protocol over stdio. Use `console.error`. Biome enforces this.
- Tools are hand-designed, not generated 1:1 from OpenAPI. Each tool declares:
  - its toolset,
  - its access level (`read` / `write` / `destructive`),
  - the `operations` (OpenAPI operationIds) it covers, which feed the coverage report.
- Tools outside the configured write mode are not registered at all.
- Return errors from tools as `isError: true` with an actionable message. Never include the
  API key in any log or error text.
- Tool output should be compact and LLM-friendly: human-readable units (pace in min/km,
  durations in h:mm:ss), limits, and explicit truncation notes.

## Conventions

- ESM + TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- Relative imports use the `.js` extension.
- Conventional Commits (`feat(scope): …`, `fix: …`, `chore(deps): …`). release-please
  generates versions and the changelog from them.
- Test fixtures must be anonymised. No real API keys or personal data in the repo.
