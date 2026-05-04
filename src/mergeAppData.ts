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
export function mergeAppData(
  local: AppData,
  cloud: AppData,
  prefer: "local" | "cloud" = "local",
): AppData {
  const currentCycle = mergeCurrentCycle(
    local.currentCycle,
    cloud.currentCycle,
    prefer,
  );
  const history = mergeHistory(local, cloud, currentCycle?.id ?? null, prefer);

  return {
    currentCycle,
    history,
    profile: mergeProfile(local.profile, cloud.profile, prefer),
  };
}

function mergeCurrentCycle(
  localCurrent: CycleData | null,
  cloudCurrent: CycleData | null,
  prefer: "local" | "cloud",
): CycleData | null {
  if (localCurrent == null) return cloudCurrent;
  if (cloudCurrent == null) return localCurrent;
  if (localCurrent.id === cloudCurrent.id) {
    return mergeCycle(localCurrent, cloudCurrent, prefer);
  }
  return prefer === "local" ? localCurrent : cloudCurrent;
}

function mergeHistory(
  local: AppData,
  cloud: AppData,
  currentCycleId: string | null,
  prefer: "local" | "cloud",
): CycleData[] {
  const merged = new Map<string, CycleData>();

  function add(cycle: CycleData | null) {
    if (cycle == null) return;
    const existing = merged.get(cycle.id);
    merged.set(
      cycle.id,
      existing == null ? cycle : mergeCycle(cycle, existing, prefer),
    );
  }

  if (prefer === "local") {
    cloud.history.forEach(add);
    local.history.forEach(add);
    add(cloud.currentCycle);
    add(local.currentCycle);
  } else {
    local.history.forEach(add);
    cloud.history.forEach(add);
    add(local.currentCycle);
    add(cloud.currentCycle);
  }

  if (currentCycleId != null) {
    merged.delete(currentCycleId);
  }

  return [...merged.values()].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function mergeCycle(
  local: CycleData,
  cloud: CycleData,
  prefer: "local" | "cloud",
): CycleData {
  const preferred = prefer === "local" ? local : cloud;
  const fallback = prefer === "local" ? cloud : local;

  return {
    ...fallback,
    ...preferred,
    name: preferred.name || fallback.name,
    inputs: { ...fallback.inputs, ...preferred.inputs },
    workoutLogs: mergeWorkoutLogs(local.workoutLogs, cloud.workoutLogs, prefer),
    dateOverrides: mergeDateOverrides(
      local.dateOverrides ?? {},
      cloud.dateOverrides ?? {},
      prefer,
    ),
    createdAt: earlierDate(local.createdAt, cloud.createdAt),
  };
}

function mergeWorkoutLogs(
  localLogs: Record<string, WorkoutLog>,
  cloudLogs: Record<string, WorkoutLog>,
  prefer: "local" | "cloud",
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
      merged[key] = mergeWorkoutLog(local, cloud, prefer);
    }
  });

  return merged;
}

function mergeWorkoutLog(
  local: WorkoutLog,
  cloud: WorkoutLog,
  prefer: "local" | "cloud",
): WorkoutLog {
  const latestSource = latestWorkoutLogSource(local, cloud, prefer);
  if (latestSource != null) {
    return latestSource === "local" ? local : cloud;
  }

  const exerciseCount = Math.max(
    local.exerciseLogs.length,
    cloud.exerciseLogs.length,
  );

  return {
    completed: local.completed || cloud.completed,
    startedAt: local.startedAt ?? cloud.startedAt,
    completedAt: latestNullableDate(local.completedAt, cloud.completedAt),
    exerciseLogs: Array.from({ length: exerciseCount }, (_, index) =>
      mergeExerciseLog(
        local.exerciseLogs[index],
        cloud.exerciseLogs[index],
        prefer,
      ),
    ),
    notes: preferText(local.notes, cloud.notes, prefer),
  };
}

function latestWorkoutLogSource(
  local: WorkoutLog,
  cloud: WorkoutLog,
  prefer: "local" | "cloud",
): "local" | "cloud" | null {
  if (local.updatedAt == null && cloud.updatedAt == null) return null;
  if (local.updatedAt == null) return "cloud";
  if (cloud.updatedAt == null) return "local";

  const localTime = new Date(local.updatedAt).getTime();
  const cloudTime = new Date(cloud.updatedAt).getTime();
  if (localTime > cloudTime) return "local";
  if (cloudTime > localTime) return "cloud";
  return prefer;
}

function mergeExerciseLog(
  local: ExerciseLog | undefined,
  cloud: ExerciseLog | undefined,
  prefer: "local" | "cloud",
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
      mergeSetLog(local.setLogs[index], cloud.setLogs[index], prefer),
    ),
    ...(warmUpCount > 0
      ? {
          warmUpSetLogs: Array.from({ length: warmUpCount }, (_, index) =>
            mergeSetLog(
              local.warmUpSetLogs?.[index],
              cloud.warmUpSetLogs?.[index],
              prefer,
            ),
          ),
        }
      : {}),
  };
}

function mergeSetLog(
  local: SetLog | undefined,
  cloud: SetLog | undefined,
  prefer: "local" | "cloud",
): SetLog {
  if (local == null) return cloud ?? emptySetLog();
  if (cloud == null) return local;
  const preferred = prefer === "local" ? local : cloud;
  const fallback = prefer === "local" ? cloud : local;

  return {
    actualReps: preferred.actualReps ?? fallback.actualReps,
    difficulty: preferred.difficulty ?? fallback.difficulty,
    actualWeight: preferred.actualWeight ?? fallback.actualWeight,
    prescribedWeight: preferred.prescribedWeight ?? fallback.prescribedWeight,
    notes: preferText(local.notes, cloud.notes, prefer),
  };
}

function mergeDateOverrides(
  local: Record<string, DateOverride>,
  cloud: Record<string, DateOverride>,
  prefer: "local" | "cloud",
): Record<string, DateOverride> | undefined {
  const merged = prefer === "local" ? { ...cloud, ...local } : { ...local, ...cloud };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeProfile(
  local: UserProfile,
  cloud: UserProfile,
  prefer: "local" | "cloud",
): UserProfile {
  const preferred = prefer === "local" ? local : cloud;
  const fallback = prefer === "local" ? cloud : local;
  return {
    bodyWeight: preferred.bodyWeight ?? fallback.bodyWeight,
    sex: preferred.sex ?? fallback.sex,
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

function preferText(
  local: string,
  cloud: string,
  prefer: "local" | "cloud",
): string {
  const preferred = prefer === "local" ? local : cloud;
  const fallback = prefer === "local" ? cloud : local;
  if (preferred.trim().length > 0) return preferred;
  return fallback;
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
