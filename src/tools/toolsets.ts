/** Every toolset a tool can belong to. Keep in sync with docs/configuration. */
export const TOOLSETS = [
  'athlete',
  'activities',
  'analysis',
  'curves',
  'wellness',
  'calendar',
  'library',
  'gear',
  'settings',
  'custom_items',
  'chats',
  'weather',
  'routes',
  'raw',
] as const;

export type Toolset = (typeof TOOLSETS)[number];

/** Enabled when INTERVALS_ICU_TOOLSETS is unset or contains `default`. */
export const DEFAULT_TOOLSETS: readonly Toolset[] = [
  'athlete',
  'activities',
  'analysis',
  'curves',
  'wellness',
  'calendar',
  'library',
  'gear',
];

export function isToolset(value: string): value is Toolset {
  return (TOOLSETS as readonly string[]).includes(value);
}
