import type { GetPromptResult, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { isoDate } from '../tools/schemas.js';

const userMessage = (text: string): GetPromptResult => ({
  messages: [{ role: 'user', content: { type: 'text', text } }],
});

/** Tools each prompt relies on; a prompt is only offered when all of them are registered. */
const REQUIRED_TOOLS: Record<string, readonly string[]> = {
  'weekly-review': ['list_activities', 'get_activity', 'get_fitness_summary', 'get_wellness'],
  'analyze-activity': [
    'list_activities',
    'get_activity',
    'get_activity_streams',
    'get_activity_histogram',
    'get_athlete_profile',
  ],
  'recovery-check': ['get_wellness', 'get_fitness_summary', 'list_activities', 'list_events'],
  'plan-next-week': [
    'get_athlete_profile',
    'get_fitness_summary',
    'list_activities',
    'list_events',
  ],
  'race-prep': ['get_athlete_curves', 'get_fitness_summary', 'list_events'],
};

/**
 * Prompt templates: reusable starting points that guide the model through a multi-step
 * analysis with the server's tools. Clients usually show them as slash commands.
 * Returns the names of the registered prompts.
 */
export function registerPrompts(server: McpServer, enabledTools: ReadonlySet<string>): string[] {
  const available = (name: string) =>
    (REQUIRED_TOOLS[name] ?? []).every((tool) => enabledTools.has(tool));
  const registered: string[] = [];
  /** Records the prompt as registered when its tools are available. */
  const offer = (name: string) => {
    if (!available(name)) return false;
    registered.push(name);
    return true;
  };

  if (offer('weekly-review'))
    server.registerPrompt(
      'weekly-review',
      {
        title: 'Weekly training review',
        description: 'Review a week of training: volume, intensity, fitness trend and recovery.',
        argsSchema: z.object({
          week_start: isoDate.optional().describe('Monday of the week (default: the last 7 days).'),
        }),
      },
      ({ week_start }) =>
        userMessage(
          `Review my training for ${week_start ? `the week starting ${week_start}` : 'the last 7 days'}.

1. Use list_activities for the week and summarise volume per sport (sessions, time, distance, load).
2. For the key sessions, use get_activity to check time in heart-rate zones and highlight anything notable (pacing, HR drift/decoupling).
3. Use get_fitness_summary to describe how fitness, fatigue and form changed.
4. Use get_wellness to check resting HR, HRV and sleep against the period averages.
5. Finish with 2–3 concrete, prioritised recommendations for next week.

Be concise and use my units. If data is missing, say so instead of guessing.`,
        ),
    );

  if (offer('analyze-activity'))
    server.registerPrompt(
      'analyze-activity',
      {
        title: 'Analyse an activity',
        description: 'Deep-dive into one activity (defaults to the most recent run).',
        argsSchema: z.object({
          activity_id: z.string().optional().describe('Activity id (default: most recent run).'),
        }),
      },
      ({ activity_id }) =>
        userMessage(
          `Analyse ${activity_id ? `activity ${activity_id}` : 'my most recent run (find it with list_activities, type "Run")'}.

1. Use get_activity with include_intervals to get the overview, time in zones and intervals.
2. Use get_activity_streams to look at pacing and heart rate over time: was the pace even, did HR drift, were there walk breaks?
3. Use get_activity_histogram (pace and hr) to see how time was distributed.
4. Compare with my zones from get_athlete_profile: was the intensity right for the session's apparent purpose?
5. Give specific feedback: what went well, what to change next time.`,
        ),
    );

  if (offer('recovery-check'))
    server.registerPrompt(
      'recovery-check',
      {
        title: 'Recovery check',
        description: 'Should I train hard, easy or rest today?',
        argsSchema: z.object({}),
      },
      () =>
        userMessage(
          `Check whether I am recovered enough to train today.

1. Use get_wellness for the last 14 days: compare today's resting HR, HRV and sleep to the 14-day averages.
2. Use get_fitness_summary for the current form (and whether the form zone is meaningful yet).
3. Use list_activities for the last 3 days to see recent load.
4. Use list_events to see what is planned today.

Recommend one of: hard session OK / easy session only / rest, with a short reason. Mention any warning signs (elevated resting HR, suppressed HRV, poor sleep, high fatigue). This is not medical advice.`,
        ),
    );

  if (offer('plan-next-week'))
    server.registerPrompt(
      'plan-next-week',
      {
        title: 'Plan next week',
        description: 'Draft next week of training based on recent load and a goal.',
        argsSchema: z.object({
          goal: z.string().optional().describe('e.g. "run 5 km without walking" or "build base".'),
          days_available: z.string().optional().describe('e.g. "Mon, Wed, Sat" or "3 days".'),
        }),
      },
      ({ goal, days_available }) =>
        userMessage(
          `Draft my training plan for next week.
Goal: ${goal ?? 'general fitness and consistent progress'}.
Days available: ${days_available ?? 'ask me if unclear'}.

1. Use get_athlete_profile for my zones and thresholds.
2. Use get_fitness_summary and list_activities (last 4 weeks) to judge current load; increase weekly load gradually (roughly ≤10% per week, less for beginners).
3. Use list_events to avoid clashing with anything already planned.
4. Propose each session with purpose, duration and intensity (zones or pace), mostly easy with at most 1–2 harder sessions.

Present the plan as a short table. If create_events is available, offer to add the workouts to my calendar (in Intervals.icu workout text format so they sync to my watch), and only add them after I agree.`,
        ),
    );

  if (offer('race-prep'))
    server.registerPrompt(
      'race-prep',
      {
        title: 'Race preparation',
        description: 'Assess readiness for a race and suggest pacing and final preparation.',
        argsSchema: z.object({
          race_date: isoDate.describe('Race date (YYYY-MM-DD).'),
          distance: z.string().describe('e.g. "5k", "10k", "half marathon".'),
          goal_time: z.string().optional().describe('Optional goal time, e.g. "0:55:00".'),
        }),
      },
      ({ race_date, distance, goal_time }) =>
        userMessage(
          `Help me prepare for a ${distance} race on ${race_date}${goal_time ? ` with a goal time of ${goal_time}` : ''}.

1. Use get_athlete_curves (pace, periods ["42d", "1y"]) for recent bests and critical speed; estimate a realistic finish time and compare it with ${goal_time ? 'my goal' : 'what seems achievable'}.
2. Use get_fitness_summary to check current fitness and form; plan a taper so that form is positive on race day.
3. Use list_events to see what is planned before the race.
4. Suggest a pacing strategy (per km or per section) and the key sessions for the remaining time.

Be realistic and explain your reasoning briefly.`,
        ),
    );
  return registered;
}
