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

// --- Phase 2 fixtures -------------------------------------------------------------------

/** 1 Hz streams for a 10-minute segment: 5 min running (~5:00 /km) then 5 min walking. */
const seconds = Array.from({ length: 600 }, (_, i) => i);
export const streams = [
  { type: 'time', data: seconds },
  { type: 'heartrate', data: seconds.map((i) => (i < 300 ? 150 : 120)) },
  { type: 'velocity_smooth', data: seconds.map((i) => (i < 300 ? 1000 / 300 : 1000 / 690)) },
  { type: 'cadence', data: seconds.map((i) => (i < 300 ? 85 : 55)) },
  {
    type: 'distance',
    data: seconds.map((i) => (i < 300 ? i * (1000 / 300) : 1000 + (i - 300) * (1000 / 690))),
  },
  { type: 'latlng', data: seconds.map(() => 52.1), data2: seconds.map(() => 21.0) },
  { type: 'watts', data: [], allNull: true },
]; // The spec types `data` as an object; the real API returns arrays.

export const hrHistogram = [
  { min: 115, max: 119, secs: 300 },
  { min: 145, max: 149, secs: 0 },
  { min: 150, max: 154, secs: 300 },
];

export const bestEfforts = {
  efforts: [
    { start_index: 10, end_index: 310, average: 1000 / 300, distance: 1000 },
    { start_index: 0, end_index: 301, average: 3.3, distance: 1000 },
  ],
} satisfies S['BestEfforts'];

export const intervalStats = {
  type: 'WORK',
  distance: 1000,
  moving_time: 300,
  average_speed: 1000 / 300,
  average_heartrate: 150,
  average_cadence: 85,
} satisfies S['Interval'];

export const paceCurves = {
  list: [
    {
      id: '42d',
      label: '42 days',
      start_date_local: '2026-08-15T00:00:00',
      end_date_local: '2026-09-26T00:00:00',
      distance: [400, 800, 1000, 5000],
      values: [100, 210, 270, 1500],
      activity_id: ['i2000001', 'i2000001', 'i2000001', 'i2000001'],
      paceModels: [{ type: 'CS', criticalSpeed: 1000 / 300, dPrime: 120.4 }],
    },
  ],
  activities: { i2000001: { name: 'Easy run', start_date_local: '2026-09-22T07:15:00' } },
};

export const hrCurves = {
  list: [
    {
      id: '90d',
      label: '90 days',
      secs: [5, 60, 300, 1200],
      values: [185, 180, 172, 165],
      activity_id: ['i2000001', 'i2000001', 'i2000001', 'i2000001'],
    },
  ],
  activities: {},
};

export const wellnessDays = [
  {
    id: '2026-09-24',
    restingHR: 55,
    hrv: 60,
    sleepSecs: 26_000,
    sleepScore: 80,
    soreness: 2,
    comments: ' Legs heavy ',
  },
  { id: '2026-09-23', restingHR: 51, hrv: 70, sleepSecs: 28_000, sleepScore: 90 },
] satisfies S['Wellness'][];

export const events = [
  {
    id: 11,
    start_date_local: '2026-09-27T00:00:00',
    category: 'WORKOUT',
    type: 'Run',
    name: 'Intervals',
    description: 'Warmup\n- 10m Z2 Pace\n\nMain set 4x\n- 3m Z4 Pace\n- 2m Z1 Pace',
    moving_time: 2700,
    distance: 7000,
    icu_training_load: 60,
    target: 'PACE',
  },
  {
    id: 10,
    start_date_local: '2026-09-26T18:30:00',
    category: 'NOTE',
    name: 'Physio',
  },
  {
    id: 12,
    start_date_local: '2026-10-01T00:00:00',
    end_date_local: '2026-10-05T00:00:00',
    category: 'HOLIDAY',
    name: 'Trip',
  },
] satisfies S['Event'][];

export const workout = {
  id: 501,
  name: 'Tempo 3x10',
  type: 'Run',
  folder_id: 900,
  description: '- 3x10m Z3 Pace',
  moving_time: 3000,
  icu_training_load: 70,
} satisfies S['Workout'];

export const folders = [
  { id: 900, type: 'FOLDER', name: 'Run workouts', children: [workout] },
  {
    id: 901,
    type: 'PLAN',
    name: '5k beginner',
    duration_weeks: 8,
    activity_types: ['Run'],
    hours_per_week_min: 2,
    hours_per_week_max: 3,
    children: [{ ...workout, id: 502, day: 3 }],
  },
] satisfies S['Folder'][];

export const gear = [
  {
    id: 'g1',
    type: 'Shoes',
    name: 'Daily trainers',
    distance: 412_500,
    time: 140_000,
    activities: 52,
    reminders: [
      { name: 'Replace', distance: 600_000, distance_used: 412_500, percent_used: 68.75 },
    ],
  },
  { id: 'g2', type: 'Shoes', name: 'Old racers', distance: 800_000, retired: '2026-01-01' },
  { id: 'b1', type: 'Bike', name: 'Commuter', distance: 1_000_000 },
] satisfies S['Gear'][];

export const comments = [
  {
    id: 1,
    name: 'Coach',
    created: '2026-09-22T09:00:00Z',
    content: 'Nice even pacing!',
    type: 'TEXT',
  },
  { id: 2, name: 'Coach', content: 'removed', deleted: '2026-09-22T10:00:00Z', type: 'TEXT' },
] satisfies S['Message'][];
