import type { ProgramSet, ProgramExercise, WeightUnit } from "./types";

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
 * Percentage-based ramp to the first working set weight.
 * Follows the training warm-up protocol recommended by StrongerYou PT
 * and BarBend: bar × 10, then ~40/55/70/85% tiers with descending reps.
 *
 * Tiers that round to the bar weight or duplicate a previous tier
 * are automatically skipped, so lighter working weights get fewer sets.
 */
const WARM_UP_TIERS = [
  { pct: 0.40, reps: "8" },
  { pct: 0.55, reps: "5" },
  { pct: 0.70, reps: "3" },
  { pct: 0.85, reps: "2" },
];

export function generateWarmUpSets(
  firstWorkingWeight: number,
  unit: WeightUnit,
): ProgramSet[] {
  const barWeight = unit === "kg" ? 20 : 45;

  if (firstWorkingWeight <= barWeight) return [];

  const sets: ProgramSet[] = [{ weight: barWeight, targetReps: "10" }];

  for (const tier of WARM_UP_TIERS) {
    const w = mround(firstWorkingWeight * tier.pct, unit);
    const prevWeight = sets[sets.length - 1].weight;
    if (w > barWeight && w < firstWorkingWeight && w !== prevWeight) {
      sets.push({ weight: w, targetReps: tier.reps });
    }
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

  return generateWarmUpSets(firstWeightedSet.weight, unit);
}
