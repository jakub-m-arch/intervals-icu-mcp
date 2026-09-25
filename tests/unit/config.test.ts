import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, parseToolsets } from '../../src/config.js';
import { DEFAULT_TOOLSETS, TOOLSETS } from '../../src/tools/toolsets.js';

const env = (extra: Record<string, string> = {}) => ({ INTERVALS_ICU_API_KEY: ' key ', ...extra });

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(env());
    expect(config).toMatchObject({
      apiKey: 'key',
      athleteId: '0',
      baseUrl: 'https://intervals.icu',
      writeMode: 'safe',
    });
    expect([...config.toolsets]).toEqual(DEFAULT_TOOLSETS);
  });

  it('requires an API key with a helpful message', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/Developer Settings/);
  });

  it('reads env vars and lets CLI flags override them', () => {
    const config = loadConfig(
      env({
        INTERVALS_ICU_ATHLETE_ID: 'i123',
        INTERVALS_ICU_WRITE_MODE: 'read-only',
        INTERVALS_ICU_BASE_URL: 'http://localhost:8080/',
      }),
      ['--write-mode', 'full', '--toolsets', 'activities,wellness'],
    );
    expect(config).toMatchObject({
      athleteId: 'i123',
      writeMode: 'full',
      baseUrl: 'http://localhost:8080',
    });
    expect([...config.toolsets]).toEqual(['activities', 'wellness']);
  });

  it('rejects invalid values', () => {
    expect(() => loadConfig(env({ INTERVALS_ICU_ATHLETE_ID: '../x' }))).toThrow(/athlete id/);
    expect(() => loadConfig(env({ INTERVALS_ICU_WRITE_MODE: 'yolo' }))).toThrow(/write mode/);
    expect(() => loadConfig(env(), ['--api-key', 'x'])).toThrow(TypeError);
  });
});

describe('parseToolsets', () => {
  it('supports default, all and explicit lists', () => {
    expect([...parseToolsets('all')]).toEqual(TOOLSETS);
    expect([...parseToolsets('default, raw')]).toEqual([...DEFAULT_TOOLSETS, 'raw']);
    expect([...parseToolsets(' ')]).toEqual(DEFAULT_TOOLSETS);
    expect(() => parseToolsets('activities,nope')).toThrow(/Unknown toolset "nope"/);
  });
});
