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
 * 1RM-aware warm-up set generation (Strategy E).
 *
 * ## Weight selection
 *
 * Weights ramp from a starting point (empty bar for bench/squat, 60 kg
 * for deadlift due to bar-height requirements) toward the working weight.
 * The step size is the smaller of ~20 kg and half the start→workingWeight
 * range, so sub-maximal working sets naturally get fewer warm-up sets.
 * Once the weight crosses 75% of the working weight, jumps shrink to
 * ~10 kg for finer control near the top. A final set is placed at ~92%
 * of the working weight if one isn't already there.
 *
 * ## Rep assignment (1RM-normalised extra-effort interpolation)
 *
 * Reps are derived from the Brzycki/Epley 1RM formula so each warm-up
 * set lands at a physiologically appropriate effort level relative to
 * the lifter's true 1RM (not just the working weight).
 *
 * For any warm-up at weight W, the minimum possible effort (at 1 rep)
 * is W / oneRepMax. Additional reps add "extra effort" on top of that
 * floor. We interpolate extra effort from the first set (high — e.g.
 * bar × 10) down to a target at the last set derived from 75% of the
 * working set's effort. A parabolic mid-set boost, scaled by how far
 * below max the working weight is, ensures adequate reps when the
 * entire warm-up sits in a low-effort range.
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

  const range = workingWeight - start;
  const bigStep = unit === "kg" ? 20 : 45;
  const smallStep = unit === "kg" ? 10 : 25;
  const effectiveBigStep = Math.min(bigStep, mround(range / 2, unit));
  const smallStepThreshold = workingWeight * 0.75;

  const weights: number[] = [start];
  let current = start;
  while (true) {
    const step =
      current >= smallStepThreshold ? smallStep : effectiveBigStep;
    const next = mround(current + step, unit);
    if (next >= workingWeight * 0.95) break;
    weights.push(next);
    current = next;
  }

  const last = weights[weights.length - 1];
  const topTarget = mround(workingWeight * 0.92, unit);
  if (topTarget > last && topTarget < workingWeight) {
    weights.push(topTarget);
  }

  return weights;
}

/**
 * Solves for the rep count that yields a given estimated 1RM at a
 * particular weight. Uses Brzycki for 1–10 reps, Epley for 11+.
 */
function solveRepsFor1RM(
  weight: number,
  target1RM: number,
): number {
  const rBrzycki = 37 - (weight * 36) / target1RM;
  if (rBrzycki >= 1 && rBrzycki <= 10) {
    return Math.round(rBrzycki);
  }
  if (rBrzycki > 10) {
    const rEpley = 30 * (target1RM / weight - 1);
    return Math.min(15, Math.max(1, Math.round(rEpley)));
  }
  return 1;
}

/**
 * Generates warm-up sets for a given working weight.
 *
 * @param oneRepMax — the lifter's true 1RM for this exercise. When
 *   provided, reps are scaled to the actual max so sub-maximal working
 *   sets get appropriately lighter warm-ups. When omitted, falls back
 *   to estimating the 1RM as workingWeight (near-max assumption).
 */
export function generateWarmUpSets(
  workingWeight: number,
  exercise: string,
  unit: WeightUnit,
  oneRepMax?: number,
): ProgramSet[] {
  const oneRM = oneRepMax ?? workingWeight;
  const weights = generateWeights(workingWeight, exercise, unit);
  if (weights.length === 0) return [];

  const n = weights.length;
  const isDL = exercise === "Deadlift";
  const intensity = workingWeight / oneRM;
  const firstReps = isDL ? 5 : 10;

  const first1RM = estimate1RM(weights[0], firstReps);
  if (first1RM == null) return [];

  const firstEffort = first1RM / oneRM;
  const firstMinEffort = weights[0] / oneRM;
  const extraFirst = firstEffort - firstMinEffort;

  const workingEst = estimate1RM(workingWeight, 1);
  const workingEffort =
    workingEst != null ? workingEst / oneRM : workingWeight / oneRM;

  const lastMinEffort = weights[n - 1] / oneRM;
  const lastExtra = Math.max(0, workingEffort * 0.75 - lastMinEffort);

  const midBoost = 0.06 * Math.max(0, 1 - intensity);

  const sets: ProgramSet[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      sets.push({ weight: weights[i], targetReps: String(firstReps) });
    } else {
      const fraction = i / (n - 1);
      const linearExtra =
        extraFirst + fraction * (lastExtra - extraFirst);
      const parabolic = midBoost * 4 * fraction * (1 - fraction);
      const minEffortI = weights[i] / oneRM;
      const targetEffort = minEffortI + linearExtra + parabolic;
      const target1RM = targetEffort * oneRM;
      const reps = solveRepsFor1RM(weights[i], target1RM);
      sets.push({ weight: weights[i], targetReps: String(reps) });
    }
  }

  return sets;
}

/**
 * Returns warm-up sets for an exercise, or an empty array if it
 * isn't one of the three main lifts or has no weighted sets.
 *
 * @param oneRepMax — the lifter's true 1RM. When omitted, assumes
 *   the working weight is near-max (which is correct for most
 *   Candito program sets).
 */
export function getWarmUpSetsForExercise(
  exercise: ProgramExercise,
  unit: WeightUnit,
  oneRepMax?: number,
): ProgramSet[] {
  if (!WARM_UP_LIFTS.has(exercise.name)) return [];

  const firstWeightedSet = exercise.sets.find((s) => s.weight != null);
  if (firstWeightedSet == null || firstWeightedSet.weight == null) return [];

  return generateWarmUpSets(
    firstWeightedSet.weight,
    exercise.name,
    unit,
    oneRepMax,
  );
}
