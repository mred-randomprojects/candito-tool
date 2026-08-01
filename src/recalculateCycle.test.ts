import { describe, expect, it } from "vitest";
import { generateProgram } from "./programEngine";
import { withLinearIncrement } from "./linearProgram";
import { recalculateIncompleteWorkoutLogs } from "./recalculateCycle";
import { verifyWorkoutLogPrescription } from "./trainingMaxSnapshot";
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
    expect(
      verifyWorkoutLogPrescription(
        updated["w0-d3"],
        updated["w0-d3"].calculatedFrom!,
      ),
    ).toBe("signed");
    expect(updated["w0-d3"].exerciseLogs[0].setLogs[0].actualReps).toBe(3);
    expect(updated["w0-d3"].notes).toBe("still going");
  });

  it("represcribes incomplete linear weeks when a weekly raise changes", () => {
    const linearInputs: ProgramInputs = {
      ...baseInputs,
      programType: "linear",
      linearVariant: "control",
      squat1RM: 100,
    };
    const oldProgram = generateProgram(linearInputs);
    const completedWeek2Weight =
      oldProgram.weeks[1].workoutDays[0].exercises[0].sets[0].weight;
    const cycle: CycleData = {
      id: "cycle-1",
      name: "Cycle 1",
      inputs: linearInputs,
      createdAt: "2026-05-04T00:00:00.000Z",
      workoutLogs: {
        "w1-d0": logForFirstExercise(completedWeek2Weight, true),
      },
    };

    const nextInputs = withLinearIncrement(linearInputs, "squat", 2, 5);
    const updated = recalculateIncompleteWorkoutLogs(cycle, nextInputs);

    // The completed week keeps its snapshotted prescription…
    expect(
      updated["w1-d0"].exerciseLogs[0].setLogs[0].prescribedWeight,
    ).toBe(completedWeek2Weight);
    // …while later weeks pick up the bigger raise (77.5 + 5 + 2.5 = 85).
    expect(
      updated["w2-d0"].exerciseLogs[0].setLogs[0].prescribedWeight,
    ).toBe(85);
    expect(
      verifyWorkoutLogPrescription(
        updated["w2-d0"],
        updated["w2-d0"].calculatedFrom!,
      ),
    ).toBe("signed");
  });

  it("materializes future days so recalculation has stored snapshots", () => {
    const cycle: CycleData = {
      id: "cycle-1",
      name: "Cycle 1",
      inputs: baseInputs,
      createdAt: "2026-05-04T00:00:00.000Z",
      workoutLogs: {},
    };
    const nextInputs: ProgramInputs = {
      ...baseInputs,
      bench1RM: 110,
    };
    const nextProgram = generateProgram(nextInputs);
    const updated = recalculateIncompleteWorkoutLogs(cycle, nextInputs);
    const materializedLog = updated["w0-d1"];

    expect(materializedLog.startedAt).toBeNull();
    expect(materializedLog.completed).toBe(false);
    expect(materializedLog.calculatedFrom?.bench1RM).toBe(110);
    expect(materializedLog.exerciseLogs[0].setLogs[0].prescribedWeight).toBe(
      nextProgram.weeks[0].workoutDays[1].exercises[0].sets[0].weight,
    );
    expect(
      verifyWorkoutLogPrescription(
        materializedLog,
        materializedLog.calculatedFrom!,
      ),
    ).toBe("signed");

    const tamperedLog: WorkoutLog = {
      ...materializedLog,
      exerciseLogs: materializedLog.exerciseLogs.map((exerciseLog, exerciseIndex) =>
        exerciseIndex === 0
          ? {
              ...exerciseLog,
              setLogs: exerciseLog.setLogs.map((setLog, setIndex) =>
                setIndex === 0
                  ? {
                      ...setLog,
                      prescribedWeight: (setLog.prescribedWeight ?? 0) + 5,
                    }
                  : setLog,
              ),
            }
          : exerciseLog,
      ),
    };

    expect(
      verifyWorkoutLogPrescription(
        tamperedLog,
        tamperedLog.calculatedFrom!,
      ),
    ).toBe("mismatch");
  });
});
