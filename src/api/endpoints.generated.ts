/**
 * GENERATED FILE — DO NOT EDIT. GET endpoints from the OpenAPI snapshot.
 * Regenerate with: npm run openapi:generate
 */

export interface EndpointInfo {
  operation: string;
  path: string;
  summary: string;
}

export const GET_ENDPOINTS: readonly EndpointInfo[] = [
  {
    "operation": "getActivity",
    "path": "/api/v1/activity/{id}",
    "summary": "Get an activity"
  },
  {
    "operation": "findBestEfforts",
    "path": "/api/v1/activity/{id}/best-efforts",
    "summary": "Find best efforts in the activity"
  },
  {
    "operation": "downloadActivityFile",
    "path": "/api/v1/activity/{id}/file",
    "summary": "Download original activity file, Strava activities not supported"
  },
  {
    "operation": "downloadActivityFitFile",
    "path": "/api/v1/activity/{id}/fit-file",
    "summary": "Download Intervals.icu generated activity fit file"
  },
  {
    "operation": "getGapHistogram",
    "path": "/api/v1/activity/{id}/gap-histogram",
    "summary": "Get activity gradient adjusted pace histogram"
  },
  {
    "operation": "downloadActivityGpxFile",
    "path": "/api/v1/activity/{id}/gpx-file",
    "summary": "Download Intervals.icu generated activity gpx file"
  },
  {
    "operation": "getActivityHRCurve",
    "path": "/api/v1/activity/{id}/hr-curve{ext}",
    "summary": "Get activity heart rate curve in JSON or CSV (use .csv ext) format"
  },
  {
    "operation": "getHRHistogram",
    "path": "/api/v1/activity/{id}/hr-histogram",
    "summary": "Get activity heart rate histogram"
  },
  {
    "operation": "getHRTrainingLoadModel",
    "path": "/api/v1/activity/{id}/hr-load-model",
    "summary": "Get activity heart rate training load model"
  },
  {
    "operation": "getIntervalStats",
    "path": "/api/v1/activity/{id}/interval-stats",
    "summary": "Return interval like stats for part of the activity"
  },
  {
    "operation": "getIntervals",
    "path": "/api/v1/activity/{id}/intervals",
    "summary": "Get activity intervals"
  },
  {
    "operation": "getActivityMap",
    "path": "/api/v1/activity/{id}/map",
    "summary": "Get activity map data"
  },
  {
    "operation": "listActivityMessages",
    "path": "/api/v1/activity/{id}/messages",
    "summary": "List all messages (comments) for the activity"
  },
  {
    "operation": "getActivityPaceCurve",
    "path": "/api/v1/activity/{id}/pace-curve{ext}",
    "summary": "Get activity pace curve in JSON or CSV (use .csv ext) format"
  },
  {
    "operation": "getPaceHistogram",
    "path": "/api/v1/activity/{id}/pace-histogram",
    "summary": "Get activity pace histogram"
  },
  {
    "operation": "getActivityPowerCurve",
    "path": "/api/v1/activity/{id}/power-curve{ext}",
    "summary": "Get activity power curve in JSON or CSV (use .csv ext) format"
  },
  {
    "operation": "listActivityPowerCurves_1",
    "path": "/api/v1/activity/{id}/power-curves{ext}",
    "summary": "Get activity power curves for one or more streams in JSON or CSV (use .csv ext) format"
  },
  {
    "operation": "getPowerHistogram",
    "path": "/api/v1/activity/{id}/power-histogram",
    "summary": "Get activity power histogram"
  },
  {
    "operation": "getActivityPowerSpikeModel",
    "path": "/api/v1/activity/{id}/power-spike-model",
    "summary": "Get activity power spike detection model"
  },
  {
    "operation": "getPowerVsHR",
    "path": "/api/v1/activity/{id}/power-vs-hr{ext}",
    "summary": "Get activity power vs heart rate data in JSON or CSV (use .csv ext) format"
  },
  {
    "operation": "getActivitySegments",
    "path": "/api/v1/activity/{id}/segments",
    "summary": "Get activity segments"
  },
  {
    "operation": "getActivityStreams",
    "path": "/api/v1/activity/{id}/streams{ext}",
    "summary": "List streams for the activity"
  },
  {
    "operation": "getTimeAtHR",
    "path": "/api/v1/activity/{id}/time-at-hr",
    "summary": "Get activity time at heart rate data"
  },
  {
    "operation": "getActivityWeatherSummary",
    "path": "/api/v1/activity/{id}/weather-summary",
    "summary": "Get activity weather summary information"
  },
  {
    "operation": "getActivities",
    "path": "/api/v1/athlete/{athleteId}/activities/{ids}",
    "summary": "Fetch multiple activities by id. Missing activities are ignored"
  },
  {
    "operation": "listSettings",
    "path": "/api/v1/athlete/{athleteId}/sport-settings",
    "summary": "List sport settings for the athlete"
  },
  {
    "operation": "getSettings_1",
    "path": "/api/v1/athlete/{athleteId}/sport-settings/{id}",
    "summary": "Get sport settings by id or activity type e.g. Run, Ride etc."
  },
  {
    "operation": "listMatchingActivities",
    "path": "/api/v1/athlete/{athleteId}/sport-settings/{id}/matching-activities",
    "summary": "List activities matching the settings"
  },
  {
    "operation": "listPaceDistancesForSport",
    "path": "/api/v1/athlete/{athleteId}/sport-settings/{id}/pace_distances",
    "summary": "List pace curve distances and best effort defaults for the sport"
  },
  {
    "operation": "getAthlete",
    "path": "/api/v1/athlete/{id}",
    "summary": "Get the athlete with sportSettings and custom_items"
  },
  {
    "operation": "listActivities",
    "path": "/api/v1/athlete/{id}/activities",
    "summary": "List activities for a date range in desc date order"
  },
  {
    "operation": "listActivitiesAround",
    "path": "/api/v1/athlete/{id}/activities-around",
    "summary": "List activities before and after another activity in closest first order"
  },
  {
    "operation": "downloadActivitiesAsCSV",
    "path": "/api/v1/athlete/{id}/activities.csv",
    "summary": "Download activities as CSV"
  },
  {
    "operation": "searchForIntervals",
    "path": "/api/v1/athlete/{id}/activities/interval-search",
    "summary": "Find activities with intervals matching duration and intensity"
  },
  {
    "operation": "searchForActivities",
    "path": "/api/v1/athlete/{id}/activities/search",
    "summary": "Search for activities by name or tag, returns summary info"
  },
  {
    "operation": "searchForActivitiesFull",
    "path": "/api/v1/athlete/{id}/activities/search-full",
    "summary": "Search for activities by name or tag, returns full activities"
  },
  {
    "operation": "listActivityHRCurves",
    "path": "/api/v1/athlete/{id}/activity-hr-curves{ext}",
    "summary": "Get best HR for a range of durations for matching activities in the date range"
  },
  {
    "operation": "listActivityPaceCurves",
    "path": "/api/v1/athlete/{id}/activity-pace-curves{ext}",
    "summary": "Get best pace for a range of distances for matching activities in the date range"
  },
  {
    "operation": "listActivityPowerCurves",
    "path": "/api/v1/athlete/{id}/activity-power-curves{ext}",
    "summary": "Get best power for a range of durations for matching activities in the date range"
  },
  {
    "operation": "listTags_2",
    "path": "/api/v1/athlete/{id}/activity-tags",
    "summary": "List all tags that have been applied to the athlete's activities"
  },
  {
    "operation": "getAthleteSummary",
    "path": "/api/v1/athlete/{id}/athlete-summary{ext}",
    "summary": "Summary information for followed athletes"
  },
  {
    "operation": "listChats",
    "path": "/api/v1/athlete/{id}/chats",
    "summary": "List chats (including groups) for the athlete, most recently active first"
  },
  {
    "operation": "getAthleteConnections",
    "path": "/api/v1/athlete/{id}/connections",
    "summary": "Get devices and platform apps the athlete has connected"
  },
  {
    "operation": "listCustomItems",
    "path": "/api/v1/athlete/{id}/custom-item",
    "summary": "List custom items (charts, custom fields etc.)"
  },
  {
    "operation": "getCustomItem",
    "path": "/api/v1/athlete/{id}/custom-item/{itemId}",
    "summary": "Get a custom item"
  },
  {
    "operation": "listTags_1",
    "path": "/api/v1/athlete/{id}/event-tags",
    "summary": "List all tags that have been applied to events on the athlete's calendar"
  },
  {
    "operation": "listEvents",
    "path": "/api/v1/athlete/{id}/events{format}",
    "summary": "List events (planned workouts, notes etc.) on the athlete's calendar, add .csv for CSV output"
  },
  {
    "operation": "showEvent",
    "path": "/api/v1/athlete/{id}/events/{eventId}",
    "summary": "Get an event (planned workout, note etc.)"
  },
  {
    "operation": "downloadWorkout_1",
    "path": "/api/v1/athlete/{id}/events/{eventId}/download{ext}",
    "summary": "Download a planned workout in zwo, mrc, erg or fit format"
  },
  {
    "operation": "listFitnessModelEvents",
    "path": "/api/v1/athlete/{id}/fitness-model-events",
    "summary": "List events that influence the athlete's fitness calculation in ascending date order"
  },
  {
    "operation": "listFolders",
    "path": "/api/v1/athlete/{id}/folders",
    "summary": "List all the athlete's folders, plans and workouts"
  },
  {
    "operation": "listFolderSharedWith",
    "path": "/api/v1/athlete/{id}/folders/{folderId}/shared-with",
    "summary": "List athletes that the folder or plan has been shared with"
  },
  {
    "operation": "listGear",
    "path": "/api/v1/athlete/{id}/gear{ext}",
    "summary": "List athlete gear (use .csv for CSV format)"
  },
  {
    "operation": "calcDistanceEtc",
    "path": "/api/v1/athlete/{id}/gear/{gearId}/calc",
    "summary": "Recalculate gear stats"
  },
  {
    "operation": "listGroups",
    "path": "/api/v1/athlete/{id}/groups",
    "summary": "List groups for the athlete in name order"
  },
  {
    "operation": "listAthleteHRCurves",
    "path": "/api/v1/athlete/{id}/hr-curves{ext}",
    "summary": "List best heart rate curves for the athlete"
  },
  {
    "operation": "getAthleteMMPModel",
    "path": "/api/v1/athlete/{id}/mmp-model",
    "summary": "Get the power model used to resolve %MMP steps in workouts for the athlete"
  },
  {
    "operation": "listAthletePaceCurves",
    "path": "/api/v1/athlete/{id}/pace-curves{ext}",
    "summary": "List best pace curves for the athlete"
  },
  {
    "operation": "listAthletePowerCurves",
    "path": "/api/v1/athlete/{id}/power-curves{ext}",
    "summary": "List best power curves for the athlete"
  },
  {
    "operation": "getPowerHRCurve",
    "path": "/api/v1/athlete/{id}/power-hr-curve",
    "summary": "Get the athlete's power vs heart rate curve for a date range"
  },
  {
    "operation": "getAthleteProfile",
    "path": "/api/v1/athlete/{id}/profile",
    "summary": "Get athlete profile info"
  },
  {
    "operation": "listAthleteRoutes",
    "path": "/api/v1/athlete/{id}/routes",
    "summary": "List routes for an athlete with activity counts"
  },
  {
    "operation": "getAthleteRoute",
    "path": "/api/v1/athlete/{id}/routes/{route_id}",
    "summary": "Get a route for an athlete"
  },
  {
    "operation": "checkMerge",
    "path": "/api/v1/athlete/{id}/routes/{route_id}/similarity/{other_id}",
    "summary": "How similar is this route to another?"
  },
  {
    "operation": "getSettings",
    "path": "/api/v1/athlete/{id}/settings/{deviceClass}",
    "summary": "Get the athlete's settings for phone, tablet or desktop"
  },
  {
    "operation": "getAthleteTrainingPlan",
    "path": "/api/v1/athlete/{id}/training-plan",
    "summary": "Get the athlete's training plan"
  },
  {
    "operation": "getWeatherConfig",
    "path": "/api/v1/athlete/{id}/weather-config",
    "summary": "Get the athlete's weather forecast configuration"
  },
  {
    "operation": "getForecast",
    "path": "/api/v1/athlete/{id}/weather-forecast",
    "summary": "Get weather forecast information"
  },
  {
    "operation": "listWellnessRecords",
    "path": "/api/v1/athlete/{id}/wellness{ext}",
    "summary": "List wellness records for date range (use .csv for CSV format)"
  },
  {
    "operation": "getRecord",
    "path": "/api/v1/athlete/{id}/wellness/{date}",
    "summary": "Get wellness record for date (local ISO-8601 day)"
  },
  {
    "operation": "listTags",
    "path": "/api/v1/athlete/{id}/workout-tags",
    "summary": "List all tags that have been applied to workouts in the athlete's library"
  },
  {
    "operation": "listWorkouts",
    "path": "/api/v1/athlete/{id}/workouts",
    "summary": "List all the workouts in the athlete's library"
  },
  {
    "operation": "downloadWorkouts",
    "path": "/api/v1/athlete/{id}/workouts.zip",
    "summary": "Download one or more workouts from the athlete's calendar in a zip file"
  },
  {
    "operation": "showWorkout",
    "path": "/api/v1/athlete/{id}/workouts/{workoutId}",
    "summary": "Get a workout"
  },
  {
    "operation": "listAthletes",
    "path": "/api/v1/athletes",
    "summary": "List athletes the caller is following or coaching, including the caller"
  },
  {
    "operation": "showChat",
    "path": "/api/v1/chats/{id}",
    "summary": "Get a chat by id"
  },
  {
    "operation": "listMessages",
    "path": "/api/v1/chats/{id}/messages",
    "summary": "List messages for the chat, most recent first"
  },
  {
    "operation": "listPaceDistances",
    "path": "/api/v1/pace_distances",
    "summary": "List pace curve distances"
  },
  {
    "operation": "getSharedEvent",
    "path": "/api/v1/shared-event/{id}",
    "summary": "Get a shared event (e.g. race)"
  }
];
