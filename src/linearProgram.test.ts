import { describe, expect, it } from "vitest";
import {
  expectedWorkoutCount,
  findPreviousComparableLogKey,
  findPreviousComparableSessions,
  generateProgram,
} from "./programEngine";
import {
  controlStartLoad,
  generateLinearProgram,
  linearIncrementChoices,
  linearIncrementChoicesForInputs,
  linearIncrementForWeek,
  withLinearIncrement,
} from "./linearProgram";
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

  it("matches the original guide's control days, logged by feel", () => {
    const program = generateLinearProgram(baseInputs);
    const controlLower = program.weeks[0].workoutDays[2];
    expect(controlLower.exercises.map((e) => e.name)).toEqual([
      "Pause Squat",
      "Pause Deadlift",
      "Optional Accessory 1",
      "Optional Accessory 2",
    ]);
    expect(controlLower.exercises[0].sets).toHaveLength(6);
    expect(controlLower.exercises[0].sets[0]).toEqual({
      weight: null,
      targetReps: "4",
    });

    const controlUpper = program.weeks[0].workoutDays[3];
    expect(controlUpper.exercises.map((e) => e.name)).toEqual([
      "Spoto Press",
      "Pause Dumbbell Row",
      "Military Press",
      "Weighted Pull-up",
      "Optional Accessory 1",
      "Optional Accessory 2",
    ]);
    // The guide prescribes single sets for the shoulder/vertical-pull slots.
    expect(controlUpper.exercises[2].sets).toHaveLength(1);
    expect(controlUpper.exercises[3].sets).toHaveLength(1);
    expect(
      controlUpper.exercises.every((exercise) =>
        exercise.sets.every((set) => set.weight == null),
      ),
    ).toBe(true);

    const heavyUpper = program.weeks[0].workoutDays[1];
    expect(heavyUpper.exercises[2].sets).toEqual([
      { weight: null, targetReps: "6" },
    ]);
    expect(heavyUpper.exercises[3].sets).toEqual([
      { weight: null, targetReps: "6" },
    ]);
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
      "Weighted Explosive Exercise 1",
    );
    expect(power.weeks[0].workoutDays[2].exercises[2].sets).toHaveLength(5);
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

  it("applies chosen weekly raises cumulatively without touching other lifts", () => {
    const program = generateLinearProgram({
      ...baseInputs,
      linearIncrements: { squat: { 2: 5, 3: 0 } },
    });

    const squatWeights = program.weeks.map(
      (week) => week.workoutDays[0].exercises[0].sets[0].weight,
    );
    // Week 2 +5, week 3 +0, then back to the +2.5 default.
    expect(squatWeights.slice(0, 5)).toEqual([77.5, 82.5, 82.5, 85, 87.5]);

    const deadliftWeights = program.weeks.map(
      (week) => week.workoutDays[0].exercises[1].sets[0].weight,
    );
    expect(deadliftWeights.slice(0, 3)).toEqual([92.5, 95, 97.5]);
    expect(program.weeks[1].workoutDays[1].exercises[0].sets[0].weight).toBe(65);
  });

  it("supports the guide's reset drop after missed reps", () => {
    const program = generateLinearProgram({
      ...baseInputs,
      linearIncrements: { deadlift: { 3: -7.5 } },
    });
    const deadliftWeights = program.weeks.map(
      (week) => week.workoutDays[0].exercises[1].sets[0].weight,
    );
    expect(deadliftWeights.slice(0, 4)).toEqual([92.5, 95, 87.5, 90]);
  });

  it("breaks the subtitle out per lift once progression diverges", () => {
    const plain = generateLinearProgram(baseInputs);
    expect(plain.weeks[0].subtitle).toContain("main lifts at 77.5% 1RM");
    expect(plain.weeks[1].subtitle).toContain("main lifts +2.5 kg vs Week 1");

    const diverged = generateLinearProgram({
      ...baseInputs,
      linearIncrements: { bench: { 2: 0 } },
    });
    expect(diverged.weeks[1].subtitle).toContain(
      "B +0 / S +2.5 / D +2.5 kg vs Week 1",
    );
    expect(diverged.weeks[2].subtitle).toContain(
      "B +2.5 / S +5 / D +5 kg vs Week 1",
    );
  });

  it("records raises via withLinearIncrement without mutating the inputs", () => {
    const next = withLinearIncrement(baseInputs, "squat", 2, 5);
    expect(next).not.toBe(baseInputs);
    expect(baseInputs.linearIncrements).toBeUndefined();
    expect(next.linearIncrements?.squat?.[2]).toBe(5);
    expect(linearIncrementForWeek(next, "squat", 2)).toBe(5);
    expect(linearIncrementForWeek(next, "squat", 3)).toBe(2.5);
    expect(linearIncrementForWeek(next, "bench", 2)).toBe(2.5);

    // Unchanged values and invalid targets return the same inputs object.
    expect(withLinearIncrement(next, "squat", 2, 5)).toBe(next);
    expect(withLinearIncrement(baseInputs, "squat", 1, 5)).toBe(baseInputs);
    expect(withLinearIncrement(baseInputs, "squat", 2, Number.NaN)).toBe(
      baseInputs,
    );
  });

  it("offers the guide's raise choices per unit, reset drop first", () => {
    expect(linearIncrementChoices("kg")).toEqual([-7.5, 0, 2.5, 5, 7.5]);
    expect(linearIncrementChoices("lb")).toEqual([-15, 0, 5, 10]);
  });

  it("keeps custom raises used in the cycle among the chip choices", () => {
    expect(linearIncrementChoicesForInputs(baseInputs)).toEqual(
      linearIncrementChoices("kg"),
    );

    const withCustom = withLinearIncrement(baseInputs, "squat", 2, 10);
    expect(linearIncrementChoicesForInputs(withCustom)).toEqual([
      -7.5, 0, 2.5, 5, 7.5, 10,
    ]);

    // Standard picks add no duplicates; customs from any lift are merged.
    const withStandard = withLinearIncrement(withCustom, "bench", 3, 5);
    const withMore = withLinearIncrement(withStandard, "deadlift", 4, 12.5);
    expect(linearIncrementChoicesForInputs(withMore)).toEqual([
      -7.5, 0, 2.5, 5, 7.5, 10, 12.5,
    ]);
  });

  it("names the upper accessory slots after the exercises picked at setup", () => {
    const program = generateLinearProgram({
      ...baseInputs,
      horizontalPull: "Barbell Row",
      shoulderExercise: "Seated Dumbbell OHP",
      verticalPull: "Lat Pulldown",
    });

    const heavyUpper = program.weeks[0].workoutDays[1];
    expect(heavyUpper.exercises.map((e) => e.name)).toEqual([
      "Bench Press",
      "Barbell Row",
      "Seated Dumbbell OHP",
      "Lat Pulldown",
      "Optional Accessory 1",
      "Optional Accessory 2",
    ]);

    // Every week regenerates with the same names, so past sessions stay
    // comparable after a mid-cycle change of selection.
    expect(findPreviousComparableLogKey(program, 3, 1)).toBe("w2-d1");

    const hypertrophy = generateLinearProgram({
      ...baseInputs,
      linearVariant: "hypertrophy",
      horizontalPull: "Machine Row",
    });
    const hypertrophyUpper = hypertrophy.weeks[0].workoutDays[3];
    expect(hypertrophyUpper.exercises.map((e) => e.name)).toContain(
      "Machine Row",
    );
    expect(hypertrophyUpper.exercises.map((e) => e.name)).toContain(
      "Weighted Pull-up",
    );
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

  it("lists up to N previous sessions, most recent first", () => {
    const program = generateLinearProgram(baseInputs);
    const sessions = findPreviousComparableSessions(program, 6, 0, 5);
    expect(sessions.map((s) => s.logKey)).toEqual([
      "w5-d0",
      "w4-d0",
      "w3-d0",
      "w2-d0",
      "w1-d0",
    ]);
    expect(sessions[0].weekNumber).toBe(6);
    expect(findPreviousComparableSessions(program, 2, 0, 5)).toHaveLength(2);
  });

  it("only lists alternating 3-day variation weeks that match", () => {
    const program = generateLinearProgram({
      ...baseInputs,
      linearVariant: "three-day",
    });
    const sessions = findPreviousComparableSessions(program, 6, 2, 5);
    expect(sessions.map((s) => s.logKey)).toEqual(["w4-d2", "w2-d2", "w0-d2"]);
  });
});

describe("control-day references", () => {
  it("tags pause variations with the main lift they mirror", () => {
    const program = generateLinearProgram(baseInputs);
    const [controlLower, controlUpper] = program.weeks[0].workoutDays.slice(2);

    expect(controlLower.exercises[0]).toMatchObject({
      name: "Pause Squat",
      controlOf: "squat",
      isMainLift: false,
    });
    expect(controlLower.exercises[1]).toMatchObject({
      name: "Pause Deadlift",
      controlOf: "deadlift",
    });
    expect(controlUpper.exercises[0]).toMatchObject({
      name: "Spoto Press",
      controlOf: "bench",
    });
    // The paused row mirrors an accessory, not a tracked main lift.
    expect(controlUpper.exercises[1].controlOf).toBeUndefined();
  });

  it("does not tag heavy-day main lifts", () => {
    const program = generateLinearProgram(baseInputs);
    const heavyExercises = program.weeks[0].workoutDays
      .slice(0, 2)
      .flatMap((day) => day.exercises);
    expect(heavyExercises.every((ex) => ex.controlOf == null)).toBe(true);
  });

  it("keeps the Spoto Press tag on the power variant's control upper day", () => {
    const program = generateLinearProgram({
      ...baseInputs,
      linearVariant: "power",
    });
    const controlUpper = program.weeks[0].workoutDays[3];
    expect(controlUpper.exercises[0]).toMatchObject({
      name: "Spoto Press",
      controlOf: "bench",
    });
  });

  it("computes the guide's ~70% starting load with plate rounding", () => {
    // 100 × 0.7 = 70 → 70; 120 × 0.7 = 84 → 85; 80 × 0.7 = 56 → 55 (kg, 2.5)
    expect(controlStartLoad(baseInputs, "squat")).toBe(70);
    expect(controlStartLoad(baseInputs, "deadlift")).toBe(85);
    expect(controlStartLoad(baseInputs, "bench")).toBe(55);

    // 315 × 0.7 = 220.5 → 220 (lb, MROUND 5)
    expect(
      controlStartLoad(
        { ...baseInputs, weightUnit: "lb", squat1RM: 315 },
        "squat",
      ),
    ).toBe(220);
  });
});
