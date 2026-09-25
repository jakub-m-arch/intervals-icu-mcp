import { z } from 'zod';
import { unwrap } from '../api/client.js';
import type { components } from '../api/schema.js';
import { compact } from '../format/compact.js';
import { formatDistance, formatDuration, round, type UnitSystem } from '../format/units.js';
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
