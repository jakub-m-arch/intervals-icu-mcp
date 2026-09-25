import {
  getActivity,
  listActivities,
  listActivityComments,
  searchActivities,
} from './activities.js';
import {
  getActivityBestEfforts,
  getActivityHistogram,
  getActivitySegmentStats,
  getActivityStreams,
  searchIntervals,
} from './analysis.js';
import { getAthleteProfile, getFitnessSummary } from './athlete.js';
import { getEvent, listEvents } from './calendar.js';
import { getAthleteCurves } from './curves.js';
import { listGear } from './gear.js';
import { getTrainingPlan, getWorkout, listWorkoutLibrary } from './library.js';
import type { AnyTool } from './registry.js';
import { getWellness } from './wellness.js';

/** Every tool the server knows about. Configuration decides which ones are registered. */
export const ALL_TOOLS: readonly AnyTool[] = [
  // athlete
  getAthleteProfile,
  getFitnessSummary,
  // activities
  listActivities,
  searchActivities,
  getActivity,
  listActivityComments,
  // analysis
  getActivityStreams,
  getActivityHistogram,
  getActivityBestEfforts,
  getActivitySegmentStats,
  searchIntervals,
  // curves
  getAthleteCurves,
  // wellness
  getWellness,
  // calendar
  listEvents,
  getEvent,
  // library
  listWorkoutLibrary,
  getWorkout,
  getTrainingPlan,
  // gear
  listGear,
];
