import { describe, expect, it } from 'vitest';
import {
  checkWorkout,
  WORKOUT_SYNTAX_GUIDE,
  WORKOUT_SYNTAX_SUMMARY,
} from '../../src/format/workout.js';

describe('checkWorkout', () => {
  it('counts leaf steps inside repeats and formats totals', () => {
    const doc = {
      duration: 2400,
      distance: 6666.7,
      steps: [
        { duration: 600, pace: { units: 'pace_zone', value: 2 } },
        {
          reps: 4,
          steps: [
            { duration: 180, pace: { units: 'pace_zone', value: 4 } },
            { duration: 120, pace: { units: 'pace_zone', value: 1 } },
          ],
        },
        { duration: 600, hr: { units: 'hr_zone', value: 1 } },
      ],
    };
    expect(checkWorkout(doc, 'metric')).toEqual({
      parsed_steps: 4,
      duration: '40:00',
      distance: '6.67 km',
    });
  });

  it('warns when nothing was parsed', () => {
    const check = checkWorkout({ steps: [], duration: 0 }, 'metric');
    expect(check.parsed_steps).toBe(0);
    expect(check.warnings?.[0]).toMatch(/not understood/);
  });

  it('warns about steps without targets and minutes/meters confusion', () => {
    const check = checkWorkout(
      { steps: [{ duration: 300 }, { duration: 24_000, pace: { units: 'pace_zone', value: 4 } }] },
      'metric',
    );
    expect(check.warnings).toEqual([
      expect.stringMatching(/1 step\(s\) have no intensity target/),
      expect.stringMatching(/"400mtr"/),
    ]);
  });

  it('documents the verified pitfalls', () => {
    for (const text of [WORKOUT_SYNTAX_SUMMARY, WORKOUT_SYNTAX_GUIDE]) {
      expect(text).toContain('400mtr');
      expect(text).toMatch(/400m.*MINUTES|400m.*\*\*minutes\*\*/s);
    }
  });
});
