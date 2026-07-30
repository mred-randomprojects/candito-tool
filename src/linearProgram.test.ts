import { describe, expect, it } from "vitest";
import {
  expectedWorkoutCount,
  findPreviousComparableLogKey,
  generateProgram,
} from "./programEngine";
import { generateLinearProgram } from "./linearProgram";
import { getWarmUpSetsForExercise } from "./warmUp";
import type { ProgramInputs } from "./types";

const baseInputs: ProgramInputs = {
  programType: "linear",
  linearVariant: "control",
  startDate: "2026-07-27",
  weightUnit: "kg",
  bench1RM: 80,
  squat1RM: 100,
  deadlift1RM: 120,
  horizontalPull: "Dumbbell Row",
  shoulderExercise: "Military Press",
  verticalPull: "Weighted Pull-up",
};

describe("generateLinearProgram", () => {
  it("dispatches from generateProgram based on programType", () => {
    const linear = generateProgram(baseInputs);
    expect(linear.weeks).toHaveLength(8);
    expect(linear.weeks[0].workoutDays).toHaveLength(4);

    const sixWeek = generateProgram({ ...baseInputs, programType: undefined });
    expect(sixWeek.weeks).toHaveLength(6);
  });

  it("schedules 4-day variants on Mon/Tue/Thu/Fri offsets", () => {
    const program = generateLinearProgram(baseInputs);
    expect(program.weeks[0].workoutDays.map((d) => d.dayOffset)).toEqual([
      0, 1, 3, 4,
    ]);
    expect(program.weeks[1].workoutDays.map((d) => d.dayOffset)).toEqual([
      7, 8, 10, 11,
    ]);
    expect(program.weeks[0].workoutDays.map((d) => d.label)).toEqual([
      "Heavy Lower",
      "Heavy Upper",
      "Control Lower",
      "Control Upper",
    ]);
  });

  it("starts main lifts at 77.5% rounded to nearest 2.5 kg", () => {
    const program = generateLinearProgram(baseInputs);
    const [squat, deadlift] = program.weeks[0].workoutDays[0].exercises;

    // 100 × 0.775 = 77.5 → 77.5; 120 × 0.775 = 93 → 92.5
    expect(squat).toMatchObject({ isMainLift: true, mainLift: "squat" });
    expect(squat.sets).toHaveLength(3);
    expect(squat.sets[0]).toEqual({ weight: 77.5, targetReps: "6" });
    expect(deadlift.sets).toHaveLength(2);
    expect(deadlift.sets[0]).toEqual({ weight: 92.5, targetReps: "6" });

    const bench = program.weeks[0].workoutDays[1].exercises[0];
    // 80 × 0.775 = 62 → 62.5
    expect(bench).toMatchObject({ mainLift: "bench" });
    expect(bench.sets).toHaveLength(3);
    expect(bench.sets[0]).toEqual({ weight: 62.5, targetReps: "6" });
  });

  it("matches the spreadsheet's MROUND(x, 5) gray cells in lb", () => {
    const program = generateLinearProgram({
      ...baseInputs,
      weightUnit: "lb",
      squat1RM: 100,
      bench1RM: 80,
      deadlift1RM: 100,
    });
    const [squat, deadlift] = program.weeks[0].workoutDays[0].exercises;
    const bench = program.weeks[0].workoutDays[1].exercises[0];

    // Inputs tab 100/80/100 → E5=80, E12=60, E6=80 in the sheet.
    expect(squat.sets[0].weight).toBe(80);
    expect(bench.sets[0].weight).toBe(60);
    expect(deadlift.sets[0].weight).toBe(80);
  });

  it("adds one plate increment per week to main lifts", () => {
    const program = generateLinearProgram(baseInputs);
    const squatWeights = program.weeks.map(
      (week) => week.workoutDays[0].exercises[0].sets[0].weight,
    );
    expect(squatWeights).toEqual([77.5, 80, 82.5, 85, 87.5, 90, 92.5, 95]);
  });

  it("leaves variation and accessory work without prescribed weights", () => {
    const program = generateLinearProgram(baseInputs);
    const controlLower = program.weeks[0].workoutDays[2];
    expect(controlLower.exercises.map((e) => e.name)).toEqual([
      "Pause Squat",
      "Pause Front Squat",
      "Pause Deadlift",
      "Deficit Deadlift",
    ]);
    expect(controlLower.exercises[0].sets).toHaveLength(6);
    expect(controlLower.exercises[0].sets[0]).toEqual({
      weight: null,
      targetReps: "4",
    });

    const controlUpper = program.weeks[0].workoutDays[3];
    expect(controlUpper.exercises.map((e) => e.name)).toEqual([
      "Spoto Press",
      "Pause DB Row",
      "Seated DB Press",
      "Weighted Pullup",
      "JM Press",
      "DB Curl",
    ]);
    expect(
      controlUpper.exercises.every((exercise) =>
        exercise.sets.every((set) => set.weight == null),
      ),
    ).toBe(true);
  });

  it("keeps the heavy days identical across emphases and swaps variation days", () => {
    const power = generateLinearProgram({ ...baseInputs, linearVariant: "power" });
    const hypertrophy = generateLinearProgram({
      ...baseInputs,
      linearVariant: "hypertrophy",
    });

    for (const program of [power, hypertrophy]) {
      expect(program.weeks[0].workoutDays[0].label).toBe("Heavy Lower");
      expect(program.weeks[0].workoutDays[1].label).toBe("Heavy Upper");
    }

    expect(power.weeks[0].workoutDays[2].exercises[0].name).toBe(
      "Explosive Squat (jump or box squat)",
    );
    // No explosive upper day exists — Power reuses the Control upper day.
    expect(power.weeks[0].workoutDays[3].label).toBe("Control Upper");
    expect(power.weeks[0].workoutDays[3].exercises[0].name).toBe("Spoto Press");

    expect(
      hypertrophy.weeks[0].workoutDays[2].exercises.map((e) => e.name),
    ).toEqual([
      "Back or Front Squat",
      "Deadlift Variation",
      "Hamstring Curl",
      "Calf Raise",
      "Optional Accessory 1",
      "Optional Accessory 2",
    ]);
    expect(hypertrophy.weeks[0].workoutDays[3].exercises).toHaveLength(8);
  });

  it("runs the 3-day schedule Mon/Wed/Fri and alternates the variation day", () => {
    const program = generateLinearProgram({
      ...baseInputs,
      linearVariant: "three-day",
    });
    expect(program.weeks[0].workoutDays.map((d) => d.dayOffset)).toEqual([
      0, 2, 4,
    ]);
    expect(program.weeks[1].workoutDays.map((d) => d.dayOffset)).toEqual([
      7, 9, 11,
    ]);
    // Week A ends on the lower variation, Week B on the upper one.
    expect(program.weeks[0].workoutDays[2].label).toBe("Control Lower");
    expect(program.weeks[1].workoutDays[2].label).toBe("Control Upper");
    expect(program.weeks[2].workoutDays[2].label).toBe("Control Lower");
  });

  it("honors linearWeekCount and defaults to 8", () => {
    expect(
      generateLinearProgram({ ...baseInputs, linearWeekCount: 3 }).weeks,
    ).toHaveLength(3);
    expect(
      generateLinearProgram({ ...baseInputs, linearWeekCount: undefined }).weeks,
    ).toHaveLength(8);
  });

  it("generates warm-ups for main lifts and honors custom names", () => {
    const program = generateLinearProgram({
      ...baseInputs,
      mainLiftNames: { squat: "Low Bar Squat" },
    });
    const squat = program.weeks[0].workoutDays[0].exercises[0];
    expect(squat.name).toBe("Low Bar Squat");
    expect(getWarmUpSetsForExercise(squat, "kg").length).toBeGreaterThan(0);

    const pauseSquat = program.weeks[0].workoutDays[2].exercises[0];
    expect(getWarmUpSetsForExercise(pauseSquat, "kg")).toHaveLength(0);
  });
});

describe("expectedWorkoutCount", () => {
  it("counts scheduled days per program shape", () => {
    expect(expectedWorkoutCount(baseInputs)).toBe(32);
    expect(
      expectedWorkoutCount({ ...baseInputs, linearVariant: "three-day" }),
    ).toBe(24);
    expect(
      expectedWorkoutCount({ ...baseInputs, linearWeekCount: 10 }),
    ).toBe(40);
    expect(
      expectedWorkoutCount({ ...baseInputs, programType: undefined }),
    ).toBe(16);
  });
});

describe("findPreviousComparableLogKey", () => {
  it("returns the previous week's slot when templates match", () => {
    const program = generateLinearProgram(baseInputs);
    expect(findPreviousComparableLogKey(program, 1, 0)).toBe("w0-d0");
    expect(findPreviousComparableLogKey(program, 0, 0)).toBeNull();
  });

  it("skips alternating 3-day variation weeks until a matching one", () => {
    const program = generateLinearProgram({
      ...baseInputs,
      linearVariant: "three-day",
    });
    // Week 3's Control Lower slot last appeared in week 1, not week 2.
    expect(findPreviousComparableLogKey(program, 2, 2)).toBe("w0-d2");
    expect(findPreviousComparableLogKey(program, 1, 2)).toBeNull();
    expect(findPreviousComparableLogKey(program, 2, 0)).toBe("w1-d0");
  });
});
