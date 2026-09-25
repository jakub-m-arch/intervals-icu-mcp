/** Pace units as configured per sport in Intervals.icu. */
export type PaceUnits =
  | 'SECS_100M'
  | 'SECS_100Y'
  | 'MINS_KM'
  | 'MINS_MILE'
  | 'SECS_500M'
  | 'SECS_400M'
  | 'SECS_250M'
  | 'NONE';

export type UnitSystem = 'metric' | 'imperial';

const PACE_DISTANCE: Record<Exclude<PaceUnits, 'NONE'>, { meters: number; label: string }> = {
  MINS_KM: { meters: 1000, label: '/km' },
  MINS_MILE: { meters: 1609.344, label: '/mi' },
  SECS_100M: { meters: 100, label: '/100m' },
  SECS_100Y: { meters: 91.44, label: '/100yd' },
  SECS_500M: { meters: 500, label: '/500m' },
  SECS_400M: { meters: 400, label: '/400m' },
  SECS_250M: { meters: 250, label: '/250m' },
};

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

type Num = number | null | undefined;

const isNum = (n: Num): n is number => typeof n === 'number' && Number.isFinite(n);

export function round(value: Num, digits = 0): number | undefined {
  if (!isNum(value)) return undefined;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Seconds → `m:ss` or `h:mm:ss`. */
export function formatDuration(seconds: Num): string | undefined {
  if (!isNum(seconds) || seconds < 0) return undefined;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Speed in m/s → pace such as `5:23 /km`. Returns undefined when not applicable. */
export function formatPace(speedMps: Num, units: PaceUnits): string | undefined {
  const value = formatPaceValue(speedMps, units);
  return value && `${value} ${paceUnitLabel(units)}`;
}

/** Speed in m/s → bare pace such as `5:23` (no unit). */
export function formatPaceValue(speedMps: Num, units: PaceUnits): string | undefined {
  if (!isNum(speedMps) || speedMps <= 0 || units === 'NONE') return undefined;
  return formatDuration(PACE_DISTANCE[units].meters / speedMps);
}

export function paceUnitLabel(units: PaceUnits): string {
  return units === 'NONE' ? '' : PACE_DISTANCE[units].label;
}

/** Speed in m/s → `25.3 km/h` or `15.7 mph`. */
export function formatSpeed(speedMps: Num, system: UnitSystem): string | undefined {
  if (!isNum(speedMps) || speedMps < 0) return undefined;
  return system === 'imperial'
    ? `${round((speedMps * 3600) / METERS_PER_MILE, 1)} mph`
    : `${round(speedMps * 3.6, 1)} km/h`;
}

/** Meters → `850 m` / `3.91 km` (metric) or `2.43 mi` (imperial). */
export function formatDistance(meters: Num, system: UnitSystem): string | undefined {
  if (!isNum(meters) || meters < 0) return undefined;
  if (system === 'imperial') return `${round(meters / METERS_PER_MILE, 2)} mi`;
  return meters < 1000 ? `${round(meters)} m` : `${round(meters / 1000, 2)} km`;
}

/** Meters of elevation → `17 m` or `57 ft`. */
export function formatElevation(meters: Num, system: UnitSystem): string | undefined {
  if (!isNum(meters)) return undefined;
  return system === 'imperial' ? `${round(meters * FEET_PER_METER)} ft` : `${round(meters)} m`;
}

/** Sensible pace units for an activity type when the athlete has no sport settings for it. */
export function defaultPaceUnits(activityType: string, system: UnitSystem): PaceUnits {
  if (/Swim/i.test(activityType)) return system === 'imperial' ? 'SECS_100Y' : 'SECS_100M';
  if (/Run|Walk|Hike|Snowshoe/i.test(activityType)) {
    return system === 'imperial' ? 'MINS_MILE' : 'MINS_KM';
  }
  if (/Row/i.test(activityType)) return 'SECS_500M';
  return 'NONE';
}
