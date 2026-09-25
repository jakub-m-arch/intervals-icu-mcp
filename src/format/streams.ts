import { unwrap } from '../api/client.js';
import type { ToolContext } from '../tools/define-tool.js';

export interface Stream {
  type: string;
  data: (number | null)[];
  /** Second series for two-valued streams (e.g. longitude for `latlng`). */
  data2?: (number | null)[];
}

/** Fetches activity streams keyed by type. Missing streams are simply absent. */
export async function fetchStreams(
  ctx: ToolContext,
  activityId: string,
  types: readonly string[],
): Promise<Map<string, Stream>> {
  const data = unwrap(
    await ctx.api.GET('/api/v1/activity/{id}/streams{ext}', {
      params: { path: { id: activityId, ext: '' }, query: { types: [...types] } },
    }),
  );
  const streams = new Map<string, Stream>();
  for (const s of data ?? []) {
    if (!s.type || s.allNull || !Array.isArray(s.data)) continue;
    streams.set(s.type, {
      type: s.type,
      data: s.data as (number | null)[],
      ...(Array.isArray(s.data2) ? { data2: s.data2 as (number | null)[] } : {}),
    });
  }
  return streams;
}

/** First index whose time is >= `seconds` (binary search over a monotonic time stream). */
export function indexAtTime(time: readonly (number | null)[], seconds: number): number {
  let lo = 0;
  let hi = time.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((time[mid] ?? 0) < seconds) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function mean(values: readonly (number | null | undefined)[]): number | undefined {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  return count > 0 ? sum / count : undefined;
}

/**
 * Splits `length` samples into at most `maxBuckets` contiguous [start, end) ranges of
 * near-equal size. Used to downsample streams while averaging within each bucket.
 */
export function bucketRanges(length: number, maxBuckets: number): Array<[number, number]> {
  const buckets = Math.max(1, Math.min(length, maxBuckets));
  const ranges: Array<[number, number]> = [];
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor((b * length) / buckets);
    const end = Math.floor(((b + 1) * length) / buckets);
    if (end > start) ranges.push([start, end]);
  }
  return ranges;
}
