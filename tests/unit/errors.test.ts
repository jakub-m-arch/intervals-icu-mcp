import { describe, expect, it } from 'vitest';
import { describeHttpError, redact } from '../../src/api/errors.js';

describe('describeHttpError', () => {
  it('gives actionable messages per status', () => {
    expect(describeHttpError(401, undefined)).toMatch(/INTERVALS_ICU_API_KEY/);
    expect(describeHttpError(404, { error: 'nope' })).toBe(
      'Not found (HTTP 404). Check that the id or date is correct. Details: nope',
    );
    expect(describeHttpError(429, undefined, 30)).toMatch(/about 30 s/);
    expect(describeHttpError(503, '')).toMatch(/having problems/);
    expect(describeHttpError(422, { message: 'bad date' })).toMatch(/HTTP 422.*bad date/);
  });

  it('truncates long details', () => {
    const message = describeHttpError(400, 'x'.repeat(1000));
    expect(message.length).toBeLessThan(400);
    expect(message.endsWith('…')).toBe(true);
  });
});

describe('redact', () => {
  it('removes every occurrence of the secret', () => {
    expect(redact('a KEY1 b KEY1', 'KEY1')).toBe('a [REDACTED] b [REDACTED]');
    expect(redact('short', 'ab')).toBe('short');
  });
});
