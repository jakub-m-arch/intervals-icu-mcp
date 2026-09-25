import { describe, expect, it } from 'vitest';
import { matchRoute, RAW_ENDPOINTS } from '../../src/tools/raw.js';

describe('matchRoute', () => {
  it('resolves concrete paths and extracts parameters', () => {
    expect(matchRoute('/activity/i123/weather-summary')).toMatchObject({
      endpoint: { operation: 'getActivityWeatherSummary' },
      params: { id: 'i123' },
    });
    expect(matchRoute('api/v1/athlete/0/gear/g1/calc/')).toMatchObject({
      endpoint: { operation: 'calcDistanceEtc' },
      params: { id: '0', gearId: 'g1' },
    });
  });

  it('fills {ext}/{format} placeholders with the JSON variant', () => {
    expect(matchRoute('/athlete/0/wellness')).toMatchObject({
      endpoint: { operation: 'listWellnessRecords' },
      params: { id: '0', ext: '' },
    });
  });

  it('prefers static segments over placeholders', () => {
    expect(matchRoute('/athlete/0/activities/search')?.endpoint.operation).toBe(
      'searchForActivities',
    );
  });

  it('rejects unknown, write-only and excluded endpoints', () => {
    expect(matchRoute('/nope')).toBeUndefined();
    expect(matchRoute('/activity/i1/map')).toBeUndefined(); // excluded (GPS)
    expect(matchRoute('/activity/i1/fit-file')).toBeUndefined(); // binary
    expect(RAW_ENDPOINTS.some((e) => e.operation === 'getActivityMap')).toBe(false);
  });
});
