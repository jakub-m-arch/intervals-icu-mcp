import { describe, expect, it } from 'vitest';
import { addDays, isIsoDate, resolveRange, todayIn } from '../../src/format/dates.js';

describe('dates', () => {
  it('computes today in the athlete time zone', () => {
    const now = new Date('2026-09-25T23:30:00Z');
    expect(todayIn('Europe/Warsaw', now)).toBe('2026-09-26');
    expect(todayIn('America/Los_Angeles', now)).toBe('2026-09-25');
    expect(todayIn('Not/AZone', now)).toBe('2026-09-25');
    expect(todayIn(undefined, now)).toBe('2026-09-25');
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-09-25')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('25.09.2026')).toBe(false);
  });

  it('resolves ranges with inclusive defaults', () => {
    expect(resolveRange({}, '2026-09-25', 7)).toEqual({
      oldest: '2026-09-19',
      newest: '2026-09-25',
    });
    expect(resolveRange({ newest: '2026-09-10' }, '2026-09-25', 3)).toEqual({
      oldest: '2026-09-08',
      newest: '2026-09-10',
    });
    expect(() => resolveRange({ oldest: '2026-09-26' }, '2026-09-25', 7)).toThrow(RangeError);
  });
});
