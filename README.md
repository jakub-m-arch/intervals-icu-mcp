# Intervals.icu MCP Server

[![CI](https://github.com/jakub-m-arch/intervals-icu-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jakub-m-arch/intervals-icu-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for
[Intervals.icu](https://intervals.icu). It lets Claude and other MCP-compatible AI
assistants read your training data and help you plan training.

> [!WARNING]
> **Early development.** The server does not expose any tools yet. See the
> [roadmap](#roadmap) below.

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
npm run inspect    # open the server in the MCP Inspector
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

[MIT](LICENSE)
