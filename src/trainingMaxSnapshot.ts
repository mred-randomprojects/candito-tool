import type {
  MainLift,
  ProgramInputs,
  SetLog,
  TrainingMaxSnapshot,
  WeightUnit,
  WorkoutDay,
  WorkoutLog,
} from "./types";
import { mainLiftExerciseIdsFromInputs } from "./exerciseCatalog";
import { mainLiftNamesFromInputs } from "./exerciseNames";
import { getWarmUpSetsForExercise } from "./warmUp";

const MAIN_LIFTS: MainLift[] = ["bench", "squat", "deadlift"];
const PRESCRIPTION_SIGNATURE_VERSION = "prescription-v1";

export type PrescriptionSignatureStatus = "signed" | "unsigned" | "mismatch";

export function snapshotFromInputs(inputs: ProgramInputs): TrainingMaxSnapshot {
  return {
    weightUnit: inputs.weightUnit,
    bench1RM: inputs.bench1RM,
    squat1RM: inputs.squat1RM,
    deadlift1RM: inputs.deadlift1RM,
    mainLiftNames: mainLiftNamesFromInputs(inputs),
    mainLiftExerciseIds: mainLiftExerciseIdsFromInputs(inputs),
  };
}

export function snapshotsEqual(
  a: TrainingMaxSnapshot,
  b: TrainingMaxSnapshot,
): boolean {
  return (
    a.weightUnit === b.weightUnit &&
    a.bench1RM === b.bench1RM &&
    a.squat1RM === b.squat1RM &&
    a.deadlift1RM === b.deadlift1RM &&
    MAIN_LIFTS.every(
      (lift) =>
        (a.mainLiftNames?.[lift] ?? "") === (b.mainLiftNames?.[lift] ?? "") &&
        (a.mainLiftExerciseIds?.[lift] ?? "") ===
          (b.mainLiftExerciseIds?.[lift] ?? ""),
    )
  );
}

export function formatTrainingMaxValue(value: number): string {
  return Number.parseFloat(value.toFixed(2)).toString();
}

export function formatTrainingMaxSnapshot(
  snapshot: TrainingMaxSnapshot,
): string {
  return `B/S/D ${formatTrainingMaxValue(snapshot.bench1RM)} / ${formatTrainingMaxValue(snapshot.squat1RM)} / ${formatTrainingMaxValue(snapshot.deadlift1RM)} ${snapshot.weightUnit}`;
}

export function trainingMaxSnapshotTitle(
  snapshot: TrainingMaxSnapshot,
): string {
  const names = snapshot.mainLiftNames;
  return [
    `${names?.bench ?? "Bench"} ${formatTrainingMaxValue(snapshot.bench1RM)} ${snapshot.weightUnit}`,
    `${names?.squat ?? "Squat"} ${formatTrainingMaxValue(snapshot.squat1RM)} ${snapshot.weightUnit}`,
    `${names?.deadlift ?? "Deadlift"} ${formatTrainingMaxValue(snapshot.deadlift1RM)} ${snapshot.weightUnit}`,
  ].join(", ");
}

function normalizedSnapshot(snapshot: TrainingMaxSnapshot) {
  return {
    weightUnit: snapshot.weightUnit,
    bench1RM: snapshot.bench1RM,
    squat1RM: snapshot.squat1RM,
    deadlift1RM: snapshot.deadlift1RM,
    mainLiftNames: {
      bench: snapshot.mainLiftNames?.bench ?? "",
      squat: snapshot.mainLiftNames?.squat ?? "",
      deadlift: snapshot.mainLiftNames?.deadlift ?? "",
    },
    mainLiftExerciseIds: {
      bench: snapshot.mainLiftExerciseIds?.bench ?? "",
      squat: snapshot.mainLiftExerciseIds?.squat ?? "",
      deadlift: snapshot.mainLiftExerciseIds?.deadlift ?? "",
    },
  };
}

function normalizedWeight(weight: number | null | undefined): number | null {
  if (weight == null) return null;
  return Number.parseFloat(weight.toFixed(4));
}

function prescribedWeightsFromLog(log: WorkoutLog) {
  return log.exerciseLogs.map((exerciseLog) => ({
    sets: exerciseLog.setLogs.map((setLog) =>
      normalizedWeight(setLog.prescribedWeight),
    ),
    warmUps: (exerciseLog.warmUpSetLogs ?? []).map((setLog) =>
      normalizedWeight(setLog.prescribedWeight),
    ),
  }));
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function prescriptionSignatureForLog(
  log: WorkoutLog,
  calculatedFrom: TrainingMaxSnapshot,
): string {
  const payload = JSON.stringify({
    version: PRESCRIPTION_SIGNATURE_VERSION,
    calculatedFrom: normalizedSnapshot(calculatedFrom),
    prescribedWeights: prescribedWeightsFromLog(log),
  });
  return `${PRESCRIPTION_SIGNATURE_VERSION}:${fnv1a32(payload)}`;
}

export function signWorkoutLogPrescription(
  log: WorkoutLog,
  calculatedFrom: TrainingMaxSnapshot,
): WorkoutLog {
  const signedLog = {
    ...log,
    calculatedFrom,
  };
  return {
    ...signedLog,
    prescriptionSignature: prescriptionSignatureForLog(signedLog, calculatedFrom),
  };
}

export function verifyWorkoutLogPrescription(
  log: WorkoutLog,
  calculatedFrom: TrainingMaxSnapshot,
): PrescriptionSignatureStatus {
  if (log.prescriptionSignature == null) return "unsigned";
  return log.prescriptionSignature ===
    prescriptionSignatureForLog(log, calculatedFrom)
    ? "signed"
    : "mismatch";
}

function emptySetLog(prescribedWeight: number | null): SetLog {
  return {
    actualReps: null,
    difficulty: null,
    actualWeight: null,
    prescribedWeight,
    notes: "",
  };
}

function rewritePrescribedWeight(
  previous: SetLog | undefined,
  prescribedWeight: number | null,
): SetLog {
  return {
    ...(previous ?? emptySetLog(prescribedWeight)),
    prescribedWeight,
  };
}

export function resyncWorkoutLogPrescription(
  day: WorkoutDay,
  log: WorkoutLog,
  weightUnit: WeightUnit,
  calculatedFrom: TrainingMaxSnapshot,
): WorkoutLog {
  return signWorkoutLogPrescription({
    ...log,
    exerciseLogs: day.exercises.map((exercise, exerciseIndex) => {
      const previousExerciseLog = log.exerciseLogs[exerciseIndex];
      const warmUps = getWarmUpSetsForExercise(exercise, weightUnit);
      return {
        setLogs: exercise.sets.map((set, setIndex) =>
          rewritePrescribedWeight(
            previousExerciseLog?.setLogs[setIndex],
            set.weight,
          ),
        ),
        ...(warmUps.length > 0 || previousExerciseLog?.warmUpSetLogs != null
          ? {
              warmUpSetLogs: warmUps.map((set, setIndex) =>
                rewritePrescribedWeight(
                  previousExerciseLog?.warmUpSetLogs?.[setIndex],
                  set.weight,
                ),
              ),
            }
          : {}),
      };
    }),
  }, calculatedFrom);
}
