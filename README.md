# Intervals.icu MCP Server

[![CI](https://github.com/jakub-m-arch/intervals-icu-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jakub-m-arch/intervals-icu-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for
[Intervals.icu](https://intervals.icu). It lets Claude and other MCP-compatible AI
assistants read your training data and help you plan training.

> [!WARNING]
> **Pre-1.0.** Tools and output formats may still change between minor versions.
> See the [roadmap](#roadmap) below.

## Quick start

You need an Intervals.icu API key: Settings → Developer Settings → *Generate API key*.

| Client | Install |
|---|---|
| [Claude Desktop](#claude-desktop) | One-click `.mcpb` bundle from the [latest release](https://github.com/jakub-m-arch/intervals-icu-mcp/releases/latest) |
| [Claude Code](#claude-code) | `claude mcp add` |
| [Cursor](#cursor), [VS Code](#vs-code) | JSON config with `npx` |
| Any MCP client | `npx -y @jakub-m-arch/intervals-icu-mcp` (stdio), or the [Docker image](#docker) |

Every client needs Node.js ≥ 22.12 for the `npx` route, except the `.mcpb` bundle (Claude Desktop
ships its own Node) and Docker.

### Claude Desktop

Download `intervals-icu-mcp.mcpb` from the latest release and open it (or drag it into
Settings → Extensions). Claude Desktop asks for your API key and stores it securely; write mode
and toolsets are optional fields with safe defaults.

Prefer a manual config? Open Settings → Developer → Edit Config and add:

```json
{
  "mcpServers": {
    "intervals-icu": {
      "command": "/absolute/path/to/npx",
      "args": ["-y", "@jakub-m-arch/intervals-icu-mcp"],
      "env": { "INTERVALS_ICU_API_KEY": "your-key" }
    }
  }
}
```

Use the absolute path to `npx` (see `which npx`). Claude Desktop does not inherit your shell's
`PATH`, so a plain `"npx"` often fails, especially with nvm. Quit the app (Cmd+Q) and start it
again to load the server.

### Claude Code

```bash
claude mcp add intervals-icu -e INTERVALS_ICU_API_KEY=your-key -- npx -y @jakub-m-arch/intervals-icu-mcp
```

### Cursor

Add to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

```json
{
  "mcpServers": {
    "intervals-icu": {
      "command": "npx",
      "args": ["-y", "@jakub-m-arch/intervals-icu-mcp"],
      "env": { "INTERVALS_ICU_API_KEY": "your-key" }
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json` (or run **MCP: Open User Configuration**). VS Code prompts for the key
once and keeps it out of the file:

```json
{
  "inputs": [
    { "type": "promptString", "id": "intervals-key", "description": "Intervals.icu API key", "password": true }
  ],
  "servers": {
    "intervals-icu": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@jakub-m-arch/intervals-icu-mcp"],
      "env": { "INTERVALS_ICU_API_KEY": "${input:intervals-key}" }
    }
  }
}
```

### Docker

```bash
docker run -i --rm -e INTERVALS_ICU_API_KEY=your-key ghcr.io/jakub-m-arch/intervals-icu-mcp
```

Use it as the `command` (`docker`) with `run -i --rm -e INTERVALS_ICU_API_KEY …` as `args` in any
of the configs above. The image is multi-arch (amd64 and arm64).

> [!TIP]
> Want to look around first without any risk of changes? Set
> `INTERVALS_ICU_WRITE_MODE=read-only` in `env`.

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

**Prompts** (ready-made analysis templates; see [how to use them](docs/usage.md#prompts)): `weekly-review`, `analyze-activity`,
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

To run an unreleased version, build the server locally and point your client at `dist/index.mjs`
instead of `npx`:

```bash
git clone https://github.com/jakub-m-arch/intervals-icu-mcp.git
cd intervals-icu-mcp
npm install && npm run build
claude mcp add intervals-icu -e INTERVALS_ICU_API_KEY=your-key -- node "$PWD/dist/index.mjs"
```

**Try it without an AI client:** `npm run inspect` opens the
[MCP Inspector](https://github.com/modelcontextprotocol/inspector), where you can call each tool
by hand. It reads the API key from `.env`.

## Everyday use

See **[docs/usage.md](docs/usage.md)**. It covers a daily and weekly routine (recovery check,
session analysis, weekly review), planning workouts that sync to your watch, and
troubleshooting.

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
