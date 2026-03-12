import { describe, it, expect } from "vitest";
import { estimate1RM } from "./oneRepMax";
import type { WeightUnit } from "./types";

// ---------------------------------------------------------------------------
// Ideal warm-ups extracted from ChatGPT coaching screenshots
// ---------------------------------------------------------------------------

interface WarmUpSet {
  weight: number;
  reps: number;
}

interface TestCase {
  label: string;
  exercise: "Bench Press" | "Squat" | "Deadlift";
  workingWeight: number;
  workingReps: number;
  unit: WeightUnit;
  ideal: WarmUpSet[];
}

const TEST_CASES: TestCase[] = [
  {
    label: "Bench Press 92.5 kg × 1-4",
    exercise: "Bench Press",
    workingWeight: 92.5,
    workingReps: 2,
    unit: "kg",
    ideal: [
      { weight: 20, reps: 10 },
      { weight: 40, reps: 5 },
      { weight: 60, reps: 3 },
      { weight: 75, reps: 2 },
      { weight: 85, reps: 1 },
    ],
  },
  {
    label: "Squat 107.5 kg × 1-4",
    exercise: "Squat",
    workingWeight: 107.5,
    workingReps: 2,
    unit: "kg",
    ideal: [
      { weight: 20, reps: 10 },
      { weight: 40, reps: 5 },
      { weight: 60, reps: 4 },
      { weight: 80, reps: 3 },
      { weight: 90, reps: 2 },
      { weight: 100, reps: 1 },
    ],
  },
  {
    label: "Deadlift 162.5 kg × 1-4",
    exercise: "Deadlift",
    workingWeight: 162.5,
    workingReps: 2,
    unit: "kg",
    ideal: [
      { weight: 60, reps: 5 },
      { weight: 80, reps: 4 },
      { weight: 100, reps: 3 },
      { weight: 120, reps: 2 },
      { weight: 140, reps: 1 },
      { weight: 155, reps: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mround(value: number, unit: WeightUnit): number {
  const multiple = unit === "kg" ? 2.5 : 5;
  return Math.round(value / multiple) * multiple;
}

function startWeight(exercise: string, unit: WeightUnit): number {
  // Deadlift needs plates for bar height (20kg bar + 20kg each side)
  if (exercise === "Deadlift") return unit === "kg" ? 60 : 135;
  return unit === "kg" ? 20 : 45;
}

function effortPct(
  warmUpWeight: number,
  warmUpReps: number,
  workingWeight: number,
  workingReps: number,
): number {
  const wu1RM = estimate1RM(warmUpWeight, warmUpReps);
  const w1RM = estimate1RM(workingWeight, workingReps);
  if (wu1RM == null || w1RM == null || w1RM === 0) return 0;
  return (wu1RM / w1RM) * 100;
}

// Rep sequence: first set gets 10 (bar) or 5 (deadlift), rest fill from tail
const REP_LADDER = [10, 5, 4, 3, 2, 1];

function assignReps(count: number, isDeadlift: boolean): number[] {
  if (count <= 0) return [];
  // Deadlift starts at 5, others at 10
  const firstRep = isDeadlift ? 5 : 10;
  // Remaining reps come from the tail of the ladder (5,4,3,2,1)
  const tail = [5, 4, 3, 2, 1];
  const remaining = count - 1;
  const repsFromTail = tail.slice(Math.max(0, tail.length - remaining));
  return [firstRep, ...repsFromTail];
}

// ---------------------------------------------------------------------------
// STRATEGY A: Current — fixed percentage tiers
// ---------------------------------------------------------------------------

function strategyA(tc: TestCase): WarmUpSet[] {
  const bar = startWeight(tc.exercise, tc.unit);
  const w = tc.workingWeight;
  if (w <= bar) return [];

  const tiers = [
    { pct: 0.40, reps: 8 },
    { pct: 0.55, reps: 5 },
    { pct: 0.70, reps: 3 },
    { pct: 0.85, reps: 2 },
  ];

  const sets: WarmUpSet[] = [{ weight: bar, reps: tc.exercise === "Deadlift" ? 5 : 10 }];
  for (const tier of tiers) {
    const tw = mround(w * tier.pct, tc.unit);
    const prev = sets[sets.length - 1].weight;
    if (tw > bar && tw < w && tw !== prev) {
      sets.push({ weight: tw, reps: tier.reps });
    }
  }
  return sets;
}

// ---------------------------------------------------------------------------
// STRATEGY B: ~20 kg jumps, shrinking near the top
// ---------------------------------------------------------------------------

function strategyB(tc: TestCase): WarmUpSet[] {
  const start = startWeight(tc.exercise, tc.unit);
  const w = tc.workingWeight;
  if (w <= start) return [];

  const bigStep = tc.unit === "kg" ? 20 : 45;
  const smallStep = tc.unit === "kg" ? 10 : 25;
  // Switch to small steps when within this range of the working weight
  const smallStepThreshold = w - (tc.unit === "kg" ? 30 : 60);

  const weights: number[] = [start];
  let current = start;
  while (true) {
    const step = current >= smallStepThreshold ? smallStep : bigStep;
    const next = mround(current + step, tc.unit);
    if (next >= w) break;
    weights.push(next);
    current = next;
  }

  // Add a top single at ~92% if the last weight is below 90%
  const last = weights[weights.length - 1];
  const topTarget = mround(w * 0.92, tc.unit);
  if (topTarget > last && topTarget < w) {
    weights.push(topTarget);
  }

  const reps = assignReps(weights.length, tc.exercise === "Deadlift");
  return weights.map((wt, i) => ({ weight: wt, reps: reps[i] }));
}

// ---------------------------------------------------------------------------
// STRATEGY C: Even distribution of N sets from start to ~92%
// ---------------------------------------------------------------------------

function strategyC(tc: TestCase): WarmUpSet[] {
  const start = startWeight(tc.exercise, tc.unit);
  const w = tc.workingWeight;
  if (w <= start) return [];

  const top = w * 0.92;
  const gap = top - start;
  const bigStep = tc.unit === "kg" ? 20 : 45;
  // Aim for ~20kg jumps, capped at 3-6 intermediate sets
  const n = Math.min(6, Math.max(3, Math.round(gap / bigStep)));
  const stepSize = gap / n;

  const weights: number[] = [];
  for (let i = 0; i <= n; i++) {
    weights.push(mround(start + i * stepSize, tc.unit));
  }

  // Deduplicate
  const unique = weights.filter((wt, i) => i === 0 || wt !== weights[i - 1]);

  const reps = assignReps(unique.length, tc.exercise === "Deadlift");
  return unique.map((wt, i) => ({ weight: wt, reps: reps[i] }));
}

// ---------------------------------------------------------------------------
// STRATEGY D: 20 kg jumps + 1RM-derived reps (extra-effort interpolation)
//
// Instead of a hardcoded rep ladder, we solve for the rep count at each
// weight using the Brzycki formula.
//
// Key insight: for any warm-up weight W, the minimum possible effort
// (at 1 rep) is W / workingWeight. Extra reps add "extra effort" on top.
// We linearly interpolate that extra from the first set (high reps, most
// extra) down to zero at the last set (1 rep, no extra).
//
// Solving Brzycki for reps:
//   targetEffort = estimate1RM(W, R) / workingWeight
//   R = 37 − (W × 36) / (targetEffort × workingWeight)
// ---------------------------------------------------------------------------

function generateWeightsD(tc: TestCase): number[] {
  const start = startWeight(tc.exercise, tc.unit);
  const w = tc.workingWeight;
  if (w <= start) return [];

  const bigStep = tc.unit === "kg" ? 20 : 45;
  const smallStep = tc.unit === "kg" ? 10 : 25;
  const smallStepThreshold = w * 0.75;

  const weights: number[] = [start];
  let current = start;
  while (true) {
    const step = current >= smallStepThreshold ? smallStep : bigStep;
    const next = mround(current + step, tc.unit);
    // Stop if next would be >= 95% of working weight
    if (next >= w * 0.95) break;
    weights.push(next);
    current = next;
  }

  // Add a top single at ~92% if last weight is below ~88%
  const last = weights[weights.length - 1];
  const topTarget = mround(w * 0.92, tc.unit);
  if (topTarget > last && topTarget < w) {
    weights.push(topTarget);
  }

  return weights;
}

function solveRepsForEffort(
  warmUpWeight: number,
  targetEffort: number,
  workingWeight: number,
): number {
  // R = 37 − (W × 36) / (targetEffort × workingWeight)
  const r = 37 - (warmUpWeight * 36) / (targetEffort * workingWeight);
  return Math.min(10, Math.max(1, Math.round(r)));
}

function strategyD(tc: TestCase): WarmUpSet[] {
  const weights = generateWeightsD(tc);
  if (weights.length === 0) return [];

  const w = tc.workingWeight;
  const n = weights.length;
  const isDL = tc.exercise === "Deadlift";

  // First set: fixed reps (10 for bar-start, 5 for deadlift)
  const firstReps = isDL ? 5 : 10;
  // Last set: always 1 rep
  const lastReps = 1;

  // Compute effort boundaries
  const first1RM = estimate1RM(weights[0], firstReps);
  const last1RM = estimate1RM(weights[n - 1], lastReps);
  if (first1RM == null || last1RM == null) return [];

  const firstEffort = first1RM / w;
  const lastEffort = last1RM / w;

  // Min effort at each weight (1-rep floor)
  const minEffortFirst = weights[0] / w;
  const extraFirst = firstEffort - minEffortFirst;

  const sets: WarmUpSet[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      sets.push({ weight: weights[i], reps: firstReps });
    } else if (i === n - 1) {
      sets.push({ weight: weights[i], reps: lastReps });
    } else {
      // Linearly interpolate extra effort from extraFirst → 0
      const fraction = i / (n - 1);
      const extraI = extraFirst * (1 - fraction);
      const minEffortI = weights[i] / w;
      const targetEffort = minEffortI + extraI;
      const reps = solveRepsForEffort(weights[i], targetEffort, w);
      sets.push({ weight: weights[i], reps });
    }
  }

  return sets;
}

// ---------------------------------------------------------------------------
// Scoring: how close is a strategy's output to the ideal?
// ---------------------------------------------------------------------------

interface Score {
  setCountDiff: number;
  avgWeightError: number;
  avgRepError: number;
  avgEffortError: number;
  effortProfile: number[];
}

function score(generated: WarmUpSet[], tc: TestCase): Score {
  const idealEffort = tc.ideal.map((s) =>
    effortPct(s.weight, s.reps, tc.workingWeight, tc.workingReps),
  );
  const genEffort = generated.map((s) =>
    effortPct(s.weight, s.reps, tc.workingWeight, tc.workingReps),
  );

  // Pair up sets (pad shorter array with zeros)
  const maxLen = Math.max(tc.ideal.length, generated.length);
  let weightErrSum = 0;
  let repErrSum = 0;
  let effortErrSum = 0;
  for (let i = 0; i < maxLen; i++) {
    const idealW = tc.ideal[i]?.weight ?? 0;
    const genW = generated[i]?.weight ?? 0;
    const idealR = tc.ideal[i]?.reps ?? 0;
    const genR = generated[i]?.reps ?? 0;
    const idealE = idealEffort[i] ?? 0;
    const genE = genEffort[i] ?? 0;
    weightErrSum += Math.abs(idealW - genW);
    repErrSum += Math.abs(idealR - genR);
    effortErrSum += Math.abs(idealE - genE);
  }

  return {
    setCountDiff: Math.abs(tc.ideal.length - generated.length),
    avgWeightError: weightErrSum / maxLen,
    avgRepError: repErrSum / maxLen,
    avgEffortError: effortErrSum / maxLen,
    effortProfile: genEffort,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function formatSets(sets: WarmUpSet[], tc: TestCase): string {
  return sets
    .map((s) => {
      const eff = effortPct(s.weight, s.reps, tc.workingWeight, tc.workingReps);
      return `  ${String(s.weight).padStart(5)} ${tc.unit} × ${String(s.reps).padStart(2)}  (effort ${eff.toFixed(1)}%)`;
    })
    .join("\n");
}

const STRATEGIES = [
  { name: "A: % tiers", fn: strategyA },
  { name: "B: 20kg jumps", fn: strategyB },
  { name: "C: even dist", fn: strategyC },
  { name: "D: 1RM reps", fn: strategyD },
] as const;

describe("warm-up strategy comparison", () => {
  for (const tc of TEST_CASES) {
    describe(tc.label, () => {
      it("prints ideal warm-up", () => {
        console.log(`\n=== IDEAL: ${tc.label} ===`);
        console.log(formatSets(tc.ideal, tc));
      });

      for (const strat of STRATEGIES) {
        it(`strategy ${strat.name}`, () => {
          const generated = strat.fn(tc);
          const s = score(generated, tc);

          console.log(`\n--- ${strat.name}: ${tc.label} ---`);
          console.log(formatSets(generated, tc));
          console.log(
            `  Sets: ${generated.length} (ideal ${tc.ideal.length}, diff ${s.setCountDiff})` +
              ` | Avg weight err: ${s.avgWeightError.toFixed(1)} kg` +
              ` | Avg rep err: ${s.avgRepError.toFixed(1)}` +
              ` | Avg effort err: ${s.avgEffortError.toFixed(1)}%`,
          );

          // Soft assertion: strategies should produce 3-7 sets
          expect(generated.length).toBeGreaterThanOrEqual(3);
          expect(generated.length).toBeLessThanOrEqual(7);

          // Weights should be strictly ascending
          for (let i = 1; i < generated.length; i++) {
            expect(generated[i].weight).toBeGreaterThan(generated[i - 1].weight);
          }

          // Last warm-up should be below working weight
          expect(generated[generated.length - 1].weight).toBeLessThan(
            tc.workingWeight,
          );
        });
      }

      it("summary scores", () => {
        console.log(`\n>>> SCORES for ${tc.label}:`);
        for (const strat of STRATEGIES) {
          const generated = strat.fn(tc);
          const s = score(generated, tc);
          console.log(
            `  ${strat.name.padEnd(15)} → sets diff: ${s.setCountDiff}  |  wt err: ${s.avgWeightError.toFixed(1)} kg  |  rep err: ${s.avgRepError.toFixed(1)}  |  effort err: ${s.avgEffortError.toFixed(1)}%`,
          );
        }
      });
    });
  }
});
