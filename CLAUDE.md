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
- `npm run inspect`: build and open the MCP Inspector (loads `.env`).
- `npm run test:live`: read-only smoke tests against the real API (needs `.env`). Set
  `LIVE_OUTPUT=/tmp/out.txt` to capture the raw tool outputs.
- `npm run docs:generate`: regenerate `docs/tools.md` and `docs/coverage.md` after changing
  tools (CI checks this).
- `npm run openapi:update` / `openapi:generate`: refresh the spec snapshot / regenerate
  `src/api/schema.d.ts`. Never edit the generated file by hand.

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
- Domain gotchas:
  - Speeds from the API are in m/s.
  - Pace units are set per sport (`pace_units`).
  - Running cadence is stored per leg, so double it to get spm.
  - Pace zones are % of threshold *speed*, so higher % means a faster pace.
  - Form-% zones are meaningless at very low CTL.
  - `athlete-summary` also returns followed athletes.
- The spec is not always accurate. Verify shapes against the live API (`npm run test:live`)
  before trusting them. Known gaps so far:
  - Histogram buckets are `{min, max, secs}`.
  - Stream `data` is an array.
  - `getActivity` only documents a `default` response.
  - Curve params `f1`–`f3` are marked as required but are optional.

  Patches to the spec itself belong in `scripts/update-openapi.ts`; other mismatches are
  typed locally with a comment.
- Write behaviour verified live (see `tests/live/write.test.ts`, run with `LIVE_WRITE=1`):
  - `PUT` merges the given fields. `null` is ignored, so fields cannot be cleared with it.
    Wellness ratings clear with 0 and comments with `""`; measurements cannot be cleared.
  - Client-provided event `uid`s are ignored, so `upsertOnUid` cannot deduplicate.
    `create_events` checks for duplicates itself.
  - Manual activities and `mark-done` fail with 422 for future dates.
  - Workout text is parsed server-side into `workout_doc`. Unparseable text is still
    accepted, with 0 steps.
  - `400m` means minutes (meters are `400mtr`), bpm ranges are not parsed, and inline
    `3x5m` repeats are not supported.
- Live write tests only create objects named `[mcp-test] …` on far-future dates, or on
  2020-01-01 for activities, and sweep them afterwards. Never write to real dates of the
  user's account in tests.

## Conventions

- ESM + TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- Relative imports use the `.js` extension.
- Conventional Commits (`feat(scope): …`, `fix: …`, `chore(deps): …`). release-please
  generates versions and the changelog from them.
- Test fixtures must be anonymised. No real API keys or personal data in the repo.
