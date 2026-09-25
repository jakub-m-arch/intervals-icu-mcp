import { type IntervalsClient, unwrap } from '../api/client.js';
import type { components } from '../api/schema.js';
import { defaultPaceUnits, type PaceUnits, type UnitSystem } from '../format/units.js';

export type Athlete = components['schemas']['WithSportSettings'];
export type SportSettings = components['schemas']['SportSettings'];

export interface AthleteContext {
  raw: Athlete;
  timezone: string | undefined;
  unitSystem: UnitSystem;
  /** Sport settings whose `types` include the given activity type. */
  sportSettingsFor(activityType: string): SportSettings | undefined;
  paceUnitsFor(activityType: string): PaceUnits;
}

export function buildAthleteContext(athlete: Athlete): AthleteContext {
  const unitSystem: UnitSystem = athlete.measurement_preference === 'feet' ? 'imperial' : 'metric';
  const sportSettings = athlete.sportSettings ?? [];
  const sportSettingsFor = (type: string) =>
    sportSettings.find((s) => (s.types as readonly string[] | undefined)?.includes(type));

  return {
    raw: athlete,
    timezone: athlete.timezone ?? undefined,
    unitSystem,
    sportSettingsFor,
    paceUnitsFor(type) {
      return (
        (sportSettingsFor(type)?.pace_units as PaceUnits | undefined) ??
        defaultPaceUnits(type, unitSystem)
      );
    },
  };
}

/**
 * Returns a memoised loader for the athlete context, plus a way to invalidate it. A failed
 * load is not cached, so a transient error does not poison the server for the session.
 */
export function createAthleteLoader(api: IntervalsClient, athleteId: string) {
  let pending: Promise<AthleteContext> | undefined;
  const load = (): Promise<AthleteContext> => {
    pending ??= api
      .GET('/api/v1/athlete/{id}', { params: { path: { id: athleteId } } })
      .then((result) => buildAthleteContext(unwrap(result)))
      .catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
    return pending;
  };
  const invalidate = () => {
    pending = undefined;
  };
  return { load, invalidate };
}
