import { describe, expect, it } from "vitest";
import {
  clearCurrentCycleDateOverrides,
  tombstoneCycleDateOverrides,
} from "./dateOverrideMaintenance";
import { mergeAppData } from "./mergeAppData";
import { ensureExerciseData } from "./exerciseCatalog";
import type { AppData, CycleData } from "./types";

function cycle(): CycleData {
  return {
    id: "cycle-1",
    name: "Cycle 1",
    createdAt: "2026-05-04T00:00:00.000Z",
    inputs: {
      startDate: "2026-05-04",
      weightUnit: "kg",
      bench1RM: 100,
      squat1RM: 140,
      deadlift1RM: 180,
      horizontalPull: "Dumbbell Row",
      shoulderExercise: "Military Press",
      verticalPull: "Weighted Pull-up",
    },
    dateOverrides: {
      "w0-d0": {
        date: "2026-05-05",
        reason: "Moved",
        updatedAt: "2026-05-04T10:00:00.000Z",
      },
    },
    workoutLogs: {},
  };
}

function appData(data: Partial<AppData>): AppData {
  return ensureExerciseData({
    currentCycle: null,
    history: [],
    profile: {},
    exercises: {},
    exerciseMaxes: [],
    freeTrainingDays: [],
    deletedCycles: [],
    deletedFreeTrainingDays: [],
    deletedDateOverrides: [],
    ...data,
  });
}

describe("clearCurrentCycleDateOverrides", () => {
  it("clears current cycle overrides and tombstones all program date keys", () => {
    const result = clearCurrentCycleDateOverrides(
      appData({ currentCycle: cycle() }),
      "2026-05-06T12:00:00.000Z",
    );

    expect(result.ok).toBe(true);
    expect(result.appData.currentCycle?.dateOverrides).toBeUndefined();
    expect(result.removedOverrideCount).toBe(1);
    expect(result.overrideKeys).toContain("w0-d0");
    expect(result.overrideKeys).toContain("w4-d2");
    expect(result.tombstonedOverrideCount).toBe(result.overrideKeys?.length);
    expect(
      result.appData.deletedDateOverrides.some(
        (entry) =>
          entry.cycleId === "cycle-1" &&
          entry.overrideKey === "w0-d0" &&
          entry.deletedAt === "2026-05-06T12:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("prevents cloud-only current cycle overrides from resurrecting", () => {
    const cleared = clearCurrentCycleDateOverrides(
      appData({ currentCycle: cycle() }),
      "2026-05-06T12:00:00.000Z",
    );
    const cloudCycle = {
      ...cycle(),
      dateOverrides: {
        "w0-d0": {
          date: "2026-05-05",
          reason: "Cloud stale",
          updatedAt: "2026-05-04T10:00:00.000Z",
        },
        "w4-d2": {
          date: "2026-06-05",
          reason: "Cloud future stale",
          updatedAt: "2026-05-04T10:00:00.000Z",
        },
      },
    };

    const merged = mergeAppData(
      cleared.appData,
      appData({ currentCycle: cloudCycle }),
      "cloud",
    );

    expect(merged.currentCycle?.dateOverrides).toBeUndefined();
  });
});

describe("tombstoneCycleDateOverrides", () => {
  it("tombstones program keys plus stray stored keys", () => {
    const target = {
      ...cycle(),
      dateOverrides: {
        ...cycle().dateOverrides,
        "w9-d9": {
          date: "2026-06-01",
          reason: "Stray key outside the program",
          updatedAt: "2026-05-04T10:00:00.000Z",
        },
      },
    };

    const result = tombstoneCycleDateOverrides(
      target,
      [],
      "2026-05-06T12:00:00.000Z",
    );

    expect(result.overrideKeys).toContain("w0-d0");
    expect(result.overrideKeys).toContain("w9-d9");
    expect(result.deletedDateOverrides).toHaveLength(result.overrideKeys.length);
    expect(
      result.deletedDateOverrides.every(
        (entry) =>
          entry.cycleId === "cycle-1" &&
          entry.deletedAt === "2026-05-06T12:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("covers every scheduled day of a linear cycle", () => {
    const linearCycle = {
      ...cycle(),
      inputs: {
        ...cycle().inputs,
        programType: "linear" as const,
        linearVariant: "control" as const,
        linearWeekCount: 3,
      },
    };

    const result = tombstoneCycleDateOverrides(
      linearCycle,
      [],
      "2026-05-06T12:00:00.000Z",
    );

    // 3 weeks × 4 days, plus the stray w0-d0 already among the program keys.
    expect(result.overrideKeys).toHaveLength(12);
    expect(result.overrideKeys).toContain("w2-d3");
  });
});
