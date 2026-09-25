import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXCLUDED_OPERATIONS } from '../../src/tools/coverage.js';
import { ALL_TOOLS } from '../../src/tools/index.js';

const spec = JSON.parse(
  readFileSync(new URL('../../openapi/intervals-icu.openapi.json', import.meta.url), 'utf8'),
) as { paths: Record<string, Record<string, { operationId?: string }>> };
const specOperations = new Set(
  Object.values(spec.paths).flatMap((item) => Object.values(item).map((op) => op.operationId)),
);

describe('tool registry invariants', () => {
  it('uses unique snake_case tool names', () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('declares only operations that exist in the OpenAPI spec', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.operations.length, tool.name).toBeGreaterThan(0);
      for (const op of tool.operations) expect(specOperations, `${tool.name}: ${op}`).toContain(op);
    }
  });

  it('never marks a covered operation as excluded', () => {
    const covered = new Set(ALL_TOOLS.flatMap((t) => [...t.operations]));
    for (const op of Object.keys(EXCLUDED_OPERATIONS)) {
      expect(specOperations, op).toContain(op);
      expect(covered.has(op as never), op).toBe(false);
    }
  });
});
