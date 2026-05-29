import { generateProgram } from "./programEngine";
import type { CycleData, ProgramInputs, WorkoutLog } from "./types";
import {
  resyncWorkoutLogPrescription,
  snapshotFromInputs,
  signWorkoutLogPrescription,
} from "./trainingMaxSnapshot";

export function recalculateIncompleteWorkoutLogs(
  cycle: CycleData,
  nextInputs: ProgramInputs,
  updatedAt = new Date().toISOString(),
): Record<string, WorkoutLog> {
  const previousSnapshot = snapshotFromInputs(cycle.inputs);
  const nextSnapshot = snapshotFromInputs(nextInputs);
  const nextProgram = generateProgram(nextInputs);
  const recalculatedLogs: Record<string, WorkoutLog> = {};
  const programLogKeys = new Set<string>();

  nextProgram.weeks.forEach((week, weekIndex) => {
    week.workoutDays.forEach((day, dayIndex) => {
      const key = `w${weekIndex}-d${dayIndex}`;
      programLogKeys.add(key);
      const existingLog = cycle.workoutLogs[key];
      if (existingLog?.completed === true) {
        const calculatedFrom = existingLog.calculatedFrom ?? previousSnapshot;
        recalculatedLogs[key] =
          existingLog.prescriptionSignature == null
            ? signWorkoutLogPrescription(
                { ...existingLog, calculatedFrom },
                calculatedFrom,
              )
            : { ...existingLog, calculatedFrom };
        return;
      }

      recalculatedLogs[key] = resyncWorkoutLogPrescription(
        day,
        existingLog ?? {
          completed: false,
          startedAt: null,
          completedAt: null,
          exerciseLogs: [],
          notes: "",
        },
        nextInputs.weightUnit,
        nextSnapshot,
      );
      recalculatedLogs[key].updatedAt = updatedAt;
    });
  });

  Object.entries(cycle.workoutLogs).forEach(([key, log]) => {
    if (programLogKeys.has(key)) return;
    const calculatedFrom = log.completed
      ? log.calculatedFrom ?? previousSnapshot
      : nextSnapshot;
    recalculatedLogs[key] = {
      ...(log.prescriptionSignature == null
        ? signWorkoutLogPrescription({ ...log, calculatedFrom }, calculatedFrom)
        : { ...log, calculatedFrom }),
      updatedAt,
    };
  });

  return recalculatedLogs;
}
