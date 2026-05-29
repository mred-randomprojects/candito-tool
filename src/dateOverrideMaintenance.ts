import { generateProgram } from "./programEngine";
import type { AppData, CycleData } from "./types";
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
  const overrideKeys = [
    ...new Set([
      ...programDateOverrideKeys(cycle),
      ...existingOverrideKeys,
    ]),
  ];
  const deletedDateOverrides = overrideKeys.reduce(
    (next, overrideKey) =>
      upsertDeletedDateOverride(next, {
        cycleId: cycle.id,
        overrideKey,
        deletedAt,
      }),
    data.deletedDateOverrides,
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
