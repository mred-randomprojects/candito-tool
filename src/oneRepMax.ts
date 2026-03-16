/**
 * Estimated 1RM using the same hybrid approach as strengthlevel.com:
 *   - Reps 1–10 → Brzycki: weight × 36 / (37 − reps)
 *   - Reps 11+  → Epley:   weight × (1 + reps / 30)
 *
 * Both formulas give identical results at 10 reps (multiplier = 4/3),
 * so the transition is seamless. Epley doesn't break at high rep ranges
 * like Brzycki does (which is undefined at 37 reps).
 */
export function estimate1RM(weight: number, reps: number): number | null {
  if (reps <= 0) return null;
  if (reps === 1) return weight;
  if (reps <= 10) {
    return (weight * 36) / (37 - reps);
  }
  return weight * (1 + reps / 30);
}

/**
 * Inverse of estimate1RM: given a 1RM, returns the weight you can
 * lift for a given rep count, using the same hybrid Brzycki/Epley approach.
 */
export function weightForReps(oneRM: number, reps: number): number | null {
  if (reps <= 0) return null;
  if (reps === 1) return oneRM;
  if (reps <= 10) {
    return (oneRM * (37 - reps)) / 36;
  }
  return oneRM / (1 + reps / 30);
}

/**
 * Parses a targetReps string and returns the estimated 1RM (or a range).
 * Returns null when the estimate isn't meaningful (bodyweight, MR, etc.).
 */
export function estimateFromPrescription(
  weight: number | null,
  targetReps: string,
): { low: number; high: number } | null {
  if (weight == null || weight <= 0) return null;

  const trimmed = targetReps.trim();

  // Range like "4-6" or "8-12"
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch != null) {
    const lowReps = parseInt(rangeMatch[1], 10);
    const highReps = parseInt(rangeMatch[2], 10);
    const estLow = estimate1RM(weight, lowReps);
    const estHigh = estimate1RM(weight, highReps);
    if (estLow == null || estHigh == null) return null;
    return { low: estLow, high: estHigh };
  }

  // Fixed number like "6"
  const fixedMatch = trimmed.match(/^(\d+)$/);
  if (fixedMatch != null) {
    const reps = parseInt(fixedMatch[1], 10);
    const est = estimate1RM(weight, reps);
    if (est == null) return null;
    return { low: est, high: est };
  }

  // MR, MR10, or anything else → can't estimate
  return null;
}

export function format1RM(
  estimate: { low: number; high: number },
  unit: string,
): string {
  const lo = estimate.low.toFixed(1);
  const hi = estimate.high.toFixed(1);
  if (lo === hi) return `${lo} ${unit}`;
  return `${lo}–${hi} ${unit}`;
}
