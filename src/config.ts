import { parseArgs } from 'node:util';
import { DEFAULT_TOOLSETS, isToolset, TOOLSETS, type Toolset } from './tools/toolsets.js';

export const WRITE_MODES = ['read-only', 'safe', 'full'] as const;
export type WriteMode = (typeof WRITE_MODES)[number];

export interface Config {
  apiKey: string;
  /** `0` means "the athlete that owns the API key". */
  athleteId: string;
  baseUrl: string;
  toolsets: ReadonlySet<Toolset>;
  writeMode: WriteMode;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const DEFAULT_BASE_URL = 'https://intervals.icu';

/**
 * Resolves configuration from environment variables, with optional CLI flag overrides.
 * The API key is deliberately env-only: command-line arguments are visible to other
 * processes (e.g. `ps`).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, argv: string[] = []): Config {
  const { values: flags } = parseArgs({
    args: argv,
    options: {
      'athlete-id': { type: 'string' },
      toolsets: { type: 'string' },
      'write-mode': { type: 'string' },
    },
    strict: true,
  });

  const apiKey = env.INTERVALS_ICU_API_KEY?.trim();
  if (!apiKey) {
    throw new ConfigError(
      'INTERVALS_ICU_API_KEY is not set. Create an API key in Intervals.icu → Settings → ' +
        'Developer Settings and pass it to the server as an environment variable.',
    );
  }

  const athleteId = (flags['athlete-id'] ?? env.INTERVALS_ICU_ATHLETE_ID)?.trim() || '0';
  if (!/^(0|i?\d+)$/.test(athleteId)) {
    throw new ConfigError(
      `Invalid athlete id "${athleteId}". Use 0 (yourself) or an id like i123456.`,
    );
  }

  const baseUrl = (env.INTERVALS_ICU_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
  if (!URL.canParse(baseUrl)) {
    throw new ConfigError(`Invalid INTERVALS_ICU_BASE_URL "${baseUrl}".`);
  }

  return {
    apiKey,
    athleteId,
    baseUrl,
    toolsets: parseToolsets(flags.toolsets ?? env.INTERVALS_ICU_TOOLSETS),
    writeMode: parseWriteMode(flags['write-mode'] ?? env.INTERVALS_ICU_WRITE_MODE),
  };
}

export function parseToolsets(raw: string | undefined): ReadonlySet<Toolset> {
  const names = (raw ?? 'default')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const result = new Set<Toolset>();
  for (const name of names.length > 0 ? names : ['default']) {
    if (name === 'all') {
      for (const t of TOOLSETS) result.add(t);
    } else if (name === 'default') {
      for (const t of DEFAULT_TOOLSETS) result.add(t);
    } else if (isToolset(name)) {
      result.add(name);
    } else {
      throw new ConfigError(
        `Unknown toolset "${name}". Valid values: default, all, ${TOOLSETS.join(', ')}.`,
      );
    }
  }
  return result;
}

export function parseWriteMode(raw: string | undefined): WriteMode {
  const value = raw?.trim().toLowerCase() || 'safe';
  if ((WRITE_MODES as readonly string[]).includes(value)) return value as WriteMode;
  throw new ConfigError(`Invalid write mode "${value}". Valid values: ${WRITE_MODES.join(', ')}.`);
}
