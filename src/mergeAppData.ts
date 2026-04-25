import type {
  AppData,
  CycleData,
  DateOverride,
  ExerciseLog,
  SetLog,
  UserProfile,
  WorkoutLog,
} from "./types";

/**
 * Additive merge for localStorage + Firestore data.
 * It keeps cycles from both sides and merges nested logs by key so a mostly
 * empty device cannot erase the phone's completed workout history.
 */
export function mergeAppData(local: AppData, cloud: AppData): AppData {
  const currentCycle = mergeCurrentCycle(local.currentCycle, cloud.currentCycle);
  const history = mergeHistory(local, cloud, currentCycle?.id ?? null);

  return {
    currentCycle,
    history,
    profile: mergeProfile(local.profile, cloud.profile),
  };
}

function mergeCurrentCycle(
  localCurrent: CycleData | null,
  cloudCurrent: CycleData | null,
): CycleData | null {
  if (localCurrent == null) return cloudCurrent;
  if (cloudCurrent == null) return localCurrent;
  if (localCurrent.id === cloudCurrent.id) {
    return mergeCycle(localCurrent, cloudCurrent);
  }
  return localCurrent;
}

function mergeHistory(
  local: AppData,
  cloud: AppData,
  currentCycleId: string | null,
): CycleData[] {
  const merged = new Map<string, CycleData>();

  function add(cycle: CycleData | null) {
    if (cycle == null) return;
    const existing = merged.get(cycle.id);
    merged.set(cycle.id, existing == null ? cycle : mergeCycle(cycle, existing));
  }

  cloud.history.forEach(add);
  local.history.forEach(add);
  add(cloud.currentCycle);
  add(local.currentCycle);

  if (currentCycleId != null) {
    merged.delete(currentCycleId);
  }

  return [...merged.values()].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function mergeCycle(local: CycleData, cloud: CycleData): CycleData {
  return {
    ...cloud,
    ...local,
    name: local.name || cloud.name,
    inputs: { ...cloud.inputs, ...local.inputs },
    workoutLogs: mergeWorkoutLogs(local.workoutLogs, cloud.workoutLogs),
    dateOverrides: mergeDateOverrides(
      local.dateOverrides ?? {},
      cloud.dateOverrides ?? {},
    ),
    createdAt: earlierDate(local.createdAt, cloud.createdAt),
  };
}

function mergeWorkoutLogs(
  localLogs: Record<string, WorkoutLog>,
  cloudLogs: Record<string, WorkoutLog>,
): Record<string, WorkoutLog> {
  const keys = new Set([...Object.keys(cloudLogs), ...Object.keys(localLogs)]);
  const merged: Record<string, WorkoutLog> = {};

  keys.forEach((key) => {
    const local = localLogs[key];
    const cloud = cloudLogs[key];
    if (local == null) {
      merged[key] = cloud;
    } else if (cloud == null) {
      merged[key] = local;
    } else {
      merged[key] = mergeWorkoutLog(local, cloud);
    }
  });

  return merged;
}

function mergeWorkoutLog(local: WorkoutLog, cloud: WorkoutLog): WorkoutLog {
  const exerciseCount = Math.max(
    local.exerciseLogs.length,
    cloud.exerciseLogs.length,
  );

  return {
    completed: local.completed || cloud.completed,
    startedAt: local.startedAt ?? cloud.startedAt,
    completedAt: latestNullableDate(local.completedAt, cloud.completedAt),
    exerciseLogs: Array.from({ length: exerciseCount }, (_, index) =>
      mergeExerciseLog(local.exerciseLogs[index], cloud.exerciseLogs[index]),
    ),
    notes: preferText(local.notes, cloud.notes),
  };
}

function mergeExerciseLog(
  local: ExerciseLog | undefined,
  cloud: ExerciseLog | undefined,
): ExerciseLog {
  if (local == null) return cloud ?? { setLogs: [] };
  if (cloud == null) return local;

  const setCount = Math.max(local.setLogs.length, cloud.setLogs.length);
  const warmUpCount = Math.max(
    local.warmUpSetLogs?.length ?? 0,
    cloud.warmUpSetLogs?.length ?? 0,
  );

  return {
    setLogs: Array.from({ length: setCount }, (_, index) =>
      mergeSetLog(local.setLogs[index], cloud.setLogs[index]),
    ),
    ...(warmUpCount > 0
      ? {
          warmUpSetLogs: Array.from({ length: warmUpCount }, (_, index) =>
            mergeSetLog(
              local.warmUpSetLogs?.[index],
              cloud.warmUpSetLogs?.[index],
            ),
          ),
        }
      : {}),
  };
}

function mergeSetLog(local: SetLog | undefined, cloud: SetLog | undefined): SetLog {
  if (local == null) return cloud ?? emptySetLog();
  if (cloud == null) return local;

  return {
    actualReps: local.actualReps ?? cloud.actualReps,
    difficulty: local.difficulty ?? cloud.difficulty,
    actualWeight: local.actualWeight ?? cloud.actualWeight,
    prescribedWeight: local.prescribedWeight ?? cloud.prescribedWeight,
    notes: preferText(local.notes, cloud.notes),
  };
}

function mergeDateOverrides(
  local: Record<string, DateOverride>,
  cloud: Record<string, DateOverride>,
): Record<string, DateOverride> | undefined {
  const merged = { ...cloud, ...local };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeProfile(local: UserProfile, cloud: UserProfile): UserProfile {
  return {
    bodyWeight: local.bodyWeight ?? cloud.bodyWeight,
    sex: local.sex ?? cloud.sex,
  };
}

function emptySetLog(): SetLog {
  return {
    actualReps: null,
    difficulty: null,
    actualWeight: null,
    prescribedWeight: null,
    notes: "",
  };
}

function preferText(local: string, cloud: string): string {
  if (local.trim().length > 0) return local;
  return cloud;
}

function earlierDate(a: string, b: string): string {
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function latestNullableDate(
  a: string | null,
  b: string | null,
): string | null {
  if (a == null) return b;
  if (b == null) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}
