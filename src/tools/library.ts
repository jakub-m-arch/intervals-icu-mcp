import { z } from 'zod';
import { unwrap } from '../api/client.js';
import type { components } from '../api/schema.js';
import { compact } from '../format/compact.js';
import { formatDistance, formatDuration, round, type UnitSystem } from '../format/units.js';
import { checkWorkout, WORKOUT_SYNTAX_SUMMARY } from '../format/workout.js';
import { defineTool } from './define-tool.js';

type Workout = components['schemas']['Workout'];
type Folder = components['schemas']['Folder'];

const WorkoutSummarySchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  type: z.string().optional(),
  duration: z.string().optional(),
  distance: z.string().optional(),
  load: z.number().optional(),
  intensity_percent: z.number().optional(),
  day: z.number().optional().describe('Day number within a training plan'),
  tags: z.array(z.string()).optional(),
});

const WorkoutDetailSchema = WorkoutSummarySchema.extend({
  folder_id: z.number().optional(),
  description: z.string().optional().describe('The workout in Intervals.icu text format'),
  target: z.string().optional(),
  indoor: z.boolean().optional(),
});

const FolderSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  kind: z.string().optional().describe('FOLDER or PLAN (training plan)'),
  description: z.string().optional(),
  plan_weeks: z.number().optional(),
  plan_sports: z.array(z.string()).optional(),
  hours_per_week: z.string().optional(),
  workouts_count: z.number(),
  workouts: z.array(WorkoutSummarySchema),
});

function summarizeWorkout(w: Workout, system: UnitSystem) {
  return compact({
    id: w.id as number,
    name: w.name ?? undefined,
    type: w.type ?? undefined,
    duration: w.moving_time ? formatDuration(w.moving_time) : undefined,
    distance: w.distance ? formatDistance(w.distance, system) : undefined,
    load: round(w.icu_training_load),
    intensity_percent: round(w.icu_intensity),
    day: w.day ?? undefined,
    tags: w.tags?.length ? w.tags : undefined,
  });
}

function describeFolder(f: Folder, system: UnitSystem) {
  const workouts = f.children ?? [];
  const min = f.hours_per_week_min;
  const max = f.hours_per_week_max;
  return compact({
    id: f.id as number,
    name: f.name ?? undefined,
    kind: f.type ?? undefined,
    description: f.description?.trim() || f.blurb?.trim() || undefined,
    plan_weeks: f.duration_weeks ?? undefined,
    plan_sports: f.activity_types?.length ? f.activity_types : undefined,
    hours_per_week: min || max ? `${min ?? '?'}–${max ?? '?'} h` : undefined,
    workouts_count: workouts.length,
    workouts: workouts.map((w) => summarizeWorkout(w, system)),
  });
}

export const listWorkoutLibrary = defineTool({
  name: 'list_workout_library',
  title: 'List workout library',
  description:
    "List the athlete's workout library: folders and training plans with their workouts " +
    '(name, sport, duration, load). Use get_workout for the steps of a workout.',
  toolset: 'library',
  access: 'read',
  operations: ['listFolders'],
  input: z.object({
    folder_id: z.number().int().optional().describe('Only this folder or plan.'),
  }),
  output: z.object({ folders: z.array(FolderSchema) }),
  async handler(args, ctx) {
    const [athlete, folders] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .GET('/api/v1/athlete/{id}/folders', { params: { path: { id: ctx.athleteId } } })
        .then(unwrap),
    ]);
    const selected = (folders ?? []).filter(
      (f) => args.folder_id === undefined || f.id === args.folder_id,
    );
    if (args.folder_id !== undefined && selected.length === 0) {
      throw new RangeError(`No folder or plan with id ${args.folder_id}.`);
    }
    return { folders: selected.map((f) => describeFolder(f, athlete.unitSystem)) };
  },
});

export const getWorkout = defineTool({
  name: 'get_workout',
  title: 'Get library workout',
  description:
    'Get one workout from the library, including its steps in Intervals.icu text format.',
  toolset: 'library',
  access: 'read',
  operations: ['showWorkout'],
  input: z.object({ id: z.number().int().describe('Workout id (from list_workout_library).') }),
  output: z.object({ workout: WorkoutDetailSchema }),
  async handler(args, ctx) {
    const [athlete, w] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .GET('/api/v1/athlete/{id}/workouts/{workoutId}', {
          params: { path: { id: ctx.athleteId, workoutId: args.id } },
        })
        .then(unwrap),
    ]);
    return {
      workout: compact({
        ...summarizeWorkout(w, athlete.unitSystem),
        folder_id: w.folder_id ?? undefined,
        description: w.description?.trim() || undefined,
        target: w.target ?? undefined,
        indoor: w.indoor || undefined,
      }),
    };
  },
});

export const getTrainingPlan = defineTool({
  name: 'get_training_plan',
  title: 'Get current training plan',
  description:
    'Get the training plan the athlete is currently following (if any): plan name, start ' +
    'date and its workouts by day.',
  toolset: 'library',
  access: 'read',
  operations: ['getAthleteTrainingPlan'],
  input: z.object({}),
  output: z.object({
    active: z.boolean(),
    start_date: z.string().optional(),
    last_applied: z.string().optional(),
    plan: FolderSchema.optional(),
  }),
  async handler(_args, ctx) {
    const [athlete, plan] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .GET('/api/v1/athlete/{id}/training-plan', { params: { path: { id: ctx.athleteId } } })
        .then(unwrap),
    ]);
    if (!plan?.training_plan_id && !plan?.training_plan) return { active: false };
    return compact({
      active: true,
      start_date: plan.training_plan_start_date?.slice(0, 10),
      last_applied: plan.training_plan_last_applied?.slice(0, 10),
      plan: plan.training_plan ? describeFolder(plan.training_plan, athlete.unitSystem) : undefined,
    });
  },
});

// ---------------------------------------------------------------------------------------
// Write tools
// ---------------------------------------------------------------------------------------

const MAX_WORKOUTS_PER_CALL = 50;

const WorkoutCheckSchema = z.object({
  parsed_steps: z.number(),
  duration: z.string().optional(),
  distance: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});
const WrittenWorkoutSchema = WorkoutSummarySchema.extend({
  workout_check: WorkoutCheckSchema.optional(),
});

const workoutFields = {
  name: z.string().min(1).max(200),
  type: z.string().describe('Sport, e.g. "Run" or "Ride".'),
  description: z
    .string()
    .max(10_000)
    .optional()
    .describe('The workout steps in workout text syntax.'),
  day: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Training plans only: day number in the plan (0 = first day).'),
  indoor: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
};

function withCheck(w: Workout, system: UnitSystem) {
  return compact({
    ...summarizeWorkout(w, system),
    workout_check: w.description?.trim() ? checkWorkout(w.workout_doc, system) : undefined,
  });
}

export const createFolder = defineTool({
  name: 'create_folder',
  title: 'Create a library folder or plan',
  description:
    'Create a folder (or a training plan) in the workout library to hold reusable workouts.',
  toolset: 'library',
  access: 'write',
  operations: ['createFolder'],
  input: z.object({
    name: z.string().min(1).max(200),
    kind: z.enum(['FOLDER', 'PLAN']).optional().describe('Default FOLDER.'),
    description: z.string().max(5000).optional(),
  }),
  output: z.object({ folder: FolderSchema }),
  async handler(args, ctx) {
    const [athlete, folder] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .POST('/api/v1/athlete/{id}/folders', {
          params: { path: { id: ctx.athleteId } },
          body: compact({
            type: args.kind ?? 'FOLDER',
            name: args.name,
            description: args.description,
          }),
        })
        .then(unwrap),
    ]);
    return { folder: describeFolder(folder, athlete.unitSystem) };
  },
});

export const updateFolder = defineTool({
  name: 'update_folder',
  title: 'Rename a library folder',
  description: 'Rename a workout library folder or plan, or change its description.',
  toolset: 'library',
  access: 'write',
  idempotent: true,
  operations: ['updateFolder'],
  input: z.object({
    id: z.number().int(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
  }),
  output: z.object({
    id: z.number(),
    name: z.string().optional(),
    description: z.string().optional(),
  }),
  async handler(args, ctx) {
    if (args.name === undefined && args.description === undefined) {
      throw new RangeError('Nothing to update: pass a name or description.');
    }
    const folder = unwrap(
      await ctx.api.PUT('/api/v1/athlete/{id}/folders/{folderId}', {
        params: { path: { id: ctx.athleteId, folderId: args.id } },
        body: compact({ name: args.name, description: args.description }),
      }),
    );
    return compact({
      id: folder.id as number,
      name: folder.name ?? undefined,
      description: folder.description?.trim() || undefined,
    });
  },
});

export const createWorkouts = defineTool({
  name: 'create_workouts',
  title: 'Add workouts to the library',
  description:
    'Save reusable workouts in a library folder or plan (up to ' +
    `${MAX_WORKOUTS_PER_CALL} per call). Check workout_check in the result and fix warnings ` +
    `with update_workout.\n\n${WORKOUT_SYNTAX_SUMMARY}`,
  toolset: 'library',
  access: 'write',
  operations: ['createMultipleWorkouts'],
  input: z.object({
    folder_id: z.number().int().describe('Target folder or plan (from list_workout_library).'),
    workouts: z.array(z.object(workoutFields)).min(1).max(MAX_WORKOUTS_PER_CALL),
  }),
  output: z.object({ created: z.array(WrittenWorkoutSchema) }),
  async handler(args, ctx) {
    const [athlete, created] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .POST('/api/v1/athlete/{id}/workouts/bulk', {
          params: { path: { id: ctx.athleteId } },
          body: args.workouts.map((w) => compact({ ...w, folder_id: args.folder_id })),
        })
        .then(unwrap),
    ]);
    return { created: (created ?? []).map((w) => withCheck(w, athlete.unitSystem)) };
  },
});

export const updateWorkout = defineTool({
  name: 'update_workout',
  title: 'Update a library workout',
  description:
    'Change a library workout (name, steps, sport, folder). Only the fields you pass are ' +
    `changed.\n\n${WORKOUT_SYNTAX_SUMMARY}`,
  toolset: 'library',
  access: 'write',
  idempotent: true,
  operations: ['updateWorkout'],
  input: z.object({
    id: z.number().int(),
    folder_id: z.number().int().optional().describe('Move to this folder or plan.'),
    name: workoutFields.name.optional(),
    type: workoutFields.type.optional(),
    description: workoutFields.description,
    day: workoutFields.day,
    indoor: workoutFields.indoor,
    tags: workoutFields.tags,
  }),
  output: z.object({ workout: WrittenWorkoutSchema }),
  async handler({ id, ...changes }, ctx) {
    if (Object.values(changes).every((v) => v === undefined)) {
      throw new RangeError('Nothing to update: pass at least one field to change.');
    }
    const [athlete, workout] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .PUT('/api/v1/athlete/{id}/workouts/{workoutId}', {
          params: { path: { id: ctx.athleteId, workoutId: id } },
          body: compact(changes),
        })
        .then(unwrap),
    ]);
    return { workout: withCheck(workout, athlete.unitSystem) };
  },
});

export const deleteWorkout = defineTool({
  name: 'delete_workout',
  title: 'Delete a library workout',
  description:
    'Permanently delete one workout from the library. Cannot be undone: confirm with the ' +
    'user first. Calendar events created from it are not affected.',
  toolset: 'library',
  access: 'destructive',
  operations: ['deleteWorkout', 'showWorkout'],
  input: z.object({ id: z.number().int() }),
  output: z.object({ deleted: WorkoutSummarySchema }),
  async handler(args, ctx) {
    const [athlete, workout] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .GET('/api/v1/athlete/{id}/workouts/{workoutId}', {
          params: { path: { id: ctx.athleteId, workoutId: args.id } },
        })
        .then(unwrap),
    ]);
    unwrap(
      await ctx.api.DELETE('/api/v1/athlete/{id}/workouts/{workoutId}', {
        params: { path: { id: ctx.athleteId, workoutId: args.id }, query: { others: false } },
      }),
    );
    return { deleted: summarizeWorkout(workout, athlete.unitSystem) };
  },
});

export const deleteFolder = defineTool({
  name: 'delete_folder',
  title: 'Delete a library folder',
  description:
    'Permanently delete a library folder or plan INCLUDING ALL ITS WORKOUTS. Cannot be ' +
    'undone: tell the user how many workouts will be lost and get explicit confirmation.',
  toolset: 'library',
  access: 'destructive',
  operations: ['deleteFolder', 'listFolders'],
  input: z.object({ id: z.number().int() }),
  output: z.object({ deleted: FolderSchema }),
  async handler(args, ctx) {
    const [athlete, folders] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .GET('/api/v1/athlete/{id}/folders', { params: { path: { id: ctx.athleteId } } })
        .then(unwrap),
    ]);
    const folder = (folders ?? []).find((f) => f.id === args.id);
    if (!folder) throw new RangeError(`No folder or plan with id ${args.id}.`);
    unwrap(
      await ctx.api.DELETE('/api/v1/athlete/{id}/folders/{folderId}', {
        params: { path: { id: ctx.athleteId, folderId: args.id } },
      }),
    );
    return { deleted: describeFolder(folder, athlete.unitSystem) };
  },
});

export const duplicateWorkouts = defineTool({
  name: 'duplicate_workouts',
  title: 'Repeat plan workouts in later weeks',
  description:
    'Copy workouts inside a training plan to later weeks of the plan, e.g. repeat week 1 for ' +
    'weeks 2–4.',
  toolset: 'library',
  access: 'write',
  operations: ['duplicateWorkouts'],
  input: z.object({
    ids: z.array(z.number().int()).min(1).max(MAX_WORKOUTS_PER_CALL),
    copies: z.number().int().min(1).max(12),
    weeks_between: z.number().int().min(1).max(8).optional().describe('Default 1.'),
  }),
  output: z.object({ created: z.array(WorkoutSummarySchema) }),
  async handler(args, ctx) {
    const [athlete, created] = await Promise.all([
      ctx.athlete(),
      ctx.api
        .POST('/api/v1/athlete/{id}/duplicate-workouts', {
          params: { path: { id: ctx.athleteId } },
          body: {
            workoutIds: args.ids,
            numCopies: args.copies,
            weeksBetween: args.weeks_between ?? 1,
          },
        })
        .then(unwrap),
    ]);
    return { created: (created ?? []).map((w) => summarizeWorkout(w, athlete.unitSystem)) };
  },
});
