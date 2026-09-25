import {
  createManualActivity,
  deleteActivity,
  getActivity,
  listActivities,
  listActivityComments,
  searchActivities,
  updateActivity,
} from './activities.js';
import {
  getActivityBestEfforts,
  getActivityHistogram,
  getActivitySegmentStats,
  getActivityStreams,
  searchIntervals,
} from './analysis.js';
import { getAthleteProfile, getFitnessSummary } from './athlete.js';
import {
  createEvents,
  deleteEvents,
  duplicateEvents,
  getEvent,
  listEvents,
  markEventDone,
  updateEvent,
} from './calendar.js';
import { getAthleteCurves } from './curves.js';
import { addGearReminder, createGear, deleteGear, listGear, updateGear } from './gear.js';
import {
  createFolder,
  createWorkouts,
  deleteFolder,
  deleteWorkout,
  getTrainingPlan,
  getWorkout,
  listWorkoutLibrary,
  updateFolder,
  updateWorkout,
} from './library.js';
import type { AnyTool } from './registry.js';
import { getWellness, updateWellness } from './wellness.js';

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
  updateActivity,
  createManualActivity,
  deleteActivity,
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
  updateWellness,
  // calendar
  listEvents,
  getEvent,
  createEvents,
  updateEvent,
  markEventDone,
  duplicateEvents,
  deleteEvents,
  // library
  listWorkoutLibrary,
  getWorkout,
  getTrainingPlan,
  createFolder,
  updateFolder,
  createWorkouts,
  updateWorkout,
  deleteWorkout,
  deleteFolder,
  // gear
  listGear,
  createGear,
  updateGear,
  addGearReminder,
  deleteGear,
];
