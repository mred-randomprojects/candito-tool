import { describe, expect, it } from "vitest";
import { mergeAppData } from "./mergeAppData";
import type { AppData, CycleData, FreeTrainingDay } from "./types";
import { ensureExerciseData } from "./exerciseCatalog";

function cycle(
  id: string,
  name: string,
  createdAt = "2026-01-01T00:00:00.000Z",
): CycleData {
  return {
    id,
    name,
    createdAt,
    inputs: {
      startDate: "2026-01-01",
      weightUnit: "kg",
      bench1RM: 100,
      squat1RM: 140,
      deadlift1RM: 180,
      horizontalPull: "Barbell Row",
      shoulderExercise: "Military Press",
      verticalPull: "Weighted Pull-up",
    },
    workoutLogs: {
      "w0-d0": {
        completed: true,
        startedAt: "2026-01-01T10:00:00.000Z",
        completedAt: "2026-01-01T11:00:00.000Z",
        exerciseLogs: [],
        notes: "phone data",
      },
    },
  };
}

function freeTrainingDay(
  id: string,
  date: string,
  updatedAt = "2026-01-02T10:00:00.000Z",
): FreeTrainingDay {
  return {
    id,
    date,
    createdAt: "2026-01-02T09:00:00.000Z",
    updatedAt,
    notes: "extra work",
    exerciseLogs: [
      {
        exerciseId: "bench-press",
        notes: "",
        setLogs: [
          {
            actualWeight: 80,
            actualReps: 8,
            difficulty: 3,
            prescribedWeight: null,
            notes: "",
          },
        ],
      },
    ],
  };
}

describe("mergeAppData", () => {
  function appData(data: Partial<AppData>): AppData {
    return ensureExerciseData({
      currentCycle: null,
      history: [],
      profile: {},
      exercises: {},
      exerciseMaxes: [],
      ...data,
    });
  }

  it("keeps cloud phone data when the local device is empty", () => {
    const local = appData({
      currentCycle: null,
      history: [],
      profile: {},
    });
    const phoneCycle = cycle("cycle-phone", "Phone Cycle");
    const cloud = appData({
      currentCycle: phoneCycle,
      history: [],
      profile: { bodyWeight: 80, sex: "male" },
    });

    const merged = mergeAppData(local, cloud);

    expect(merged.currentCycle?.id).toBe("cycle-phone");
    expect(merged.currentCycle?.workoutLogs["w0-d0"].notes).toBe("phone data");
    expect(merged.profile.bodyWeight).toBe(80);
  });

  it("merges local and cloud cycles without dropping either side", () => {
    const localCycle = cycle("local-cycle", "Local Cycle");
    const cloudCycle = cycle("cloud-cycle", "Cloud Cycle");

    const merged = mergeAppData(
      appData({ currentCycle: localCycle }),
      appData({ currentCycle: cloudCycle }),
    );

    expect(merged.currentCycle?.id).toBe("local-cycle");
    expect(merged.history.map((c) => c.id)).toContain("cloud-cycle");
  });

  it("can prefer cloud fields for realtime updates to the same cycle", () => {
    const localCycle = cycle("same-cycle", "Old Phone Name");
    const cloudCycle = cycle("same-cycle", "Renamed On Desktop");

    const merged = mergeAppData(
      appData({ currentCycle: localCycle }),
      appData({ currentCycle: cloudCycle }),
      "cloud",
    );

    expect(merged.currentCycle?.name).toBe("Renamed On Desktop");
  });

  it("keeps a newly-created local current cycle over an older cloud current cycle", () => {
    const newLocalCycle = cycle(
      "local-new-cycle",
      "New Local Cycle",
      "2026-02-01T00:00:00.000Z",
    );
    const oldCloudCycle = {
      ...cycle(
        "cloud-old-cycle",
        "Old Cloud Cycle",
        "2026-01-01T00:00:00.000Z",
      ),
      dateOverrides: {
        "w0-d0": {
          date: "2026-01-03",
          reason: "Old reschedule",
        },
      },
    };

    const merged = mergeAppData(
      appData({ currentCycle: newLocalCycle }),
      appData({ currentCycle: oldCloudCycle }),
      "cloud",
    );

    expect(merged.currentCycle?.id).toBe("local-new-cycle");
    expect(merged.currentCycle?.dateOverrides).toBeUndefined();
    expect(merged.history.map((c) => c.id)).toContain("cloud-old-cycle");
  });

  it("can prefer cloud fields during initial sync when Firestore already exists", () => {
    const stalePhoneCycle = cycle("same-cycle", "Old Phone Name");
    const firestoreCycle = cycle("same-cycle", "Firestore Name");

    const merged = mergeAppData(
      appData({ currentCycle: stalePhoneCycle }),
      appData({ currentCycle: firestoreCycle }),
      "cloud",
    );

    expect(merged.currentCycle?.name).toBe("Firestore Name");
    expect(merged.currentCycle?.workoutLogs["w0-d0"].notes).toBe("phone data");
  });

  it("keeps a newer local workout reset instead of restoring older cloud progress", () => {
    const localCycle = cycle("same-cycle", "Current Cycle");
    const cloudCycle = cycle("same-cycle", "Current Cycle");

    localCycle.workoutLogs["w0-d0"] = {
      completed: false,
      startedAt: null,
      completedAt: null,
      exerciseLogs: [],
      notes: "",
      updatedAt: "2026-01-01T12:00:00.000Z",
    };
    cloudCycle.workoutLogs["w0-d0"] = {
      ...cloudCycle.workoutLogs["w0-d0"],
      completed: false,
      completedAt: null,
      updatedAt: "2026-01-01T10:00:00.000Z",
    };

    const merged = mergeAppData(
      appData({ currentCycle: localCycle }),
      appData({ currentCycle: cloudCycle }),
      "cloud",
    );

    expect(merged.currentCycle?.workoutLogs["w0-d0"].startedAt).toBeNull();
    expect(merged.currentCycle?.workoutLogs["w0-d0"].notes).toBe("");
  });

  it("keeps free training days from both devices", () => {
    const localDay = freeTrainingDay("local-free", "2026-01-03");
    const cloudDay = freeTrainingDay("cloud-free", "2026-01-04");

    const merged = mergeAppData(
      appData({ freeTrainingDays: [localDay] }),
      appData({ freeTrainingDays: [cloudDay] }),
    );

    expect(merged.freeTrainingDays.map((day) => day.id)).toEqual([
      "cloud-free",
      "local-free",
    ]);
  });

  it("keeps the latest version of the same free training day", () => {
    const localDay = {
      ...freeTrainingDay("same-free", "2026-01-03", "2026-01-03T09:00:00.000Z"),
      notes: "old local note",
    };
    const cloudDay = {
      ...freeTrainingDay("same-free", "2026-01-03", "2026-01-03T10:00:00.000Z"),
      notes: "new cloud note",
    };

    const merged = mergeAppData(
      appData({ freeTrainingDays: [localDay] }),
      appData({ freeTrainingDays: [cloudDay] }),
      "cloud",
    );

    expect(merged.freeTrainingDays).toHaveLength(1);
    expect(merged.freeTrainingDays[0].notes).toBe("new cloud note");
  });

  it("does not resurrect a deleted cloud current cycle", () => {
    const deletedCycle = cycle("deleted-cycle", "Deleted Cycle");

    const merged = mergeAppData(
      appData({
        currentCycle: null,
        deletedCycles: [
          {
            cycleId: deletedCycle.id,
            deletedAt: "2026-01-05T10:00:00.000Z",
          },
        ],
      }),
      appData({ currentCycle: deletedCycle }),
      "cloud",
    );

    expect(merged.currentCycle).toBeNull();
    expect(merged.history.map((entry) => entry.id)).not.toContain(
      deletedCycle.id,
    );
  });

  it("does not resurrect a deleted archived cycle", () => {
    const deletedCycle = cycle("deleted-history-cycle", "Deleted History Cycle");

    const merged = mergeAppData(
      appData({
        deletedCycles: [
          {
            cycleId: deletedCycle.id,
            deletedAt: "2026-01-05T10:00:00.000Z",
          },
        ],
      }),
      appData({ history: [deletedCycle] }),
      "cloud",
    );

    expect(merged.history.map((entry) => entry.id)).not.toContain(
      deletedCycle.id,
    );
    expect(merged.exerciseMaxes.map((entry) => entry.id)).not.toContain(
      `cycle-${deletedCycle.id}-bench`,
    );
  });

  it("does not resurrect a deleted free training day", () => {
    const deletedDay = freeTrainingDay("deleted-free", "2026-01-05");

    const merged = mergeAppData(
      appData({
        deletedFreeTrainingDays: [
          {
            dayId: deletedDay.id,
            deletedAt: "2026-01-05T10:00:00.000Z",
          },
        ],
      }),
      appData({ freeTrainingDays: [deletedDay] }),
      "cloud",
    );

    expect(merged.freeTrainingDays.map((day) => day.id)).not.toContain(
      deletedDay.id,
    );
  });

  it("does not resurrect a removed date override", () => {
    const localCycle = cycle("override-cycle", "Override Cycle");
    const cloudCycle = {
      ...cycle("override-cycle", "Override Cycle"),
      dateOverrides: {
        "w0-d0": {
          date: "2026-01-04",
          reason: "Old override",
        },
      },
    };

    const merged = mergeAppData(
      appData({
        currentCycle: localCycle,
        deletedDateOverrides: [
          {
            cycleId: localCycle.id,
            overrideKey: "w0-d0",
            deletedAt: "2026-01-05T10:00:00.000Z",
          },
        ],
      }),
      appData({ currentCycle: cloudCycle }),
      "cloud",
    );

    expect(merged.currentCycle?.dateOverrides?.["w0-d0"]).toBeUndefined();
  });

  it("keeps a date override recreated after an older tombstone", () => {
    const localCycle = {
      ...cycle("recreated-override-cycle", "Recreated Override Cycle"),
      dateOverrides: {
        "w0-d0": {
          date: "2026-01-06",
          reason: "New override",
          updatedAt: "2026-01-06T10:00:00.000Z",
        },
      },
    };

    const merged = mergeAppData(
      appData({ currentCycle: localCycle }),
      appData({
        deletedDateOverrides: [
          {
            cycleId: localCycle.id,
            overrideKey: "w0-d0",
            deletedAt: "2026-01-05T10:00:00.000Z",
          },
        ],
      }),
      "cloud",
    );

    expect(merged.currentCycle?.dateOverrides?.["w0-d0"]?.reason).toBe(
      "New override",
    );
  });
});
