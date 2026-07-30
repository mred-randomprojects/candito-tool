import { describe, expect, it } from "vitest";
import {
  failedSessionStreak,
  progressionWarningForExercise,
  sessionFailedForExercise,
} from "./progressionInsights";
import type { ExerciseLog, ProgramExercise, SetLog } from "./types";

function mainLift(targetReps: string, setCount: number): ProgramExercise {
  return {
    name: "Squat",
    isMainLift: true,
    mainLift: "squat",
    hasWarmUp: true,
    sets: Array.from({ length: setCount }, () => ({
      weight: 100,
      targetReps,
    })),
    notes: [],
  };
}

function setLog(actualReps: number | null): SetLog {
  return {
    actualReps,
    difficulty: null,
    actualWeight: null,
    prescribedWeight: 100,
    notes: "",
  };
}

function exerciseLog(...reps: (number | null)[]): ExerciseLog {
  return { setLogs: reps.map(setLog) };
}

describe("sessionFailedForExercise", () => {
  it("fails when any logged set is under the minimum target", () => {
    const exercise = mainLift("6", 3);
    expect(sessionFailedForExercise(exercise, exerciseLog(6, 6, 5))).toBe(true);
    expect(sessionFailedForExercise(exercise, exerciseLog(6, 6, 6))).toBe(false);
  });

  it("uses the lower bound of rep ranges", () => {
    const exercise = mainLift("6-12", 3);
    expect(sessionFailedForExercise(exercise, exerciseLog(6, 6, 6))).toBe(false);
    expect(sessionFailedForExercise(exercise, exerciseLog(6, 5, 6))).toBe(true);
  });

  it("ignores unlogged sets and missing logs", () => {
    const exercise = mainLift("6", 3);
    expect(sessionFailedForExercise(exercise, exerciseLog(null, null, null))).toBe(
      false,
    );
    expect(sessionFailedForExercise(exercise, undefined)).toBe(false);
  });
});

describe("failedSessionStreak", () => {
  it("counts consecutive misses from the most recent session", () => {
    const exercise = mainLift("6", 3);
    const failed = exerciseLog(6, 5, 6);
    const passed = exerciseLog(6, 6, 6);
    expect(failedSessionStreak(exercise, [failed, failed, passed, failed])).toBe(
      2,
    );
    expect(failedSessionStreak(exercise, [passed, failed])).toBe(0);
    expect(failedSessionStreak(exercise, [])).toBe(0);
  });
});

describe("progressionWarningForExercise", () => {
  const exercise = mainLift("6", 3);
  const failed = exerciseLog(6, 5, 6);
  const passed = exerciseLog(6, 6, 6);

  it("advises a reset drop in the cycle's unit after a single miss", () => {
    const warning = progressionWarningForExercise(exercise, [failed], "kg");
    expect(warning?.severity).toBe("reset");
    expect(warning?.message).toContain("7.5 kg");

    const lbWarning = progressionWarningForExercise(exercise, [failed], "lb");
    expect(lbWarning?.message).toContain("15 lb");
  });

  it("escalates to stall advice after three straight misses", () => {
    const warning = progressionWarningForExercise(
      exercise,
      [failed, failed, failed],
      "kg",
    );
    expect(warning?.severity).toBe("stall");
    expect(warning?.message).toContain("every 2 weeks");
  });

  it("stays quiet for passing sessions and non-main lifts", () => {
    expect(progressionWarningForExercise(exercise, [passed], "kg")).toBeNull();
    const accessory: ProgramExercise = {
      ...mainLift("6", 3),
      isMainLift: false,
      mainLift: undefined,
    };
    expect(progressionWarningForExercise(accessory, [failed], "kg")).toBeNull();
  });
});
