import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseToolsets, type WriteMode } from '../../src/config.js';
import { type Access, defineTool } from '../../src/tools/define-tool.js';
import { annotationsFor, isToolEnabled } from '../../src/tools/registry.js';

const tool = (access: Access, toolset: 'activities' | 'chats' = 'activities') =>
  defineTool({
    name: `${access}_tool`,
    title: 'T',
    description: 'test tool',
    toolset,
    access,
    operations: [],
    input: z.object({}),
    handler: async () => ({}),
  });

const enabled = (access: Access, writeMode: WriteMode, toolsets = 'default') =>
  isToolEnabled(tool(access), { writeMode, toolsets: parseToolsets(toolsets) });

describe('isToolEnabled', () => {
  it.each<[WriteMode, Access[]]>([
    ['read-only', ['read']],
    ['safe', ['read', 'write']],
    ['full', ['read', 'write', 'destructive']],
  ])('%s mode allows %j', (mode, allowed) => {
    for (const access of ['read', 'write', 'destructive'] as Access[]) {
      expect(enabled(access, mode)).toBe(allowed.includes(access));
    }
  });

  it('requires the toolset to be enabled', () => {
    const chats = tool('read', 'chats');
    expect(isToolEnabled(chats, { writeMode: 'full', toolsets: parseToolsets('default') })).toBe(
      false,
    );
    expect(isToolEnabled(chats, { writeMode: 'full', toolsets: parseToolsets('chats') })).toBe(
      true,
    );
  });
});

describe('annotationsFor', () => {
  it('derives MCP hints from the access level', () => {
    expect(annotationsFor(tool('read'))).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(annotationsFor(tool('write'))).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    });
    expect(annotationsFor(tool('destructive'))).toMatchObject({ destructiveHint: true });
  });
});
