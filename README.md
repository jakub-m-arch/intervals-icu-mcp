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

| Tool | What it does |
|---|---|
| `get_athlete_profile` | Profile, units, time zone, and per-sport thresholds and zones (HR, pace, power) |
| `get_fitness_summary` | Fitness (CTL), fatigue (ATL), form (TSB) with the form zone, a daily series and weekly totals |
| `list_activities` | Activities in a date range with pace/GAP, HR and load, plus totals per sport |
| `get_activity` | One activity in detail: time in zones, decoupling, HR recovery and, optionally, intervals |

All tools are currently read-only. Write tools (planning workouts, logging wellness) are
coming in 0.3.

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
| 0.4 | Full API coverage via opt-in toolsets, coverage report, spec-drift detection |
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
