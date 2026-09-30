# Everyday use

This guide shows how to use the server as a training companion: checking recovery, reviewing
sessions and planning your week, with workouts synced to your watch. Setup is described in the
[README](../README.md#running-from-source).

## Where to use it

The most convenient clients are **Claude Desktop** and **Claude Code**. Other MCP clients (Cursor,
VS Code, …) work too. Phone and web clients need the remote mode, which is on the roadmap.

**Tip: keep your context in one place.** In Claude Desktop, create a Project (e.g. "Training")
and put your background in the project instructions, so you don't have to repeat it:

> I'm a beginner runner and use run/walk intervals. Goal: run 5 km without walking by December.
> I can train Mon/Wed/Sat, max 45 minutes. Keep most runs easy (zone 2) and increase load
> gradually.

## Daily and weekly routine

| When | What to ask |
|---|---|
| **Morning** | "Should I run today or rest?" (prompt: `recovery-check`) |
| **After a session** (once your watch has synced to Intervals.icu) | "How did today's run go?" (prompt: `analyze-activity`) |
| **After a session** (write mode) | "Log RPE 4 and feel good for today's run". This is saved on the activity and improves load tracking |
| **When something hurts or you slept badly** (write mode) | "Log in wellness: sore calves 3/4" |
| **Sunday** | "Review my week", then "Plan next week" (prompts: `weekly-review`, `plan-next-week`) |
| **Every few weeks** | "How have my personal bests changed? Compare 42 days with the last year" |
| **Before a race** | "Help me prepare for a 5k on 2026-11-15" (prompt: `race-prep`) |

Plain questions are all you need: the assistant picks the right tools itself.

### Prompts

The server also provides **prompts**: ready-made, multi-step analysis templates
(`recovery-check`, `analyze-activity`, `weekly-review`, `plan-next-week`, `race-prep`). They ask
the assistant to use several tools in a well-tested order. How you open them depends on the
client:

| Client | How to use a prompt |
|---|---|
| Claude Desktop | Click **+** in the message box, choose **intervals-icu**, and pick the prompt. Typing `/recovery-check` does not work there, because `/` is for skills, not MCP prompts. |
| Claude Code | Type `/mcp__intervals-icu__recovery-check` (every prompt is available as `/mcp__intervals-icu__<name>`). |
| Other clients | Look for "prompts" or "templates" in the client's MCP menu. |

## Planning workouts that sync to your watch

1. Use the default write mode (`INTERVALS_ICU_WRITE_MODE=safe`), or set it explicitly, and
   restart the client.
2. In Intervals.icu, enable uploading planned workouts to your device. Go to Settings → your
   device integration (Garmin, Zepp, Coros, Wahoo, …) and turn on "upload planned workouts" or
   similar.
3. Ask for a plan, e.g. "Plan 3 run/walk sessions for next week" or the `plan-next-week` prompt. The
   assistant shows the plan and only adds it to your calendar after you agree.
4. Workouts are saved in Intervals.icu's workout text format. The assistant gets back how each
   one was parsed (`workout_check`) and fixes mistakes such as missing targets.
5. Your watch receives the structured workouts and guides you through the intervals.
6. After the week, "Review my week" (or the `weekly-review` prompt) compares what was planned
   with what you actually did.

## Things to know

- **The assistant only sees data that is already in Intervals.icu.** A new session appears
  after your watch syncs.
- **Start with `read-only` if you want to explore safely.** In the default `safe` mode, the
  assistant can create and edit but never delete. Deletions need `full`. See
  [Safety](../README.md#safety).
- **Set your thresholds.** Pace and HR zones depend on your threshold pace, LTHR and max HR
  in Intervals.icu's sport settings. Without a threshold pace, pace-zone workouts
  (`Z2 Pace`) are less meaningful. Use HR zones instead, or set it in Intervals.icu or with
  `update_sport_settings` (opt-in `settings` toolset).
- **Early on, form zones are not meaningful.** With very little training history, fitness
  (CTL) is low and the "form" percentage swings a lot. The server says so instead of showing
  misleading warnings.
- **This is data analysis, not medical advice.** See a professional about pain, injuries or
  unusual symptoms.

## Troubleshooting

| Problem | What to check |
|---|---|
| Tools don't show up in Claude Desktop | Use the absolute path to `node` in the config. Claude Desktop doesn't see Node installed via nvm or similar. Restart the app with Cmd+Q. |
| "Intervals.icu rejected the API key" | Check `INTERVALS_ICU_API_KEY`; create a new key in Settings → Developer Settings |
| Write tools are missing | `INTERVALS_ICU_WRITE_MODE` is `read-only`, or the toolset is not enabled |
| Logs | Claude Desktop: `~/Library/Logs/Claude/mcp-server-intervals-icu.log`. Claude Code: `/mcp` |
