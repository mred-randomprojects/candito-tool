/**
 * Estimated 1RM calculation using the Brzycki formula,
 * which matches the percentage table at strengthlevel.com/one-rep-max-calculator.
 *
 * Formula: 1RM = weight × 36 / (37 − reps)
 */
export function estimate1RM(weight: number, reps: number): number | null {
  if (reps <= 0 || reps >= 37) return null;
  if (reps === 1) return weight;
  return (weight * 36) / (37 - reps);
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
