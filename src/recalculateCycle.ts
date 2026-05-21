import { generateProgram } from "./programEngine";
import type { CycleData, ProgramInputs, WorkoutLog } from "./types";
import {
  resyncWorkoutLogPrescription,
  snapshotFromInputs,
} from "./trainingMaxSnapshot";

function parseWorkoutLogKey(key: string): { weekIndex: number; dayIndex: number } | null {
  const match = /^w(\d+)-d(\d+)$/.exec(key);
  if (match == null) return null;
  return {
    weekIndex: Number(match[1]),
    dayIndex: Number(match[2]),
  };
}

export function recalculateIncompleteWorkoutLogs(
  cycle: CycleData,
  nextInputs: ProgramInputs,
): Record<string, WorkoutLog> {
  const previousSnapshot = snapshotFromInputs(cycle.inputs);
  const nextSnapshot = snapshotFromInputs(nextInputs);
  const nextProgram = generateProgram(nextInputs);

  return Object.fromEntries(
    Object.entries(cycle.workoutLogs).map(([key, log]) => {
      if (log.completed) {
        return [
          key,
          {
            ...log,
            calculatedFrom: log.calculatedFrom ?? previousSnapshot,
          },
        ];
      }

      const indexes = parseWorkoutLogKey(key);
      const nextDay =
        indexes != null
          ? nextProgram.weeks[indexes.weekIndex]?.workoutDays[indexes.dayIndex]
          : undefined;

      return [
        key,
        nextDay != null
          ? resyncWorkoutLogPrescription(
              nextDay,
              log,
              nextInputs.weightUnit,
              nextSnapshot,
            )
          : {
              ...log,
              calculatedFrom: nextSnapshot,
            },
      ];
    }),
  );
}
