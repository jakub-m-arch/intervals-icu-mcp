type Present<T> = Exclude<T, null | undefined>;

/** Keys whose value may be null or undefined (and therefore may be dropped). */
type MaybeEmptyKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : null extends T[K] ? K : never;
}[keyof T];

/** `T` with null/undefined-able keys made optional and their empty values removed. */
export type Compacted<T> = {
  [K in Exclude<keyof T, MaybeEmptyKeys<T>>]: T[K];
} & {
  [K in MaybeEmptyKeys<T>]?: Present<T[K]>;
} extends infer O
  ? { [K in keyof O]: O[K] }
  : never;

/** Drops `undefined` and `null` values so tool output and request bodies stay small. */
export function compact<T extends Record<string, unknown>>(obj: T): Compacted<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out as Compacted<T>;
}
