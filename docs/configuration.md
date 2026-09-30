# Configuration

The server is configured with environment variables. Three of them can be overridden with CLI
flags. The API key is deliberately environment-only: command-line arguments are visible to other
processes (for example in `ps`).

| Variable | Flag | Required | Default | Description |
|---|---|---|---|---|
| `INTERVALS_ICU_API_KEY` | – | yes | – | Intervals.icu → Settings → Developer Settings → API key |
| `INTERVALS_ICU_ATHLETE_ID` | `--athlete-id` | no | `0` | `0` is the owner of the API key. Otherwise an id like `i123456`. |
| `INTERVALS_ICU_WRITE_MODE` | `--write-mode` | no | `safe` | `read-only`, `safe` or `full` (see below) |
| `INTERVALS_ICU_TOOLSETS` | `--toolsets` | no | `default` | Comma-separated toolsets, `default` or `all` |
| `INTERVALS_ICU_BASE_URL` | – | no | `https://intervals.icu` | Only for testing against a mock or another deployment |

Invalid values stop the server at start-up with a message on stderr.

## Write mode

Tools outside the configured mode are **not registered at all**, so the model cannot even see
them.

| Mode | Available tools |
|---|---|
| `read-only` | Read tools only |
| `safe` (default) | Read and write tools: create and edit, no deletes |
| `full` | Everything, including delete tools |

Every tool also carries MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`), so
clients can ask for confirmation before running a tool that changes data.

## Toolsets

Toolsets group tools so you can keep the model's context small. `default` enables the first
eight; the rest are opt-in.

| Toolset | In `default` | Purpose |
|---|---|---|
| `athlete` | yes | Profile and fitness summary |
| `activities` | yes | List, search, view and edit activities |
| `analysis` | yes | Streams, histograms, best efforts, segments, interval search |
| `curves` | yes | Power, pace and heart-rate curves |
| `wellness` | yes | Daily wellness and recovery data |
| `calendar` | yes | Planned workouts and events, applying training plans |
| `library` | yes | Workout library and folders |
| `gear` | yes | Gear and reminders |
| `settings` | no | Change sport settings |
| `chats` | no | Comments on activities |
| `raw` | no | `api_get` for any read endpoint not covered by a dedicated tool |

Examples:

```bash
INTERVALS_ICU_TOOLSETS=default,raw      # defaults plus raw reads
INTERVALS_ICU_TOOLSETS=athlete,activities,wellness
INTERVALS_ICU_TOOLSETS=all
```

The full list of tools, with their toolset and access level, is in [tools.md](tools.md). The
operations that have no dedicated tool are listed in [coverage.md](coverage.md).

## Rate limits and retries

Requests time out after 30 s. `429` responses and transient `502`/`503`/`504` errors are retried
up to twice (honouring `Retry-After` when it is short). Non-idempotent requests (`POST`) are not
retried after a network failure, so nothing is created twice.
