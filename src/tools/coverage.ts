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
};
