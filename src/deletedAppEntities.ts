import type {
  AppData,
  CycleData,
  DateOverride,
  DeletedCycle,
  DeletedDateOverride,
  DeletedFreeTrainingDay,
  ExerciseMaxEntry,
} from "./types";

export function cycleTombstoneKey(cycleId: string): string {
  return cycleId;
}

export function freeTrainingDayTombstoneKey(dayId: string): string {
  return dayId;
}

export function dateOverrideTombstoneKey(
  cycleId: string,
  overrideKey: string,
): string {
  return `${cycleId}\u0000${overrideKey}`;
}

export function buildDeletedCycleSet(
  deletedCycles: ReadonlyArray<DeletedCycle>,
): Set<string> {
  return new Set(
    deletedCycles.map((entry) => cycleTombstoneKey(entry.cycleId)),
  );
}

export function buildDeletedFreeTrainingDaySet(
  deletedFreeTrainingDays: ReadonlyArray<DeletedFreeTrainingDay>,
): Set<string> {
  return new Set(
    deletedFreeTrainingDays.map((entry) =>
      freeTrainingDayTombstoneKey(entry.dayId),
    ),
  );
}

export function buildDeletedDateOverrideMap(
  deletedDateOverrides: ReadonlyArray<DeletedDateOverride>,
): Map<string, DeletedDateOverride> {
  return new Map(
    deletedDateOverrides.map((entry) => [
      dateOverrideTombstoneKey(entry.cycleId, entry.overrideKey),
      entry,
    ]),
  );
}

export function mergeDeletedCycles(
  localDeletedCycles: ReadonlyArray<DeletedCycle>,
  cloudDeletedCycles: ReadonlyArray<DeletedCycle>,
): DeletedCycle[] {
  return mergeByKey(
    localDeletedCycles,
    cloudDeletedCycles,
    (entry) => cycleTombstoneKey(entry.cycleId),
  );
}

export function mergeDeletedFreeTrainingDays(
  localDeletedFreeTrainingDays: ReadonlyArray<DeletedFreeTrainingDay>,
  cloudDeletedFreeTrainingDays: ReadonlyArray<DeletedFreeTrainingDay>,
): DeletedFreeTrainingDay[] {
  return mergeByKey(
    localDeletedFreeTrainingDays,
    cloudDeletedFreeTrainingDays,
    (entry) => freeTrainingDayTombstoneKey(entry.dayId),
  );
}

export function mergeDeletedDateOverrides(
  localDeletedDateOverrides: ReadonlyArray<DeletedDateOverride>,
  cloudDeletedDateOverrides: ReadonlyArray<DeletedDateOverride>,
): DeletedDateOverride[] {
  return mergeByKey(
    localDeletedDateOverrides,
    cloudDeletedDateOverrides,
    (entry) =>
      dateOverrideTombstoneKey(entry.cycleId, entry.overrideKey),
  );
}

export function upsertDeletedCycle(
  deletedCycles: ReadonlyArray<DeletedCycle>,
  deletedCycle: DeletedCycle,
): DeletedCycle[] {
  return upsertByKey(
    deletedCycles,
    deletedCycle,
    (entry) => cycleTombstoneKey(entry.cycleId),
  );
}

export function upsertDeletedFreeTrainingDay(
  deletedFreeTrainingDays: ReadonlyArray<DeletedFreeTrainingDay>,
  deletedFreeTrainingDay: DeletedFreeTrainingDay,
): DeletedFreeTrainingDay[] {
  return upsertByKey(
    deletedFreeTrainingDays,
    deletedFreeTrainingDay,
    (entry) => freeTrainingDayTombstoneKey(entry.dayId),
  );
}

export function upsertDeletedDateOverride(
  deletedDateOverrides: ReadonlyArray<DeletedDateOverride>,
  deletedDateOverride: DeletedDateOverride,
): DeletedDateOverride[] {
  return upsertByKey(
    deletedDateOverrides,
    deletedDateOverride,
    (entry) =>
      dateOverrideTombstoneKey(entry.cycleId, entry.overrideKey),
  );
}

export function removeDeletedDateOverride(
  deletedDateOverrides: ReadonlyArray<DeletedDateOverride>,
  cycleId: string,
  overrideKey: string,
): DeletedDateOverride[] {
  const targetKey = dateOverrideTombstoneKey(cycleId, overrideKey);
  return deletedDateOverrides.filter(
    (entry) =>
      dateOverrideTombstoneKey(entry.cycleId, entry.overrideKey) !==
      targetKey,
  );
}

export function filterDeletedAppEntitiesFromAppData(data: AppData): AppData {
  const deletedCycles = data.deletedCycles ?? [];
  const deletedFreeTrainingDays = data.deletedFreeTrainingDays ?? [];
  const deletedDateOverrides = data.deletedDateOverrides ?? [];
  const deletedCycleSet = buildDeletedCycleSet(deletedCycles);
  const deletedCycleIds = [...deletedCycleSet];
  const deletedFreeTrainingDaySet = buildDeletedFreeTrainingDaySet(
    deletedFreeTrainingDays,
  );
  const deletedDateOverrideMap = buildDeletedDateOverrideMap(
    deletedDateOverrides,
  );
  const currentCycle =
    data.currentCycle != null &&
    !deletedCycleSet.has(cycleTombstoneKey(data.currentCycle.id))
      ? filterDeletedDateOverridesFromCycle(
          data.currentCycle,
          deletedDateOverrideMap,
        )
      : null;
  const history = data.history
    .filter((cycle) => !deletedCycleSet.has(cycleTombstoneKey(cycle.id)))
    .map((cycle) =>
      filterDeletedDateOverridesFromCycle(cycle, deletedDateOverrideMap),
    );

  return {
    ...data,
    currentCycle,
    history,
    exerciseMaxes: data.exerciseMaxes.filter(
      (entry) => !isDeletedCycleGeneratedMax(entry, deletedCycleIds),
    ),
    freeTrainingDays: data.freeTrainingDays.filter(
      (day) =>
        !deletedFreeTrainingDaySet.has(
          freeTrainingDayTombstoneKey(day.id),
        ),
    ),
    deletedCycles: [...deletedCycles],
    deletedFreeTrainingDays: [...deletedFreeTrainingDays],
    deletedDateOverrides: [...deletedDateOverrides],
  };
}

function mergeByKey<T extends { deletedAt: string }>(
  localEntries: ReadonlyArray<T>,
  cloudEntries: ReadonlyArray<T>,
  keyFor: (entry: T) => string,
): T[] {
  const byKey = new Map<string, T>();

  for (const entry of [...localEntries, ...cloudEntries]) {
    const key = keyFor(entry);
    const existing = byKey.get(key);
    if (existing == null || isoTime(entry.deletedAt) > isoTime(existing.deletedAt)) {
      byKey.set(key, entry);
    }
  }

  return [...byKey.values()];
}

function upsertByKey<T>(
  entries: ReadonlyArray<T>,
  entry: T,
  keyFor: (entry: T) => string,
): T[] {
  const targetKey = keyFor(entry);
  const next = entries.filter((candidate) => keyFor(candidate) !== targetKey);
  return [...next, entry];
}

function filterDeletedDateOverridesFromCycle(
  cycle: CycleData,
  deletedDateOverrideMap: ReadonlyMap<string, DeletedDateOverride>,
): CycleData {
  if (cycle.dateOverrides == null) return cycle;

  const next: Record<string, DateOverride> = {};
  for (const [key, override] of Object.entries(cycle.dateOverrides)) {
    const deletedOverride = deletedDateOverrideMap.get(
      dateOverrideTombstoneKey(cycle.id, key),
    );
    if (
      deletedOverride == null ||
      isoTime(override.updatedAt) > isoTime(deletedOverride.deletedAt)
    ) {
      next[key] = override;
    }
  }

  return {
    ...cycle,
    dateOverrides: Object.keys(next).length > 0 ? next : undefined,
  };
}

function isDeletedCycleGeneratedMax(
  entry: ExerciseMaxEntry,
  deletedCycleIds: ReadonlyArray<string>,
): boolean {
  return (
    entry.source === "cycle" &&
    deletedCycleIds.some((cycleId) =>
      entry.id.startsWith(`cycle-${cycleId}-`),
    )
  );
}

function isoTime(value: string | undefined): number {
  if (value == null) return Number.NEGATIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}
