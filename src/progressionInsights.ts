import type { ExerciseLog, ProgramExercise, WeightUnit } from "./types";

/**
 * Candito's reset ladder from the original program guide:
 * miss a weight → drop only that lift ~15 lb (7.5 kg) the next week;
 * after 3 resets on a lift → progress it every 2 weeks instead;
 * failing more than 3 times at that pace → take a break (run a 6-week cycle).
 */

function minTargetReps(targetReps: string): number | null {
  const trimmed = targetReps.trim();
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch != null) return parseInt(rangeMatch[1], 10);
  const fixedMatch = trimmed.match(/^(\d+)$/);
  if (fixedMatch != null) return parseInt(fixedMatch[1], 10);
  return null;
}

/**
 * A session counts as failed for an exercise when any logged set came in
 * under the minimum target reps. Sets without logged reps (skipped or not
 * recorded) are ignored rather than treated as misses.
 */
export function sessionFailedForExercise(
  exercise: ProgramExercise,
  exerciseLog: ExerciseLog | undefined,
): boolean {
  if (exerciseLog == null) return false;
  return exercise.sets.some((set, setIndex) => {
    const target = minTargetReps(set.targetReps);
    if (target == null) return false;
    const actualReps = exerciseLog.setLogs[setIndex]?.actualReps;
    return actualReps != null && actualReps < target;
  });
}

/**
 * Counts consecutive failed sessions for an exercise, starting from the
 * most recent. `exerciseLogs` must be ordered most recent first; the streak
 * breaks at the first session that was completed without a miss.
 */
export function failedSessionStreak(
  exercise: ProgramExercise,
  exerciseLogs: (ExerciseLog | undefined)[],
): number {
  let streak = 0;
  for (const exerciseLog of exerciseLogs) {
    if (!sessionFailedForExercise(exercise, exerciseLog)) break;
    streak += 1;
  }
  return streak;
}

export function resetDropAmount(unit: WeightUnit): string {
  return unit === "kg" ? "7.5 kg" : "15 lb";
}

export interface ProgressionWarning {
  severity: "reset" | "stall";
  message: string;
}

export function progressionWarningForExercise(
  exercise: ProgramExercise,
  exerciseLogs: (ExerciseLog | undefined)[],
  unit: WeightUnit,
): ProgressionWarning | null {
  if (!exercise.isMainLift) return null;
  const streak = failedSessionStreak(exercise, exerciseLogs);
  if (streak >= 3) {
    return {
      severity: "stall",
      message:
        `Missed reps ${streak} sessions in a row. Candito: after 3 resets, ` +
        "progress this lift every 2 weeks instead of weekly — and if that " +
        "still fails, take a break from the program (run a 6-week cycle).",
    };
  }
  if (streak >= 1) {
    return {
      severity: "reset",
      message:
        `Missed target reps last session — drop this lift ~${resetDropAmount(unit)} ` +
        "and build back up. Keep your other lifts progressing normally.",
    };
  }
  return null;
}
