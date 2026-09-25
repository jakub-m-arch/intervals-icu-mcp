# Intervals.icu MCP Server

[![CI](https://github.com/jakub-m-arch/intervals-icu-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jakub-m-arch/intervals-icu-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for
[Intervals.icu](https://intervals.icu). It lets Claude and other MCP-compatible AI
assistants read your training data and help you plan training.

> [!WARNING]
> **Early development.** The first read-only tools work, but the package is not
> published to npm yet. See the [roadmap](#roadmap) below.

> [!NOTE]
> This is an independent open-source project. It is **not affiliated with,
> endorsed by, or sponsored by Intervals.icu**.

## Goals

- **Full API coverage without flooding the model's context.** Tools are
  hand-designed and grouped into toolsets you can switch on or off.
- **Typed from the source.** The API client is generated from the official
  Intervals.icu OpenAPI spec. CI detects when the spec changes.
- **Runner-friendly output.** Pace is shown in min/km or min/mi, together with
  GAP, zones and durations that are easy for humans to read.
- **Safe by default.** Delete operations are only available when you enable
  them explicitly.
- **Works locally and remotely.** stdio for Claude Desktop, Claude Code, Cursor
  and similar clients; later, Streamable HTTP with OAuth for claude.ai on web
  and mobile.

## Tools

47 tools: 42 in the default toolsets, and 5 opt-in via `INTERVALS_ICU_TOOLSETS`
(e.g. `default,raw`). All 149 Intervals.icu API operations are accounted for: 48 have
dedicated tools, 49 more can be read through `api_get`, and 52 are deliberately excluded
with a documented reason. See [docs/coverage.md](docs/coverage.md) and the generated tool
reference in [docs/tools.md](docs/tools.md).

| Toolset | Read | Write (`safe`, default) | Delete (`full` only) |
|---|---|---|---|
| `athlete` | `get_athlete_profile`, `get_fitness_summary` | | |
| `activities` | `list_activities`, `search_activities`, `get_activity`, `list_activity_comments` | `update_activity`, `create_manual_activity` | `delete_activity` |
| `analysis` | `get_activity_streams`, `get_activity_histogram`, `get_activity_best_efforts`, `get_activity_segment_stats`, `search_intervals` | | |
| `curves` | `get_athlete_curves` | | |
| `wellness` | `get_wellness` | `update_wellness` | |
| `calendar` | `list_events`, `get_event` | `create_events`, `update_event`, `mark_event_done`, `duplicate_events`, `apply_plan` | `delete_events` |
| `library` | `list_workout_library`, `get_workout`, `get_training_plan` | `create_folder`, `update_folder`, `create_workouts`, `update_workout`, `duplicate_workouts` | `delete_workout`, `delete_folder` |
| `gear` | `list_gear` | `create_gear`, `update_gear`, `add_gear_reminder`, `update_gear_reminder` | `delete_gear`, `delete_gear_reminder` |
| `settings` (opt-in) | | `update_sport_settings`, `apply_sport_settings` | |
| `chats` (opt-in) | | `add_activity_comment` | |
| `raw` (opt-in) | `list_api_endpoints`, `api_get` (any read endpoint) | | |

**Prompts** (slash commands in most clients): `weekly-review`, `analyze-activity`,
`recovery-check`, `plan-next-week`, `race-prep`.

**Resources:** `intervals://athlete/profile`, `intervals://guides/workout-syntax`.

### Safety

- **Tools outside the write mode are not registered at all.** In the default `safe` mode, the
  assistant can create and edit, but cannot delete. Set `INTERVALS_ICU_WRITE_MODE=read-only`
  to only read, or `full` to also allow deletions.
- **Tools are annotated** as read-only, write or destructive, so MCP clients can ask before
  running them.
- **Planned workouts are checked after saving.** The server reports how Intervals.icu parsed the
  workout text and warns about common mistakes, e.g. `400m` means 400 *minutes*.
- **`create_events` skips duplicates:** entries with the same date, category and name.
- **Delete tools resolve every id first.** If any id is unknown, nothing is deleted.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `INTERVALS_ICU_API_KEY` | yes | – | Intervals.icu → Settings → Developer Settings |
| `INTERVALS_ICU_ATHLETE_ID` | no | `0` | `0` means the owner of the API key |
| `INTERVALS_ICU_TOOLSETS` | no | `default` | Comma-separated toolsets, `default` or `all` |
| `INTERVALS_ICU_WRITE_MODE` | no | `safe` | `read-only`, `safe` (create/update) or `full` (also delete) |

`--athlete-id`, `--toolsets` and `--write-mode` CLI flags override the environment
variables. The API key can only be set through the environment, because command-line
arguments are visible to other processes.

## Running from source

Until the npm package is published, build the server locally:

```bash
git clone https://github.com/jakub-m-arch/intervals-icu-mcp.git
cd intervals-icu-mcp
npm install && npm run build
```

**Claude Code**

```bash
claude mcp add intervals-icu -e INTERVALS_ICU_API_KEY=your-key -- node /absolute/path/to/intervals-icu-mcp/dist/index.mjs
```

**Claude Desktop**: add the following to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "intervals-icu": {
      "command": "node",
      "args": ["/absolute/path/to/intervals-icu-mcp/dist/index.mjs"],
      "env": { "INTERVALS_ICU_API_KEY": "your-key" }
    }
  }
}
```

## Roadmap

| Version | Scope |
|---|---|
| 0.1 | Foundation: typed API client, config, first tools (athlete profile, activities, fitness) |
| 0.2 | Core read tools: activity analysis, curves, wellness, calendar, workout library, gear |
| 0.3 | Safe writes: plan workouts on the calendar, manage the workout library, log wellness |
| 0.4 | Full API coverage via opt-in toolsets, coverage report, weekly spec-drift PRs |
| 1.0 | Stable release: npm, MCP Bundle for Claude Desktop, MCP Registry, Docker image |
| 1.x | Remote mode: Streamable HTTP with Intervals.icu OAuth |

## Development

Requirements: Node.js ≥ 22.12 (see `.nvmrc`).

```bash
npm install
npm run check      # lint + typecheck + tests + build
npm run inspect    # open the server in the MCP Inspector (reads .env)
npm run test:live  # read-only smoke tests against the real API (needs .env)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

[MIT](LICENSE)
