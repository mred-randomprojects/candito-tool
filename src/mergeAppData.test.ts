import { describe, expect, it } from "vitest";
import { mergeAppData } from "./mergeAppData";
import type { AppData, CycleData } from "./types";

function cycle(id: string, name: string): CycleData {
  return {
    id,
    name,
    createdAt: "2026-01-01T00:00:00.000Z",
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

describe("mergeAppData", () => {
  it("keeps cloud phone data when the local device is empty", () => {
    const local: AppData = {
      currentCycle: null,
      history: [],
      profile: {},
    };
    const phoneCycle = cycle("cycle-phone", "Phone Cycle");
    const cloud: AppData = {
      currentCycle: phoneCycle,
      history: [],
      profile: { bodyWeight: 80, sex: "male" },
    };

    const merged = mergeAppData(local, cloud);

    expect(merged.currentCycle?.id).toBe("cycle-phone");
    expect(merged.currentCycle?.workoutLogs["w0-d0"].notes).toBe("phone data");
    expect(merged.profile.bodyWeight).toBe(80);
  });

  it("merges local and cloud cycles without dropping either side", () => {
    const localCycle = cycle("local-cycle", "Local Cycle");
    const cloudCycle = cycle("cloud-cycle", "Cloud Cycle");

    const merged = mergeAppData(
      { currentCycle: localCycle, history: [], profile: {} },
      { currentCycle: cloudCycle, history: [], profile: {} },
    );

    expect(merged.currentCycle?.id).toBe("local-cycle");
    expect(merged.history.map((c) => c.id)).toContain("cloud-cycle");
  });
});
