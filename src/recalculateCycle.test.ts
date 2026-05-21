import { describe, expect, it } from "vitest";
import { generateProgram } from "./programEngine";
import { recalculateIncompleteWorkoutLogs } from "./recalculateCycle";
import type { CycleData, ProgramInputs, WorkoutLog } from "./types";

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

function logForFirstExercise(
  prescribedWeight: number | null,
  completed: boolean,
): WorkoutLog {
  return {
    completed,
    startedAt: completed ? "2026-05-04T10:00:00.000Z" : "2026-05-08T10:00:00.000Z",
    completedAt: completed ? "2026-05-04T11:00:00.000Z" : null,
    exerciseLogs: [
      {
        setLogs: [
          {
            actualReps: completed ? 6 : 3,
            difficulty: completed ? 3 : 2,
            actualWeight: prescribedWeight,
            prescribedWeight,
            notes: completed ? "done" : "partial",
          },
        ],
      },
    ],
    notes: completed ? "finished" : "still going",
  };
}

describe("recalculateIncompleteWorkoutLogs", () => {
  it("updates unfinished prescriptions while keeping completed days locked", () => {
    const oldProgram = generateProgram(baseInputs);
    const oldCompletedWeight =
      oldProgram.weeks[0].workoutDays[0].exercises[0].sets[0].weight;
    const oldUnfinishedWeight =
      oldProgram.weeks[0].workoutDays[3].exercises[0].sets[0].weight;
    const cycle: CycleData = {
      id: "cycle-1",
      name: "Cycle 1",
      inputs: baseInputs,
      createdAt: "2026-05-04T00:00:00.000Z",
      workoutLogs: {
        "w0-d0": logForFirstExercise(oldCompletedWeight, true),
        "w0-d3": logForFirstExercise(oldUnfinishedWeight, false),
      },
    };

    const nextInputs: ProgramInputs = {
      ...baseInputs,
      squat1RM: 100,
    };

    const updated = recalculateIncompleteWorkoutLogs(cycle, nextInputs);

    expect(updated["w0-d0"].calculatedFrom?.squat1RM).toBe(140);
    expect(
      updated["w0-d0"].exerciseLogs[0].setLogs[0].prescribedWeight,
    ).toBe(oldCompletedWeight);

    expect(updated["w0-d3"].calculatedFrom?.squat1RM).toBe(100);
    expect(
      updated["w0-d3"].exerciseLogs[0].setLogs[0].prescribedWeight,
    ).toBe(70);
    expect(updated["w0-d3"].exerciseLogs[0].setLogs[0].actualReps).toBe(3);
    expect(updated["w0-d3"].notes).toBe("still going");
  });
});
