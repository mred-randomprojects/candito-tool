import { describe, expect, it } from "vitest";
import {
  ensureExerciseData,
  mainLiftExerciseIdsFromInputs,
} from "./exerciseCatalog";
import type { CycleData } from "./types";

function cycleWithHipThrust(): CycleData {
  return {
    id: "cycle-1",
    name: "Cycle 1",
    createdAt: "2026-05-04T12:00:00.000Z",
    inputs: {
      startDate: "2026-05-04",
      weightUnit: "kg",
      bench1RM: 100,
      squat1RM: 140,
      deadlift1RM: 180,
      mainLiftNames: { deadlift: "Hip Thrust" },
      horizontalPull: "Dumbbell Row",
      shoulderExercise: "Military Press",
      verticalPull: "Weighted Pull-up",
    },
    workoutLogs: {},
  };
}

describe("exercise catalog migration", () => {
  it("creates catalog exercises and max history from existing cycle inputs", () => {
    const data = ensureExerciseData({
      currentCycle: cycleWithHipThrust(),
      history: [],
      profile: {},
      exercises: {},
      exerciseMaxes: [],
    });

    const ids = mainLiftExerciseIdsFromInputs(data.currentCycle?.inputs);
    expect(data.exercises[ids.deadlift]?.name).toBe("Hip Thrust");
    expect(data.currentCycle?.inputs.mainLiftExerciseIds?.deadlift).toBe(
      ids.deadlift,
    );
    expect(
      data.exerciseMaxes.some(
        (entry) =>
          entry.exerciseId === ids.deadlift &&
          entry.value === 180 &&
          entry.source === "cycle",
      ),
    ).toBe(true);
  });
});
