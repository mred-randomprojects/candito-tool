import {
  DEFAULT_MAIN_LIFT_NAMES,
  type AppData,
  type CycleData,
  type ExerciseCategory,
  type ExerciseDefinition,
  type ExerciseMaxEntry,
  type MainLift,
  type MainLiftExerciseMap,
  type ProgramInputs,
  type WeightUnit,
} from "./types";
import { mainLiftNamesFromInputs, normalizeMainLiftNames } from "./exerciseNames";

export const DEFAULT_MAIN_LIFT_EXERCISE_IDS: Record<MainLift, string> = {
  bench: "bench-press",
  squat: "squat",
  deadlift: "deadlift",
};

const DEFAULT_EXERCISE_CREATED_AT = "2026-01-01T00:00:00.000Z";

export const DEFAULT_EXERCISES: Record<string, ExerciseDefinition> = {
  [DEFAULT_MAIN_LIFT_EXERCISE_IDS.bench]: {
    id: DEFAULT_MAIN_LIFT_EXERCISE_IDS.bench,
    name: DEFAULT_MAIN_LIFT_NAMES.bench,
    category: "upper",
    createdAt: DEFAULT_EXERCISE_CREATED_AT,
  },
  [DEFAULT_MAIN_LIFT_EXERCISE_IDS.squat]: {
    id: DEFAULT_MAIN_LIFT_EXERCISE_IDS.squat,
    name: DEFAULT_MAIN_LIFT_NAMES.squat,
    category: "lower",
    createdAt: DEFAULT_EXERCISE_CREATED_AT,
  },
  [DEFAULT_MAIN_LIFT_EXERCISE_IDS.deadlift]: {
    id: DEFAULT_MAIN_LIFT_EXERCISE_IDS.deadlift,
    name: DEFAULT_MAIN_LIFT_NAMES.deadlift,
    category: "lower",
    createdAt: DEFAULT_EXERCISE_CREATED_AT,
  },
};

export function defaultExerciseCatalog(): Record<string, ExerciseDefinition> {
  return Object.fromEntries(
    Object.entries(DEFAULT_EXERCISES).map(([id, exercise]) => [
      id,
      { ...exercise },
    ]),
  );
}

export function slugifyExerciseName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "exercise";
}

export function exerciseIdForName(name: string): string {
  const normalized = name.trim();
  const defaultLift = (Object.keys(DEFAULT_MAIN_LIFT_NAMES) as MainLift[]).find(
    (lift) => DEFAULT_MAIN_LIFT_NAMES[lift] === normalized,
  );
  if (defaultLift != null) return DEFAULT_MAIN_LIFT_EXERCISE_IDS[defaultLift];
  return `custom-${slugifyExerciseName(normalized)}`;
}

export function uniqueExerciseId(
  name: string,
  exercises: Record<string, ExerciseDefinition>,
): string {
  const base = exerciseIdForName(name);
  if (exercises[base] == null) return base;

  let index = 2;
  while (exercises[`${base}-${index}`] != null) {
    index += 1;
  }
  return `${base}-${index}`;
}

export function mainLiftExerciseIdsFromInputs(
  inputs: ProgramInputs | undefined,
): Record<MainLift, string> {
  const names = mainLiftNamesFromInputs(inputs);
  return {
    bench:
      inputs?.mainLiftExerciseIds?.bench ??
      exerciseIdForName(names.bench),
    squat:
      inputs?.mainLiftExerciseIds?.squat ??
      exerciseIdForName(names.squat),
    deadlift:
      inputs?.mainLiftExerciseIds?.deadlift ??
      exerciseIdForName(names.deadlift),
  };
}

export function exercisesForSelect(
  exercises: Record<string, ExerciseDefinition>,
): ExerciseDefinition[] {
  return Object.values(exercises)
    .filter((exercise) => exercise.archived !== true)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function latestMaxForExercise(
  maxes: ExerciseMaxEntry[],
  exerciseId: string,
  unit?: WeightUnit,
): ExerciseMaxEntry | undefined {
  return maxes
    .filter(
      (entry) =>
        entry.exerciseId === exerciseId &&
        (unit == null || entry.unit === unit),
    )
    .sort(compareMaxEntriesDesc)[0];
}

export function maxesForExercise(
  maxes: ExerciseMaxEntry[],
  exerciseId: string,
): ExerciseMaxEntry[] {
  return maxes
    .filter((entry) => entry.exerciseId === exerciseId)
    .sort(compareMaxEntriesDesc);
}

export function maxValueForExercise(
  maxes: ExerciseMaxEntry[],
  exerciseId: string,
  unit?: WeightUnit,
): string {
  const latest = latestMaxForExercise(maxes, exerciseId, unit);
  return latest != null ? String(latest.value) : "";
}

export function normalizeProgramInputsFromExercises(
  inputs: ProgramInputs,
  exercises: Record<string, ExerciseDefinition>,
  selectedIds: Record<MainLift, string>,
): ProgramInputs {
  const fallbackNames = mainLiftNamesFromInputs(inputs);
  const mainLiftNames = normalizeMainLiftNames({
    bench: exercises[selectedIds.bench]?.name ?? fallbackNames.bench,
    squat: exercises[selectedIds.squat]?.name ?? fallbackNames.squat,
    deadlift: exercises[selectedIds.deadlift]?.name ?? fallbackNames.deadlift,
  });
  const mainLiftExerciseIds: MainLiftExerciseMap = {
    bench: selectedIds.bench,
    squat: selectedIds.squat,
    deadlift: selectedIds.deadlift,
  };

  return {
    ...inputs,
    mainLiftNames,
    mainLiftExerciseIds,
  };
}

export function ensureExerciseData(data: Partial<AppData>): AppData {
  const currentCycle = data.currentCycle ?? null;
  const history = data.history ?? [];
  const profile = data.profile ?? {};
  const migratedCurrent =
    currentCycle != null ? migrateCycleExerciseInputs(currentCycle, history.length + 1) : null;
  const migratedHistory = history.map((cycle, index) =>
    migrateCycleExerciseInputs(cycle, index + 1),
  );
  const exercises = {
    ...defaultExerciseCatalog(),
    ...(data.exercises ?? {}),
  };

  [...migratedHistory, ...(migratedCurrent != null ? [migratedCurrent] : [])]
    .forEach((cycle) => {
      const names = mainLiftNamesFromInputs(cycle.inputs);
      const ids = mainLiftExerciseIdsFromInputs(cycle.inputs);
      (Object.keys(ids) as MainLift[]).forEach((lift) => {
        const id = ids[lift];
        if (exercises[id] == null) {
          exercises[id] = {
            id,
            name: names[lift],
            category: lift === "bench" ? "upper" : "lower",
            createdAt: cycle.createdAt,
          };
        }
      });
    });

  const maxMap = new Map<string, ExerciseMaxEntry>();
  (data.exerciseMaxes ?? [])
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .forEach((entry) => {
      maxMap.set(entry.id, entry);
    });

  [...migratedHistory, ...(migratedCurrent != null ? [migratedCurrent] : [])]
    .flatMap(maxEntriesFromCycle)
    .forEach((entry) => {
      maxMap.set(entry.id, entry);
    });

  return {
    currentCycle: migratedCurrent,
    history: migratedHistory,
    profile,
    exercises,
    exerciseMaxes: [...maxMap.values()].sort(compareMaxEntriesDesc),
  };
}

export function migrateCycleExerciseInputs(
  cycle: CycleData,
  fallbackIndex: number,
): CycleData {
  const name =
    cycle.name == null || cycle.name.length === 0
      ? `Cycle ${fallbackIndex}`
      : cycle.name;
  const ids = mainLiftExerciseIdsFromInputs(cycle.inputs);
  return {
    ...cycle,
    name,
    inputs: normalizeProgramInputsFromExercises(
      cycle.inputs,
      exerciseDefinitionsFromInputs(cycle.inputs, cycle.createdAt),
      ids,
    ),
  };
}

export function exerciseDefinitionsFromInputs(
  inputs: ProgramInputs,
  createdAt: string,
): Record<string, ExerciseDefinition> {
  const names = mainLiftNamesFromInputs(inputs);
  const ids = mainLiftExerciseIdsFromInputs(inputs);
  return {
    [ids.bench]: {
      id: ids.bench,
      name: names.bench,
      category: "upper",
      createdAt,
    },
    [ids.squat]: {
      id: ids.squat,
      name: names.squat,
      category: "lower",
      createdAt,
    },
    [ids.deadlift]: {
      id: ids.deadlift,
      name: names.deadlift,
      category: "lower",
      createdAt,
    },
  };
}

export function maxEntriesFromCycle(cycle: CycleData): ExerciseMaxEntry[] {
  const ids = mainLiftExerciseIdsFromInputs(cycle.inputs);
  const values: Record<MainLift, number> = {
    bench: cycle.inputs.bench1RM,
    squat: cycle.inputs.squat1RM,
    deadlift: cycle.inputs.deadlift1RM,
  };

  return (Object.keys(ids) as MainLift[])
    .filter((lift) => values[lift] > 0)
    .map((lift) => ({
      id: `cycle-${cycle.id}-${lift}`,
      exerciseId: ids[lift],
      value: values[lift],
      unit: cycle.inputs.weightUnit,
      date: cycle.inputs.startDate,
      source: "cycle",
      createdAt: cycle.createdAt,
      notes: `${cycle.name} starting 1RM`,
    }));
}

export function buildManualMaxEntriesForInputs(
  cycleId: string,
  inputs: ProgramInputs,
  createdAt: string,
): ExerciseMaxEntry[] {
  const ids = mainLiftExerciseIdsFromInputs(inputs);
  const values: Record<MainLift, number> = {
    bench: inputs.bench1RM,
    squat: inputs.squat1RM,
    deadlift: inputs.deadlift1RM,
  };

  return (Object.keys(ids) as MainLift[])
    .filter((lift) => values[lift] > 0)
    .map((lift) => ({
      id: `${cycleId}-${lift}-${createdAt}`,
      exerciseId: ids[lift],
      value: values[lift],
      unit: inputs.weightUnit,
      date: new Date(createdAt).toISOString().slice(0, 10),
      source: "manual",
      createdAt,
      notes: "Program setting",
    }));
}

export function createExercise(
  name: string,
  category: ExerciseCategory,
  exercises: Record<string, ExerciseDefinition>,
  createdAt: string,
): ExerciseDefinition {
  const trimmed = name.trim();
  return {
    id: uniqueExerciseId(trimmed, exercises),
    name: trimmed,
    category,
    createdAt,
  };
}

export function preferredUnitFromData(data: AppData): WeightUnit {
  return (
    data.currentCycle?.inputs.weightUnit ??
    data.history[data.history.length - 1]?.inputs.weightUnit ??
    "kg"
  );
}

function compareMaxEntriesDesc(a: ExerciseMaxEntry, b: ExerciseMaxEntry): number {
  const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
  if (dateDiff !== 0) return dateDiff;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}
