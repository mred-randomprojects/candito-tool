import type { SetLog } from "./types";

export function emptySetLog(prescribedWeight: number | null = null): SetLog {
  return {
    actualReps: null,
    difficulty: null,
    actualWeight: null,
    prescribedWeight,
    notes: "",
  };
}
