/**
 * Synthetic Intervals.icu API responses. Shapes mirror real responses; all values are
 * made up. `satisfies` keeps fixtures honest against the generated OpenAPI types.
 */
import type { components } from '../../src/api/schema.js';

type S = components['schemas'];

export const ATHLETE_ID = 'i1000001';

const hrZoneNames = [
  'Recovery',
  'Aerobic',
  'Tempo',
  'SubThreshold',
  'SuperThreshold',
  'Aerobic Capacity',
  'Anaerobic',
];

export const athlete = {
  id: ATHLETE_ID,
  name: 'Test Runner',
  sex: 'F',
  email: 'runner@example.com',
  icu_date_of_birth: '1990-06-15',
  timezone: 'Europe/Warsaw',
  measurement_preference: 'meters',
  icu_weight: 62.5,
  icu_resting_hr: 52,
  sportSettings: [
    {
      id: 1,
      types: ['Run', 'VirtualRun', 'TrailRun'],
      lthr: 170,
      max_hr: 192,
      hr_zones: [140, 152, 160, 169, 175, 181, 192],
      hr_zone_names: hrZoneNames,
      pace_units: 'MINS_KM',
      threshold_pace: 3.7037, // 4:30 /km
      pace_zones: [77.5, 87.7, 94.3, 100, 103.4, 111.5, 999],
      pace_zone_names: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5a', 'Z5b', 'Z5c'],
    },
    {
      id: 2,
      types: ['Ride', 'VirtualRide'],
      ftp: 200,
      power_zones: [55, 75, 90, 105, 120, 150, 999],
      power_zone_names: [
        'Active Recovery',
        'Endurance',
        'Tempo',
        'Threshold',
        'VO2 Max',
        'Anaerobic',
        'Neuromuscular',
      ],
      pace_units: 'NONE',
    },
  ],
} satisfies S['WithSportSettings'];

export const runActivity = {
  id: 'i2000001',
  name: 'Easy run',
  type: 'Run',
  start_date_local: '2026-09-22T07:15:00',
  distance: 8000,
  moving_time: 2640, // 44:00 → 5:30 /km
  elapsed_time: 2700,
  average_speed: 8000 / 2640,
  gap: 3.1,
  average_heartrate: 148.4,
  max_heartrate: 165,
  total_elevation_gain: 42.3,
  icu_training_load: 55,
  icu_intensity: 78.2,
  average_cadence: 84, // per leg → 168 spm
  icu_rpe: 4,
  feel: 2,
  description: '  Felt good  ',
  device_name: 'Test Watch',
  source: 'OAUTH_CLIENT',
  icu_ctl: 21.25,
  icu_atl: 30.5,
  icu_hr_zones: [140, 152, 160, 169, 175, 181, 192],
  icu_hr_zone_times: [600, 1500, 400, 140, 0, 0, 0],
  icu_hrr: { hrr: 28 },
  interval_summary: ['1x 44m 148bpm'],
  stream_types: ['time', 'heartrate'],
  tags: [],
} satisfies S['Activity'];

export const rideActivity = {
  id: 'i2000002',
  name: 'Commute',
  type: 'Ride',
  start_date_local: '2026-09-20T17:00:00',
  distance: 12000,
  moving_time: 1800,
  elapsed_time: 1900,
  average_speed: 12000 / 1800, // 24 km/h
  icu_training_load: 20,
  commute: true,
} satisfies S['Activity'];

export const walkActivity = {
  id: 'i2000003',
  name: 'Walk',
  type: 'Walk',
  start_date_local: '2026-09-18T12:00:00',
  distance: 3000,
  moving_time: 1800,
  average_speed: 3000 / 1800,
  icu_training_load: 5,
} satisfies S['Activity'];

export const stravaStub = {
  id: '15551234',
  start_date_local: '2026-09-15T09:00:00',
  type: 'Run',
  source: 'STRAVA',
  _note: 'STRAVA activities are not available via the API',
} as S['Activity'];

/** Newest first, like the real endpoint. */
export const activities = [runActivity, rideActivity, walkActivity];

export const runIntervals = [
  {
    id: 1,
    type: 'WORK',
    label: 'Warmup',
    distance: 2000,
    moving_time: 690,
    average_speed: 2000 / 690,
    average_heartrate: 138,
    average_cadence: 82,
    zone: 1,
  },
  {
    id: 2,
    type: 'RECOVERY',
    moving_time: 60,
    average_heartrate: 120,
  },
] satisfies S['Interval'][];

export const wellness = [
  { id: '2026-09-23', ctl: 20.9, atl: 28.1, rampRate: 2.5 },
  { id: '2026-09-24', ctl: 21.1, atl: 29.4, rampRate: 2.8 },
  { id: '2026-09-22', ctl: 20.5, atl: 26.0, rampRate: 2.1 },
] satisfies S['Wellness'][];

export const athleteSummary = [
  {
    athlete_id: ATHLETE_ID,
    date: '2026-09-21',
    count: 2,
    moving_time: 4440,
    distance: 20000,
    training_load: 75,
    byCategory: [
      { category: 'Run', count: 1, moving_time: 2640, distance: 8000, training_load: 55 },
      { category: 'Ride', count: 1, moving_time: 1800, distance: 12000, training_load: 20 },
      { category: 'Swim', count: 0, moving_time: 0, distance: 0, training_load: 0 },
    ],
  },
  {
    // A followed athlete — must not leak into the result.
    athlete_id: 'i9999999',
    date: '2026-09-21',
    count: 5,
    byCategory: [],
  },
] satisfies S['SummaryWithCats'][];
