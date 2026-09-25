import { getActivity, listActivities } from './activities.js';
import { getAthleteProfile, getFitnessSummary } from './athlete.js';
import type { AnyTool } from './registry.js';

/** Every tool the server knows about. Configuration decides which ones are registered. */
export const ALL_TOOLS: readonly AnyTool[] = [
  getAthleteProfile,
  getFitnessSummary,
  listActivities,
  getActivity,
];
