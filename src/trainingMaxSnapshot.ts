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
  return {
    ...log,
    calculatedFrom,
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
  };
}
