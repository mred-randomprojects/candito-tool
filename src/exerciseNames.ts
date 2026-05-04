import {
  DEFAULT_MAIN_LIFT_NAMES,
  type MainLift,
  type ProgramInputs,
} from "./types";

export function cleanExerciseName(
  value: string | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  return trimmed != null && trimmed.length > 0 ? trimmed : fallback;
}

export function mainLiftNamesFromInputs(
  inputs: ProgramInputs | undefined,
): Record<MainLift, string> {
  return {
    bench: cleanExerciseName(
      inputs?.mainLiftNames?.bench,
      DEFAULT_MAIN_LIFT_NAMES.bench,
    ),
    squat: cleanExerciseName(
      inputs?.mainLiftNames?.squat,
      DEFAULT_MAIN_LIFT_NAMES.squat,
    ),
    deadlift: cleanExerciseName(
      inputs?.mainLiftNames?.deadlift,
      DEFAULT_MAIN_LIFT_NAMES.deadlift,
    ),
  };
}

export function normalizeMainLiftNames(
  names: Record<MainLift, string>,
): Record<MainLift, string> {
  return {
    bench: cleanExerciseName(names.bench, DEFAULT_MAIN_LIFT_NAMES.bench),
    squat: cleanExerciseName(names.squat, DEFAULT_MAIN_LIFT_NAMES.squat),
    deadlift: cleanExerciseName(
      names.deadlift,
      DEFAULT_MAIN_LIFT_NAMES.deadlift,
    ),
  };
}

export function variationName(
  lift: MainLift,
  names: Record<MainLift, string>,
): string {
  const defaultName = DEFAULT_MAIN_LIFT_NAMES[lift];
  const customName = cleanExerciseName(names[lift], defaultName);
  return customName === defaultName
    ? `${defaultName} Variation`
    : `${customName} Variation`;
}
