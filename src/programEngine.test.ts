import { describe, expect, it } from "vitest";
import { generateProgram } from "./programEngine";
import { getWarmUpSetsForExercise } from "./warmUp";
import type { ProgramInputs } from "./types";

const baseInputs: ProgramInputs = {
  startDate: "2026-05-04",
  weightUnit: "kg",
  bench1RM: 100,
  squat1RM: 140,
  deadlift1RM: 180,
  horizontalPull: "Dumbbell Row",
  shoulderExercise: "Military Press",
  verticalPull: "Weighted Pull-up",
};

describe("generateProgram", () => {
  it("uses custom main lift names while preserving canonical lift behavior", () => {
    const program = generateProgram({
      ...baseInputs,
      mainLiftNames: { deadlift: "Hip Thrust" },
    });

    const week1Lower = program.weeks[0].workoutDays[0].exercises;
    expect(week1Lower[1]).toMatchObject({
      name: "Hip Thrust",
      mainLift: "deadlift",
      isMainLift: true,
    });
    expect(getWarmUpSetsForExercise(week1Lower[1], "kg").length).toBeGreaterThan(0);

    const week2Lower = program.weeks[1].workoutDays[0].exercises;
    expect(week2Lower[2].name).toBe("Hip Thrust Variation");
  });
});
