import type { ExerciseLog, SetLog } from "./types";

export function emptySetLog(prescribedWeight: number | null = null): SetLog {
  return {
    actualReps: null,
    difficulty: null,
    actualWeight: null,
    prescribedWeight,
    notes: "",
  };
}

/** Compact "60×8, 60×8, 60×7" summary of an exercise's logged sets. */
export function formatLoggedSets(
  exerciseLog: ExerciseLog | undefined,
): string | null {
  if (exerciseLog == null) return null;
  const parts = exerciseLog.setLogs
    .map((setLog) => {
      if (setLog.actualReps == null && setLog.actualWeight == null) return null;
      const weight = setLog.actualWeight ?? setLog.prescribedWeight;
      const weightPart = weight != null ? String(weight) : "—";
      const repsPart = setLog.actualReps != null ? String(setLog.actualReps) : "?";
      return `${weightPart}×${repsPart}`;
    })
    .filter((part): part is string => part != null);
  return parts.length > 0 ? parts.join(", ") : null;
}
