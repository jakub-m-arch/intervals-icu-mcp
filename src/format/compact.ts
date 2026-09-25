type Compacted<T> = { [K in keyof T]: Exclude<T[K], null> };

/** Drops `undefined` and `null` values so tool output stays small. */
export function compact<T extends Record<string, unknown>>(obj: T): Compacted<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out as Compacted<T>;
}
