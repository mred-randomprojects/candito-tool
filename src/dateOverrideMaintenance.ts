import { generateProgram } from "./programEngine";
import type { AppData, CycleData, DeletedDateOverride } from "./types";
import { upsertDeletedDateOverride } from "./deletedAppEntities";

export interface ClearCurrentCycleDateOverridesResult {
  ok: boolean;
  appData: AppData;
  cycleId?: string;
  removedOverrideCount?: number;
  tombstonedOverrideCount?: number;
  overrideKeys?: string[];
  reason?: string;
}

function programDateOverrideKeys(cycle: CycleData): string[] {
  return generateProgram(cycle.inputs).weeks.flatMap((week, weekIndex) =>
    week.workoutDays.map((_, dayIndex) => `w${weekIndex}-d${dayIndex}`),
  );
}

export interface TombstoneCycleDateOverridesResult {
  deletedDateOverrides: DeletedDateOverride[];
  overrideKeys: string[];
}

/**
 * Tombstones every possible override key for a cycle (program keys plus any
 * stray stored keys) so cleared overrides cannot resurrect from other devices.
 */
export function tombstoneCycleDateOverrides(
  cycle: CycleData,
  deletedDateOverrides: ReadonlyArray<DeletedDateOverride>,
  deletedAt: string,
): TombstoneCycleDateOverridesResult {
  const overrideKeys = [
    ...new Set([
      ...programDateOverrideKeys(cycle),
      ...Object.keys(cycle.dateOverrides ?? {}),
    ]),
  ];
  return {
    overrideKeys,
    deletedDateOverrides: overrideKeys.reduce(
      (next, overrideKey) =>
        upsertDeletedDateOverride(next, {
          cycleId: cycle.id,
          overrideKey,
          deletedAt,
        }),
      [...deletedDateOverrides],
    ),
  };
}

export function clearCurrentCycleDateOverrides(
  data: AppData,
  deletedAt = new Date().toISOString(),
): ClearCurrentCycleDateOverridesResult {
  const cycle = data.currentCycle;
  if (cycle == null) {
    return {
      ok: false,
      appData: data,
      reason: "No current cycle.",
    };
  }

  const existingOverrideKeys = Object.keys(cycle.dateOverrides ?? {});
  const { overrideKeys, deletedDateOverrides } = tombstoneCycleDateOverrides(
    cycle,
    data.deletedDateOverrides,
    deletedAt,
  );

  return {
    ok: true,
    appData: {
      ...data,
      currentCycle: {
        ...cycle,
        dateOverrides: undefined,
        updatedAt: deletedAt,
      },
      deletedDateOverrides,
    },
    cycleId: cycle.id,
    removedOverrideCount: existingOverrideKeys.length,
    tombstonedOverrideCount: overrideKeys.length,
    overrideKeys,
  };
}
