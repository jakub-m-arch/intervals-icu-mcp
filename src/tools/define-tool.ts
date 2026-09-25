import type { z } from 'zod';
import type { IntervalsClient } from '../api/client.js';
import type { operations } from '../api/schema.js';
import type { AthleteContext } from './athlete-context.js';
import type { Toolset } from './toolsets.js';

/**
 * - `read`: no side effects.
 * - `write`: creates or updates data (enabled in `safe` and `full` write modes).
 * - `destructive`: deletes or irreversibly changes data (only in `full` mode).
 */
export type Access = 'read' | 'write' | 'destructive';

/** An Intervals.icu OpenAPI operationId. */
export type OperationId = keyof operations;

export interface ToolContext {
  api: IntervalsClient;
  /** Athlete id used in API paths (`0` = the owner of the credentials). */
  athleteId: string;
  /** Lazily loaded, cached athlete settings (time zone, units, sport settings). */
  athlete(): Promise<AthleteContext>;
  /** Drops the cached athlete settings (call after changing them). */
  invalidateAthlete(): void;
}

export interface ToolDefinition<
  I extends z.ZodObject = z.ZodObject,
  O extends z.ZodObject | undefined = z.ZodObject | undefined,
> {
  name: string;
  title: string;
  /** What the model reads when choosing a tool: say when to use it and what it returns. */
  description: string;
  toolset: Toolset;
  access: Access;
  /** Calling the tool repeatedly with the same input has no additional effect. */
  idempotent?: boolean;
  /** OpenAPI operations this tool covers (feeds the API coverage report). */
  operations: readonly OperationId[];
  input: I;
  output?: O;
  handler(
    args: z.infer<I>,
    ctx: ToolContext,
  ): Promise<O extends z.ZodObject ? z.infer<O> : Record<string, unknown>>;
}

/** Identity helper that preserves generic inference for tool definitions. */
export function defineTool<I extends z.ZodObject, O extends z.ZodObject | undefined = undefined>(
  definition: ToolDefinition<I, O>,
): ToolDefinition<I, O> {
  return definition;
}
