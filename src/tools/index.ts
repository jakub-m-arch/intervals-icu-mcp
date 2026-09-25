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
  applyPlan,
  createEvents,
  deleteEvents,
  duplicateEvents,
  getEvent,
  listEvents,
  markEventDone,
  updateEvent,
} from './calendar.js';
import { addActivityComment } from './chats.js';
import { getAthleteCurves } from './curves.js';
import {
  addGearReminder,
  createGear,
  deleteGear,
  deleteGearReminder,
  listGear,
  updateGear,
  updateGearReminder,
} from './gear.js';
import {
  createFolder,
  createWorkouts,
  deleteFolder,
  deleteWorkout,
  duplicateWorkouts,
  getTrainingPlan,
  getWorkout,
  listWorkoutLibrary,
  updateFolder,
  updateWorkout,
} from './library.js';
import { apiGet, listApiEndpoints } from './raw.js';
import type { AnyTool } from './registry.js';
import { applySportSettings, updateSportSettings } from './settings.js';
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
  applyPlan,
  deleteEvents,
  // library
  listWorkoutLibrary,
  getWorkout,
  getTrainingPlan,
  createFolder,
  updateFolder,
  createWorkouts,
  updateWorkout,
  duplicateWorkouts,
  deleteWorkout,
  deleteFolder,
  // gear
  listGear,
  createGear,
  updateGear,
  addGearReminder,
  updateGearReminder,
  deleteGearReminder,
  deleteGear,
  // settings (opt-in)
  updateSportSettings,
  applySportSettings,
  // chats (opt-in)
  addActivityComment,
  // raw (opt-in)
  listApiEndpoints,
  apiGet,
];
