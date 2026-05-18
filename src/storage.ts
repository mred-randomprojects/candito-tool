import type {
  AppData,
  CycleData,
  ExerciseDefinition,
  ExerciseMaxEntry,
  FreeTrainingDay,
  UserProfile,
} from "./types";
import { ensureExerciseData, migrateCycleExerciseInputs } from "./exerciseCatalog";
import {
  buildDeletedCycleSet,
  buildDeletedFreeTrainingDaySet,
  filterDeletedAppEntitiesFromAppData,
  upsertDeletedCycle,
} from "./deletedAppEntities";

const STORAGE_KEY = "candito-cycle";
const HISTORY_KEY = "candito-history";
const PROFILE_KEY = "candito-profile";
const EXERCISES_KEY = "candito-exercises";
const EXERCISE_MAXES_KEY = "candito-exercise-maxes";
const FREE_TRAINING_DAYS_KEY = "candito-free-training-days";
const DELETED_ENTITIES_KEY = "candito-deleted-entities";

export class StorageQuotaError extends Error {
  constructor() {
    super(
      "localStorage is full — no space left to save your data. Consider exporting and deleting old cycles from History.",
    );
    this.name = "StorageQuotaError";
  }
}

/**
 * Wraps localStorage.setItem and throws a clear StorageQuotaError
 * when the browser's quota is exceeded.
 */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e: unknown) {
    if (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      throw new StorageQuotaError();
    }
    throw e;
  }
}

/**
 * Backfills the `name` field for cycles saved before the history feature existed.
 */
function migrateCycle(cycle: CycleData, fallbackIndex: number): CycleData {
  return migrateCycleExerciseInputs(cycle, fallbackIndex);
}

type DeletedEntities = Pick<
  AppData,
  "deletedCycles" | "deletedFreeTrainingDays" | "deletedDateOverrides"
>;

const DEFAULT_DELETED_ENTITIES: DeletedEntities = {
  deletedCycles: [],
  deletedFreeTrainingDays: [],
  deletedDateOverrides: [],
};

function loadDeletedEntities(): DeletedEntities {
  try {
    const raw = localStorage.getItem(DELETED_ENTITIES_KEY);
    if (raw == null) return DEFAULT_DELETED_ENTITIES;
    const parsed = JSON.parse(raw) as Partial<DeletedEntities>;
    return {
      deletedCycles: parsed.deletedCycles ?? [],
      deletedFreeTrainingDays: parsed.deletedFreeTrainingDays ?? [],
      deletedDateOverrides: parsed.deletedDateOverrides ?? [],
    };
  } catch {
    return DEFAULT_DELETED_ENTITIES;
  }
}

function saveDeletedEntities(data: DeletedEntities): void {
  safeSetItem(DELETED_ENTITIES_KEY, JSON.stringify(data));
}

// --- Current cycle ---

export function loadCycle(): CycleData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const cycle = JSON.parse(raw) as CycleData;
    const deletedCycleSet = buildDeletedCycleSet(loadDeletedEntities().deletedCycles);
    if (deletedCycleSet.has(cycle.id)) return null;
    const history = loadHistory();
    return migrateCycle(cycle, history.length + 1);
  } catch {
    return null;
  }
}

export function saveCycle(cycle: CycleData): void {
  safeSetItem(STORAGE_KEY, JSON.stringify(cycle));
}

export function clearCycle(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// --- History ---

export function loadHistory(): CycleData[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw == null) return [];
    const history = JSON.parse(raw) as CycleData[];
    const deletedCycleSet = buildDeletedCycleSet(loadDeletedEntities().deletedCycles);
    return history
      .filter((cycle) => !deletedCycleSet.has(cycle.id))
      .map((c, i) => migrateCycle(c, i + 1));
  } catch {
    return [];
  }
}

function saveHistory(history: CycleData[]): void {
  safeSetItem(HISTORY_KEY, JSON.stringify(history));
}

export function archiveCycle(cycle: CycleData): void {
  const history = loadHistory();
  history.push(cycle);
  saveHistory(history);
}

export function renameCycleInHistory(cycleId: string, newName: string): void {
  const history = loadHistory();
  const updated = history.map((c) =>
    c.id === cycleId ? { ...c, name: newName } : c,
  );
  saveHistory(updated);
}

export function updateCycleInHistory(
  cycleId: string,
  updates: Pick<CycleData, "name" | "inputs">,
): void {
  const history = loadHistory();
  const updated = history.map((c) =>
    c.id === cycleId ? { ...c, ...updates } : c,
  );
  saveHistory(updated);
}

export function deleteCycleFromHistory(cycleId: string): void {
  const history = loadHistory();
  const deletedEntities = loadDeletedEntities();
  saveDeletedEntities({
    ...deletedEntities,
    deletedCycles: upsertDeletedCycle(deletedEntities.deletedCycles, {
      cycleId,
      deletedAt: new Date().toISOString(),
    }),
  });
  saveHistory(history.filter((c) => c.id !== cycleId));
}

// --- Storage usage ---

/**
 * Returns how many bytes the app is using in localStorage
 * and the estimated total quota (~5 MB in most browsers).
 */
export function getStorageUsage(): { usedBytes: number; quotaBytes: number } {
  let usedBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key == null) continue;
    // Each char in JS is 2 bytes (UTF-16), localStorage stores strings
    usedBytes += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2;
  }
  // Most browsers give ~5 MB per origin
  const quotaBytes = 5 * 1024 * 1024;
  return { usedBytes, quotaBytes };
}

// --- User profile ---

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw == null) return {};
    return JSON.parse(raw) as UserProfile;
  } catch {
    return {};
  }
}

export function saveProfile(profile: UserProfile): void {
  safeSetItem(PROFILE_KEY, JSON.stringify(profile));
}

// --- Exercises ---

export function loadExercises(): Record<string, ExerciseDefinition> {
  try {
    const raw = localStorage.getItem(EXERCISES_KEY);
    if (raw == null) return {};
    return JSON.parse(raw) as Record<string, ExerciseDefinition>;
  } catch {
    return {};
  }
}

export function saveExercises(exercises: Record<string, ExerciseDefinition>): void {
  safeSetItem(EXERCISES_KEY, JSON.stringify(exercises));
}

export function loadExerciseMaxes(): ExerciseMaxEntry[] {
  try {
    const raw = localStorage.getItem(EXERCISE_MAXES_KEY);
    if (raw == null) return [];
    return JSON.parse(raw) as ExerciseMaxEntry[];
  } catch {
    return [];
  }
}

export function saveExerciseMaxes(maxes: ExerciseMaxEntry[]): void {
  safeSetItem(EXERCISE_MAXES_KEY, JSON.stringify(maxes));
}

export function loadFreeTrainingDays(): FreeTrainingDay[] {
  try {
    const raw = localStorage.getItem(FREE_TRAINING_DAYS_KEY);
    if (raw == null) return [];
    const deletedDaySet = buildDeletedFreeTrainingDaySet(
      loadDeletedEntities().deletedFreeTrainingDays,
    );
    const days = JSON.parse(raw) as FreeTrainingDay[];
    return days.filter((day) => !deletedDaySet.has(day.id));
  } catch {
    return [];
  }
}

export function saveFreeTrainingDays(days: FreeTrainingDay[]): void {
  safeSetItem(FREE_TRAINING_DAYS_KEY, JSON.stringify(days));
}

// --- Whole-app data ---

export function loadAppData(): AppData {
  const deletedEntities = loadDeletedEntities();
  return filterDeletedAppEntitiesFromAppData(
    ensureExerciseData({
      currentCycle: loadCycle(),
      history: loadHistory(),
      profile: loadProfile(),
      exercises: loadExercises(),
      exerciseMaxes: loadExerciseMaxes(),
      freeTrainingDays: loadFreeTrainingDays(),
      ...deletedEntities,
    }),
  );
}

export function saveAppData(data: AppData): void {
  if (data.currentCycle != null) {
    saveCycle(data.currentCycle);
  } else {
    clearCycle();
  }
  saveHistory(data.history);
  saveProfile(data.profile);
  saveExercises(data.exercises);
  saveExerciseMaxes(data.exerciseMaxes);
  saveFreeTrainingDays(data.freeTrainingDays);
  saveDeletedEntities({
    deletedCycles: data.deletedCycles,
    deletedFreeTrainingDays: data.deletedFreeTrainingDays,
    deletedDateOverrides: data.deletedDateOverrides,
  });
}

// --- Migration helper ---

/**
 * Returns the next default cycle name based on how many cycles exist.
 */
export function nextCycleName(): string {
  const history = loadHistory();
  const current = loadCycle();
  const total = history.length + (current != null ? 1 : 0);
  return `Cycle ${total + 1}`;
}
