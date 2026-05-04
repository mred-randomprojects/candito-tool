import type { MainLift, Sex } from "./types";
import { DEFAULT_MAIN_LIFT_NAMES } from "./types";

export type StrengthLevel =
  | "Noob"
  | "Beginner"
  | "Intermediate"
  | "Advanced"
  | "Elite"
  | "Freak";

export type { MainLift };

/**
 * BW-multiplier thresholds separating the 6 strength levels.
 * Each array has 5 values creating 6 bands:
 * [Noob | Beginner | Intermediate | Advanced | Elite | Freak]
 *
 * Derived from the Candito strength standards table.
 * Male Noob upper-bounds (in LBS) are converted to approximate BW ratios
 * using a ~180 lb reference to derive the Noob → Beginner boundary.
 */
const THRESHOLDS: Record<
  Sex,
  Record<MainLift, readonly [number, number, number, number, number]>
> = {
  male: {
    squat: [0.75, 1.25, 1.75, 2.5, 3.0],
    bench: [0.5, 1.0, 1.5, 2.0, 2.25],
    deadlift: [1.25, 1.5, 2.25, 3.0, 3.5],
  },
  female: {
    squat: [0.5, 1.0, 1.5, 1.75, 2.25],
    bench: [0.25, 0.5, 0.75, 1.0, 1.25],
    deadlift: [0.5, 1.25, 1.75, 2.25, 3.0],
  },
};

const LEVELS: readonly StrengthLevel[] = [
  "Noob",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Elite",
  "Freak",
];

export interface StrengthClassification {
  level: StrengthLevel;
  /** The ratio of lift 1RM to body weight. */
  ratio: number;
  /** 0–100 progress toward the next level. null when already Freak. */
  progressToNext: number | null;
  /** The next level. null when already Freak. */
  nextLevel: StrengthLevel | null;
}

export function classifyStrength(
  lift1RM: number,
  bodyWeight: number,
  sex: Sex,
  lift: MainLift,
): StrengthClassification {
  const ratio = lift1RM / bodyWeight;
  const thresholds = THRESHOLDS[sex][lift];

  let levelIndex = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (ratio >= thresholds[i]) {
      levelIndex = i + 1;
    } else {
      break;
    }
  }

  const level = LEVELS[levelIndex];

  if (levelIndex >= LEVELS.length - 1) {
    return { level, ratio, progressToNext: null, nextLevel: null };
  }

  const lowerBound = levelIndex === 0 ? 0 : thresholds[levelIndex - 1];
  const upperBound = thresholds[levelIndex];
  const range = upperBound - lowerBound;
  const progress = range > 0 ? ((ratio - lowerBound) / range) * 100 : 100;

  return {
    level,
    ratio,
    progressToNext: Math.min(Math.max(progress, 0), 100),
    nextLevel: LEVELS[levelIndex + 1],
  };
}

/** Maps a main-lift exercise name to its canonical lift key. */
export function liftFromExerciseName(name: string): MainLift | null {
  if (name === DEFAULT_MAIN_LIFT_NAMES.squat) return "squat";
  if (name === DEFAULT_MAIN_LIFT_NAMES.bench) return "bench";
  if (name === DEFAULT_MAIN_LIFT_NAMES.deadlift) return "deadlift";
  return null;
}

export const LEVEL_COLORS: Record<StrengthLevel, string> = {
  Noob: "text-muted-foreground",
  Beginner: "text-blue-400",
  Intermediate: "text-green-400",
  Advanced: "text-amber-400",
  Elite: "text-purple-400",
  Freak: "text-red-400",
};
