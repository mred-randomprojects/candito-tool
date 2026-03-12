import type { ProgramSet, ProgramExercise, WeightUnit } from "./types";
import { estimate1RM } from "./oneRepMax";

/**
 * Exercises that receive auto-generated warm-up sets.
 * Only the three competition lifts — accessory work and variations
 * are done after the main lift is already warm.
 */
const WARM_UP_LIFTS = new Set(["Bench Press", "Squat", "Deadlift"]);

function mround(value: number, unit: WeightUnit): number {
  const multiple = unit === "kg" ? 2.5 : 5;
  return Math.round(value / multiple) * multiple;
}

/**
 * Warm-up set generation using 20 kg jumps + 1RM-derived rep counts.
 *
 * ## Weight selection
 *
 * Weights ramp from a starting point (empty bar for bench/squat, 60 kg
 * for deadlift due to bar-height requirements) in ~20 kg increments.
 * Once the weight crosses 75% of the working weight, jumps shrink to
 * ~10 kg for finer control near the top. A final set is placed at ~92%
 * of the working weight if one isn't already there.
 *
 * ## Rep assignment (extra-effort interpolation)
 *
 * Instead of a hardcoded rep ladder, reps are derived from the Brzycki
 * 1RM formula so each warm-up set lands at a physiologically appropriate
 * effort level.
 *
 * For any warm-up at weight W, the *minimum* possible effort (at 1 rep)
 * is simply W / workingWeight. Additional reps add "extra effort" on
 * top of that floor. We linearly interpolate the extra effort from the
 * first set (high — e.g. bar × 10) down to zero at the last set (single
 * at ~92%). Then we solve Brzycki for the rep count that hits that target:
 *
 *   targetEffort = (W / workingWeight) + extraEffort_i
 *   reps = 37 − (W × 36) / (targetEffort × workingWeight)
 *
 * This naturally produces more reps at light weights (movement practice,
 * blood flow) and fewer reps as the bar gets heavy (joint acclimation
 * without fatigue), while keeping the overall effort ramp smooth.
 *
 * Validated against expert coaching recommendations — see warmUp.test.ts
 * for detailed comparisons and scoring against ideal warm-up profiles.
 */

function startWeight(exercise: string, unit: WeightUnit): number {
  if (exercise === "Deadlift") return unit === "kg" ? 60 : 135;
  return unit === "kg" ? 20 : 45;
}

function generateWeights(
  workingWeight: number,
  exercise: string,
  unit: WeightUnit,
): number[] {
  const start = startWeight(exercise, unit);
  if (workingWeight <= start) return [];

  const bigStep = unit === "kg" ? 20 : 45;
  const smallStep = unit === "kg" ? 10 : 25;
  const smallStepThreshold = workingWeight * 0.75;

  const weights: number[] = [start];
  let current = start;
  while (true) {
    const step = current >= smallStepThreshold ? smallStep : bigStep;
    const next = mround(current + step, unit);
    if (next >= workingWeight * 0.95) break;
    weights.push(next);
    current = next;
  }

  // Place a top single at ~92% if the last weight is below that
  const last = weights[weights.length - 1];
  const topTarget = mround(workingWeight * 0.92, unit);
  if (topTarget > last && topTarget < workingWeight) {
    weights.push(topTarget);
  }

  return weights;
}

function solveRepsForEffort(
  warmUpWeight: number,
  targetEffort: number,
  workingWeight: number,
): number {
  const r = 37 - (warmUpWeight * 36) / (targetEffort * workingWeight);
  return Math.min(10, Math.max(1, Math.round(r)));
}

export function generateWarmUpSets(
  workingWeight: number,
  exercise: string,
  unit: WeightUnit,
): ProgramSet[] {
  const weights = generateWeights(workingWeight, exercise, unit);
  if (weights.length === 0) return [];

  const n = weights.length;
  const isDL = exercise === "Deadlift";
  const firstReps = isDL ? 5 : 10;

  const first1RM = estimate1RM(weights[0], firstReps);
  if (first1RM == null) return [];

  const firstEffort = first1RM / workingWeight;
  const minEffortFirst = weights[0] / workingWeight;
  const extraFirst = firstEffort - minEffortFirst;

  const sets: ProgramSet[] = [];
  for (let i = 0; i < n; i++) {
    let reps: number;
    if (i === 0) {
      reps = firstReps;
    } else if (i === n - 1) {
      reps = 1;
    } else {
      const fraction = i / (n - 1);
      const extraI = extraFirst * (1 - fraction);
      const minEffortI = weights[i] / workingWeight;
      const targetEffort = minEffortI + extraI;
      reps = solveRepsForEffort(weights[i], targetEffort, workingWeight);
    }
    sets.push({ weight: weights[i], targetReps: String(reps) });
  }

  return sets;
}

/**
 * Returns warm-up sets for an exercise, or an empty array if it
 * isn't one of the three main lifts or has no weighted sets.
 */
export function getWarmUpSetsForExercise(
  exercise: ProgramExercise,
  unit: WeightUnit,
): ProgramSet[] {
  if (!WARM_UP_LIFTS.has(exercise.name)) return [];

  const firstWeightedSet = exercise.sets.find((s) => s.weight != null);
  if (firstWeightedSet == null || firstWeightedSet.weight == null) return [];

  return generateWarmUpSets(firstWeightedSet.weight, exercise.name, unit);
}
