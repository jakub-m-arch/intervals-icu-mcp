import type { CallToolResult, McpServer, ToolAnnotations } from '@modelcontextprotocol/server';
import { IntervalsApiError, redact } from '../api/errors.js';
import type { Config, WriteMode } from '../config.js';
import type { Access, ToolContext, ToolDefinition } from './define-tool.js';

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous list of tools with different schemas
export type AnyTool = ToolDefinition<any, any>;

const ACCESS_BY_MODE: Record<WriteMode, ReadonlySet<Access>> = {
  'read-only': new Set(['read']),
  safe: new Set(['read', 'write']),
  full: new Set(['read', 'write', 'destructive']),
};

export function isToolEnabled(tool: AnyTool, config: Pick<Config, 'toolsets' | 'writeMode'>) {
  return config.toolsets.has(tool.toolset) && ACCESS_BY_MODE[config.writeMode].has(tool.access);
}

export function annotationsFor(tool: AnyTool): ToolAnnotations {
  return {
    title: tool.title,
    readOnlyHint: tool.access === 'read',
    destructiveHint: tool.access === 'destructive',
    idempotentHint: tool.access === 'read' || tool.idempotent === true,
    openWorldHint: true,
  };
}

export interface RegisterOptions {
  config: Pick<Config, 'toolsets' | 'writeMode' | 'apiKey'>;
  context: ToolContext;
}

/** Registers every tool allowed by the configuration. Returns the registered names. */
export function registerTools(
  server: McpServer,
  tools: readonly AnyTool[],
  { config, context }: RegisterOptions,
): string[] {
  const registered: string[] = [];
  for (const tool of tools) {
    if (!isToolEnabled(tool, config)) continue;
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        ...(tool.output ? { outputSchema: tool.output } : {}),
        annotations: annotationsFor(tool),
      },
      async (args: unknown): Promise<CallToolResult> => {
        try {
          const data = await tool.handler(args, context);
          return {
            content: [{ type: 'text', text: JSON.stringify(data) }],
            ...(tool.output ? { structuredContent: data } : {}),
          };
        } catch (error) {
          return {
            isError: true,
            content: [{ type: 'text', text: errorMessage(error, config.apiKey) }],
          };
        }
      },
    );
    registered.push(tool.name);
  }
  return registered;
}

function errorMessage(error: unknown, apiKey: string): string {
  if (error instanceof IntervalsApiError || error instanceof RangeError) {
    return redact(error.message, apiKey);
  }
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error('[intervals-icu-mcp] unexpected tool error:', redact(detail, apiKey));
  const reason = error instanceof Error ? error.message : String(error);
  return redact(`Unexpected error: ${reason}`, apiKey);
}
