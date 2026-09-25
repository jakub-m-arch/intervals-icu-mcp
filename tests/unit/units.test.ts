import { describe, expect, it } from 'vitest';
import {
  defaultPaceUnits,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  formatSpeed,
  round,
} from '../../src/format/units.js';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [59.6, '1:00'],
    [330, '5:30'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
  ])('%s s → %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('returns undefined for missing or negative values', () => {
    expect(formatDuration(undefined)).toBeUndefined();
    expect(formatDuration(null)).toBeUndefined();
    expect(formatDuration(-1)).toBeUndefined();
  });
});

describe('formatPace', () => {
  it('converts m/s to pace in the configured units', () => {
    expect(formatPace(1000 / 330, 'MINS_KM')).toBe('5:30 /km');
    expect(formatPace(1609.344 / 480, 'MINS_MILE')).toBe('8:00 /mi');
    expect(formatPace(100 / 105, 'SECS_100M')).toBe('1:45 /100m');
  });

  it('is undefined for zero speed or NONE units', () => {
    expect(formatPace(0, 'MINS_KM')).toBeUndefined();
    expect(formatPace(3, 'NONE')).toBeUndefined();
  });
});

describe('distance, speed and elevation', () => {
  it('formats metric and imperial values', () => {
    expect(formatDistance(850, 'metric')).toBe('850 m');
    expect(formatDistance(3910, 'metric')).toBe('3.91 km');
    expect(formatDistance(1609.344 * 2.5, 'imperial')).toBe('2.5 mi');
    expect(formatSpeed(10, 'metric')).toBe('36 km/h');
    expect(formatSpeed(10, 'imperial')).toBe('22.4 mph');
    expect(formatElevation(17.4, 'metric')).toBe('17 m');
    expect(formatElevation(10, 'imperial')).toBe('33 ft');
  });

  it('rounds safely', () => {
    expect(round(2.345, 2)).toBe(2.35);
    expect(round(null)).toBeUndefined();
    expect(round(Number.NaN)).toBeUndefined();
  });
});

describe('defaultPaceUnits', () => {
  it('picks sensible units per sport', () => {
    expect(defaultPaceUnits('Run', 'metric')).toBe('MINS_KM');
    expect(defaultPaceUnits('TrailRun', 'imperial')).toBe('MINS_MILE');
    expect(defaultPaceUnits('Swim', 'metric')).toBe('SECS_100M');
    expect(defaultPaceUnits('Rowing', 'metric')).toBe('SECS_500M');
    expect(defaultPaceUnits('Ride', 'metric')).toBe('NONE');
  });
});
