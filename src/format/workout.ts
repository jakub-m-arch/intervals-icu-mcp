import { compact } from './compact.js';
import { formatDistance, formatDuration, type UnitSystem } from './units.js';

/**
 * Compact summary of the Intervals.icu workout text syntax, embedded in tool descriptions
 * so the model sees it when writing workouts. Every construct here was verified against the
 * live API parser. Full guide: {@link WORKOUT_SYNTAX_GUIDE}.
 */
export const WORKOUT_SYNTAX_SUMMARY = `Workout text syntax (Intervals.icu): one step per line starting with "- ", \
e.g. "- 10m Z2 Pace", "- 1.5km 7:00/km Pace", "- 90s 85% Pace", "- 10m Ramp 60-80% HR", "- 5m Z2 HR". \
Durations: 30s, 90s, 1m30, 10m, 1h. Distances: 400mtr (meters!), 1.5km, 2mi — "400m" means 400 MINUTES. \
Repeats: a line ending in "Nx" (e.g. "Main set 4x") followed by its steps, then a blank line. \
Section lines like "Warmup"/"Cooldown" are labels. Text before the duration labels a step ("- Strides 20s Z5 Pace"). \
Power (rides): "75%" (of FTP), "200w", "150-180w", "Z2". Bpm ranges like "140-150bpm" are NOT supported; use HR zones or % HR.`;

export const WORKOUT_SYNTAX_GUIDE = `# Intervals.icu workout text syntax

Intervals.icu turns plain text into structured workouts that sync to watches (Garmin, Zepp,
Coros, …). Write one step per line starting with \`- \`.

## Steps

\`- [label] <duration or distance> <target>\`

| Part | Examples | Notes |
|---|---|---|
| Duration | \`30s\`, \`90s\`, \`1m30\`, \`10m\`, \`1h\` | \`m\` = minutes |
| Distance | \`400mtr\`, \`1.5km\`, \`2mi\` | Meters are \`mtr\`. \`400m\` means 400 **minutes** |
| Pace zone | \`Z2 Pace\` | Uses the athlete's pace zones (needs threshold pace) |
| Pace | \`7:30/km Pace\`, \`7:30-7:00/km Pace\` | Absolute pace or range |
| % threshold pace | \`85% Pace\` | Percentage of threshold pace |
| HR zone | \`Z2 HR\` | Uses the athlete's HR zones |
| % HR | \`60-70% HR\` | Percentage of max HR |
| Ramp | \`Ramp 60-80% HR\` | Gradually changing target |
| Power | \`75%\`, \`200w\`, \`150-180w\`, \`Z2\` | Rides: % of FTP, watts or power zone |
| Label | \`- Strides 20s Z5 Pace\` | Text before the duration is shown on the device |

Bpm ranges such as \`140-150bpm HR\` are **not** understood. Use HR zones or % HR instead.

## Repeats and sections

A line ending with \`Nx\` starts a repeat block. The steps below it, up to the next blank
line, are repeated N times. Other text lines (e.g. \`Warmup\`, \`Cooldown\`) are section labels.
Inline repeats such as \`- 3x5m Z3\` are **not** supported.

## Example: easy run with strides

\`\`\`
Warmup
- 10m Z1 Pace

Main set
- 25m Z2 Pace

Strides 4x
- 20s Z5 Pace
- 1m Z1 Pace

Cooldown
- 5m Z1 Pace
\`\`\`

## Example: run/walk for beginners

\`\`\`
Warmup
- 5m Z1 HR

Run/walk 6x
- Run 2m Z2 HR
- Walk 2m Z1 HR

Cooldown
- 5m Z1 HR
\`\`\`
`;

type Step = {
  duration?: number;
  distance?: number;
  reps?: number;
  steps?: Step[];
  pace?: unknown;
  hr?: unknown;
  power?: unknown;
  cadence?: unknown;
};

export interface WorkoutCheck {
  parsed_steps: number;
  duration?: string | undefined;
  distance?: string | undefined;
  warnings?: string[] | undefined;
}

/** Longest plausible single step; longer usually means "400m" (minutes) was meant as meters. */
const SUSPICIOUS_STEP_SECONDS = 3 * 3600;

/**
 * Summarises how Intervals.icu parsed a workout's text (the `workout_doc` returned after a
 * create/update) and flags common mistakes, so the model can fix the text.
 */
export function checkWorkout(workoutDoc: unknown, system: UnitSystem): WorkoutCheck {
  const doc = (workoutDoc ?? {}) as { steps?: Step[]; duration?: number; distance?: number };
  const leaves: Step[] = [];
  const walk = (steps: Step[] | undefined) => {
    for (const s of steps ?? []) {
      if (s.steps?.length) walk(s.steps);
      else leaves.push(s);
    }
  };
  walk(doc.steps);

  const warnings: string[] = [];
  if (leaves.length === 0) {
    warnings.push(
      'The workout text was not understood (0 steps). Steps must start with "- " and include ' +
        'a duration or distance, e.g. "- 10m Z2 Pace".',
    );
  }
  const untargeted = leaves.filter((s) => !s.pace && !s.hr && !s.power && !s.cadence).length;
  if (untargeted > 0) {
    warnings.push(
      `${untargeted} step(s) have no intensity target (e.g. "Z2 Pace", "75% Pace", "Z2 HR").`,
    );
  }
  if (leaves.some((s) => (s.duration ?? 0) > SUSPICIOUS_STEP_SECONDS)) {
    warnings.push(
      'A step is longer than 3 hours. Note that "m" means minutes: write meters as "mtr" ' +
        '(e.g. "400mtr").',
    );
  }

  return compact({
    parsed_steps: leaves.length,
    duration: doc.duration ? formatDuration(doc.duration) : undefined,
    distance: doc.distance ? formatDistance(doc.distance, system) : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
}
