import type { OperationId } from './define-tool.js';

/**
 * API operations deliberately not exposed as tools, with the reason. Everything that is
 * neither covered by a tool nor listed here shows up as "planned" in docs/coverage.md.
 */
export const EXCLUDED_OPERATIONS: Partial<Record<OperationId, string>> = {
  listAthletes: 'Coach-only: lists coached athletes.',
  updateAthletePlans: 'Coach-only: bulk plan changes for coached athletes.',
  disconnectApp: 'OAuth app management, not training data.',
  deleteTombstone: 'Internal clean-up of deleted activities.',
  uploadActivity: 'Binary file upload (FIT/TCX/GPX) is not practical through an LLM.',
  uploadActivityStreamsCSV: 'Binary/CSV stream upload.',
  updateActivityStreams: 'Raw stream editing.',
  downloadActivityFile: 'Binary file download.',
  downloadActivityFitFile: 'Binary file download.',
  downloadActivityGpxFile: 'Binary file download.',
  downloadActivityFitFiles: 'Binary file download.',
  downloadWorkouts: 'Binary (zip) download.',
  downloadWorkout: 'Binary workout file conversion (zwo/mrc/erg/fit).',
  downloadWorkout_1: 'Binary workout file conversion (zwo/mrc/erg/fit).',
  downloadWorkoutForAthlete: 'Binary workout file conversion (zwo/mrc/erg/fit).',
  importWorkoutFile: 'Binary workout file import.',
  updateCustomItemImage: 'Binary image upload.',
  getActivityMap: 'GPS map data; large and privacy-sensitive.',
  downloadActivitiesAsCSV: 'CSV export; list_activities returns the same data.',

  // Variants of operations that tools already cover through another endpoint.
  createEvent: 'Single-event variant; create_events uses the bulk endpoint.',
  deleteEvent: 'Single-event variant; delete_events uses the bulk endpoint.',
  createWorkout: 'Single-workout variant; create_workouts uses the bulk endpoint.',
  createMultipleManualActivities: 'Bulk variant; create_manual_activity logs single sessions.',
  updateSettingsMulti: 'Bulk variant; update_sport_settings changes one sport at a time.',
  updateWellness_1: 'Variant of update_wellness (same data, different path).',
  updateWellnessBulk: 'Bulk variant; update_wellness changes one day at a time.',
  uploadWellness: 'CSV upload.',
  updatePlanWorkouts: 'Bulk plan editing; use update_workout and duplicate_workouts.',

  // Deliberately not available to an AI assistant.
  deleteEvents:
    'Deleting by date range and category is too broad for an assistant; delete_events needs explicit ids.',
  sendMessage: 'Sending direct messages to other people is deliberately not exposed.',
  deleteMessage: 'Editing or deleting chat messages is out of scope.',
  updateMessage: 'Editing or deleting chat messages is out of scope.',
  updateChatBlocked: 'Moderation action; use the Intervals.icu UI.',
  updateLastSeenMessageId: 'Read receipts are UI state.',
  updateFolderSharedWith: 'Sharing folders with other athletes is out of scope.',
  updateEvents: 'Coach-only: hides or locks events for an athlete.',
  applyCurrentPlanChanges: 'Coach workflow: re-syncs a followed plan after it was edited.',
  updateAthletePlan:
    "Changing which plan the athlete follows is an account-level change; apply_plan puts a plan's workouts on the calendar instead.",
  updateAthlete:
    'Account settings (units, integrations, notifications) belong in the Intervals.icu settings page; weight and resting HR can be logged with update_wellness.',
  createSettings: 'Adding or removing sport groups changes the account structure; use the UI.',
  deleteSettings: 'Adding or removing sport groups changes the account structure; use the UI.',

  // Better done in the Intervals.icu UI.
  deleteIntervals:
    'Editing detected intervals needs precise stream indices and visual feedback; use the activity view.',
  splitInterval:
    'Editing detected intervals needs precise stream indices and visual feedback; use the activity view.',
  updateInterval:
    'Editing detected intervals needs precise stream indices and visual feedback; use the activity view.',
  updateIntervals:
    'Editing detected intervals needs precise stream indices and visual feedback; use the activity view.',
  createCustomItem:
    'Custom charts/fields/zones use a UI-specific format; configure them in the UI (readable via api_get).',
  updateCustomItem:
    'Custom charts/fields/zones use a UI-specific format; configure them in the UI (readable via api_get).',
  deleteCustomItem:
    'Custom charts/fields/zones use a UI-specific format; configure them in the UI (readable via api_get).',
  updateCustomItemIndexes: 'Reorders custom items in the UI.',
  updateAthleteRoute: 'Routes are managed in the Intervals.icu UI (readable via api_get).',
  updateWeatherConfig: 'Forecast locations are configured in the Intervals.icu UI.',
  replaceGear:
    'Only works for gear components (e.g. a bike chain) linked to a parent in the UI; to replace shoes, retire them with update_gear and add new ones with create_gear.',
};
