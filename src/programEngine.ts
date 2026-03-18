import type {
  ProgramInputs,
  Program,
  ProgramWeek,
  WorkoutDay,
  ProgramExercise,
  ProgramSet,
  WeightUnit,
} from "./types";
import { weightForReps } from "./oneRepMax";

/**
 * Rounds a weight to the nearest plate increment.
 * kg → nearest 2.5, lb → nearest 5.
 */
function mround(value: number, unit: WeightUnit): number {
  const multiple = unit === "kg" ? 2.5 : 5;
  return Math.round(value / multiple) * multiple;
}

function plateIncrement(unit: WeightUnit): number {
  return unit === "kg" ? 2.5 : 5;
}

// --- Shorthand builders ---

function ws(weight: number, reps: string): ProgramSet {
  return { weight, targetReps: reps };
}

function accessory(reps: string): ProgramSet {
  return { weight: null, targetReps: reps };
}

interface AccessoryWeightConfig {
  unit: WeightUnit;
  hp1RM?: number;
  sh1RM?: number;
  vp1RM?: number;
}

/**
 * The accessory "working 1RM" is 85% of the entered 1RM.
 * Weight for a given rep count is derived from that working 1RM.
 */
const ACCESSORY_WORKING_PERCENTAGE = 0.85;

function parseMinReps(targetReps: string): number | null {
  const trimmed = targetReps.trim();
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch != null) return parseInt(rangeMatch[1], 10);
  const fixedMatch = trimmed.match(/^(\d+)$/);
  if (fixedMatch != null) return parseInt(fixedMatch[1], 10);
  return null;
}

function computeAccessoryWeight(
  oneRM: number,
  targetReps: string,
  unit: WeightUnit,
): number | null {
  const reps = parseMinReps(targetReps);
  if (reps == null) return null;
  const working1RM = oneRM * ACCESSORY_WORKING_PERCENTAGE;
  const weight = weightForReps(working1RM, reps);
  if (weight == null) return null;
  return mround(weight, unit);
}

function exercise(
  name: string,
  isMainLift: boolean,
  sets: ProgramSet[],
  notes: string[] = [],
): ProgramExercise {
  return { name, isMainLift, hasWarmUp: true, sets, notes };
}

function workout(
  dayOffset: number,
  type: "lower" | "upper",
  exercises: ProgramExercise[],
  notes: string[] = [],
): WorkoutDay {
  return { dayOffset, type, exercises, notes };
}

// --- Common accessory patterns ---

function upperAccessories(
  hp: string,
  sh: string,
  vp: string,
  hpReps: string[],
  shReps: string[],
  vpReps: string[],
  includeOptional: boolean,
  optionalReps?: string[],
  accW?: AccessoryWeightConfig,
): ProgramExercise[] {
  function accSet(reps: string, oneRM: number | undefined): ProgramSet {
    if (oneRM == null || accW == null) return accessory(reps);
    return { weight: computeAccessoryWeight(oneRM, reps, accW.unit), targetReps: reps };
  }

  const result: ProgramExercise[] = [
    exercise(
      hp,
      false,
      hpReps.map((r) => accSet(r, accW?.hp1RM)),
    ),
    exercise(
      sh,
      false,
      shReps.map((r) => accSet(r, accW?.sh1RM)),
    ),
    exercise(
      vp,
      false,
      vpReps.map((r) => accSet(r, accW?.vp1RM)),
    ),
  ];
  if (includeOptional && optionalReps) {
    result.push(
      exercise(
        "Optional Exercise 1",
        false,
        optionalReps.map((r) => accessory(r)),
      ),
      exercise(
        "Optional Exercise 2",
        false,
        optionalReps.map((r) => accessory(r)),
      ),
    );
  }
  return result;
}

const W1_ACC_REPS = {
  hp: ["10", "10", "8", "6"],
  sh: ["12", "12", "10", "8"],
  vp: ["12", "12", "10", "8"],
  opt: ["8-12", "8-12", "8-12", "8-12"],
};

const W2_ACC_REPS = {
  hp: ["10", "8", "8"],
  sh: ["10", "8", "6"],
  vp: ["10", "8", "6"],
  opt: ["8-12", "8-12", "8-12", "8-12"],
};

const W3_ACC_REPS = {
  hp: ["6", "6", "6"],
  sh: ["6", "6", "6"],
  vp: ["6", "6", "6"],
};

const W5_ACC_REPS = {
  hp: ["8", "6", "6"],
  sh: ["8", "6", "6"],
  vp: ["8", "6", "6"],
  opt: ["8-12", "8-12", "8-12"],
};

// --- Week generators ---

function week1(
  u: WeightUnit,
  b: number,
  s: number,
  d: number,
  hp: string,
  sh: string,
  vp: string,
  accW?: AccessoryWeightConfig,
): ProgramWeek {
  const sq80 = mround(s * 0.8, u);
  const dl80 = mround(d * 0.8, u);
  const sq70 = mround(s * 0.7, u);
  const dl70 = mround(d * 0.7, u);

  const benchUpperDay = (offset: number): WorkoutDay =>
    workout(offset, "upper", [
      exercise("Bench Press", true, [
        ws(mround(b * 0.5, u), "10"),
        ws(mround(b * 0.675, u), "10"),
        ws(mround(b * 0.75, u), "8"),
        ws(mround(b * 0.775, u), "6"),
      ]),
      ...upperAccessories(
        hp,
        sh,
        vp,
        W1_ACC_REPS.hp,
        W1_ACC_REPS.sh,
        W1_ACC_REPS.vp,
        true,
        W1_ACC_REPS.opt,
        accW,
      ),
    ]);

  return {
    weekNumber: 1,
    title: "Week 1",
    subtitle: "Muscular Conditioning (Moderate Difficulty)",
    workoutDays: [
      // Day 1: Lower
      workout(0, "lower", [
        exercise("Squat", true, [
          ws(sq80, "6"),
          ws(sq80, "6"),
          ws(sq80, "6"),
          ws(sq80, "6"),
        ]),
        exercise("Deadlift", true, [ws(dl80, "6"), ws(dl80, "6")]),
        exercise("Optional Exercise 1", false, []),
        exercise("Optional Exercise 2", false, []),
      ]),
      // Day 2: Upper
      benchUpperDay(1),
      // Day 3: Upper (same template)
      benchUpperDay(3),
      // Day 4: Lower
      workout(4, "lower", [
        exercise("Squat", true, [
          ws(sq70, "8"),
          ws(sq70, "8"),
          ws(sq70, "8"),
          ws(sq70, "8"),
        ]),
        exercise("Deadlift", true, [ws(dl70, "8"), ws(dl70, "8")]),
        exercise("Optional Exercise 1", false, []),
        exercise("Optional Exercise 2", false, []),
      ]),
      // Day 5: Upper — Bench MR
      workout(5, "upper", [
        exercise("Bench Press", true, [ws(mround(b * 0.8, u), "MR")]),
        ...upperAccessories(
          hp,
          sh,
          vp,
          W1_ACC_REPS.hp,
          W1_ACC_REPS.sh,
          W1_ACC_REPS.vp,
          true,
          W1_ACC_REPS.opt,
          accW,
        ),
      ]),
    ],
  };
}

function week2(
  u: WeightUnit,
  b: number,
  s: number,
  _d: number,
  hp: string,
  sh: string,
  vp: string,
  accW?: AccessoryWeightConfig,
): ProgramWeek {
  const inc = plateIncrement(u);
  const sq80 = mround(s * 0.8, u);

  const benchUpper2 = (offset: number): WorkoutDay =>
    workout(offset, "upper", [
      exercise("Bench Press", true, [
        ws(mround(b * 0.725, u), "10"),
        ws(mround(b * 0.775, u), "8"),
        ws(mround(b * 0.8, u) + inc, "6-8"),
      ]),
      ...upperAccessories(
        hp,
        sh,
        vp,
        W2_ACC_REPS.hp,
        W2_ACC_REPS.sh,
        W2_ACC_REPS.vp,
        true,
        W2_ACC_REPS.opt,
        accW,
      ),
    ]);

  return {
    weekNumber: 2,
    title: "Week 2",
    subtitle: "Muscular Conditioning/Hypertrophy (Higher Difficulty)",
    workoutDays: [
      // Day 1: Squat MR10 + Extra Volume
      workout(
        7,
        "lower",
        [
          exercise("Squat", true, [ws(sq80, "MR10")], [
            "If you complete fewer than 8 reps, reduce your 1RM by 2.5% for following weeks.",
          ]),
          exercise(
            "Extra Volume Squats",
            true,
            Array.from({ length: 5 }, () => ws(sq80 + inc, "3")),
            ["60 seconds rest between sets."],
          ),
          exercise(
            "Deadlift Variation",
            false,
            [accessory("8"), accessory("8"), accessory("8")],
            [
              "Choose: Stiff Legged DL, Snatch Grip DL, Deficit DL, or Pause DL.",
            ],
          ),
          exercise("Optional Exercise 1", false, []),
          exercise("Optional Exercise 2", false, []),
        ],
        [
          "Complete the Extra Volume sets regardless of MR10 performance.",
        ],
      ),
      // Day 2: Upper
      benchUpper2(8),
      // Day 3: Squat MR10 (heavier) + Back Off
      workout(
        10,
        "lower",
        [
          exercise("Squat", true, [ws(sq80 + inc, "MR10")]),
          exercise(
            "Back Off Squats",
            true,
            Array.from({ length: 10 }, () => ws(sq80 + inc - 2 * inc, "3")),
            [
              "10 reps on MR10 → 10 sets of 3 (60s rest).",
              "8-9 reps on MR10 → 8 sets of 3 (60s rest).",
              "7 reps on MR10 → 5 sets of 3 (60s rest).",
              "Fewer than 7 reps → skip back-off sets, reduce 1RM by 2.5%.",
            ],
          ),
          exercise("Deadlift Variation", false, [
            accessory("8"),
            accessory("8"),
            accessory("8"),
          ]),
          exercise("Optional Exercise 1", false, []),
          exercise("Optional Exercise 2", false, []),
        ],
        [
          "Back Off Squats weight: reduce MR10 weight by " +
            (u === "kg" ? "5 kg" : "10 lbs") +
            ".",
        ],
      ),
      // Day 4: Upper (same as Day 2)
      benchUpper2(11),
      // Day 5: Bench MR
      workout(13, "upper", [
        exercise("Bench Press", true, [
          ws(mround(b * 0.8, u) - inc, "MR"),
        ]),
        ...upperAccessories(
          hp,
          sh,
          vp,
          W2_ACC_REPS.hp,
          W2_ACC_REPS.sh,
          W2_ACC_REPS.vp,
          true,
          W2_ACC_REPS.opt,
          accW,
        ),
      ]),
    ],
  };
}

function week3(
  u: WeightUnit,
  b: number,
  s: number,
  d: number,
  hp: string,
  sh: string,
  vp: string,
  accW?: AccessoryWeightConfig,
): ProgramWeek {
  const inc = plateIncrement(u);
  const sq85inc = mround(s * 0.85, u) + inc;
  const bench85 = mround(b * 0.85, u);
  const dl875 = mround(d * 0.875, u);
  const sq85inc2 = mround(s * 0.85 + inc, u) + inc;
  const bench85inc = bench85 + inc;

  return {
    weekNumber: 3,
    title: "Week 3",
    subtitle: "Linear Max OT Phase",
    workoutDays: [
      // Day 1: Heavy Lower
      workout(
        14,
        "lower",
        [
          exercise("Squat", true, [
            ws(sq85inc, "4-6"),
            ws(sq85inc, "4-6"),
            ws(sq85inc, "4-6"),
          ]),
          exercise("Deadlift", true, [
            ws(dl875, "3-6"),
            ws(dl875, "3-6"),
          ]),
        ],
        ["No accessory lifts."],
      ),
      // Day 2: Heavy Upper
      workout(16, "upper", [
        exercise("Bench Press", true, [
          ws(bench85, "4-6"),
          ws(bench85, "4-6"),
          ws(bench85, "4-6"),
        ]),
        ...upperAccessories(
          hp,
          sh,
          vp,
          W3_ACC_REPS.hp,
          W3_ACC_REPS.sh,
          W3_ACC_REPS.vp,
          false,
          undefined,
          accW,
        ),
      ]),
      // Day 3: Lower (single heavy set)
      workout(
        18,
        "lower",
        [
          exercise("Squat", true, [ws(sq85inc2, "4-6")]),
          exercise("Deadlift Variation", false, [accessory("8")]),
        ],
        ["No accessory lifts."],
      ),
      // Day 4: Upper (heavier bench)
      workout(19, "upper", [
        exercise("Bench Press", true, [
          ws(bench85inc, "4-6"),
          ws(bench85inc, "4-6"),
          ws(bench85inc, "4-6"),
        ]),
        ...upperAccessories(
          hp,
          sh,
          vp,
          W3_ACC_REPS.hp,
          W3_ACC_REPS.sh,
          W3_ACC_REPS.vp,
          false,
          undefined,
          accW,
        ),
      ]),
    ],
  };
}

function week4(
  u: WeightUnit,
  b: number,
  s: number,
  d: number,
  hp: string,
  sh: string,
  vp: string,
  accW?: AccessoryWeightConfig,
): ProgramWeek {
  const inc = plateIncrement(u);

  return {
    weekNumber: 4,
    title: "Week 4",
    subtitle: "Heavy Weight Acclimation",
    workoutDays: [
      // Day 1: Squat triples
      workout(21, "lower", [
        exercise("Squat", true, [
          ws(mround(s * 0.9, u) - inc, "3"),
          ws(mround(s * 0.9, u), "3"),
          ws(mround(s * 0.9, u) + inc, "3"),
        ]),
        exercise("Deadlift Variation", false, [
          accessory("6"),
          accessory("6"),
        ]),
        exercise("Optional Exercise 1", false, []),
        exercise("Optional Exercise 2", false, []),
      ]),
      // Day 2: Bench triples
      workout(22, "upper", [
        exercise("Bench Press", true, [
          ws(mround(b * 0.875 - 5, u), "3"),
          ws(mround(b * 0.9 - 5, u), "3"),
          ws(mround(b * 0.9, u), "3"),
        ]),
        ...upperAccessories(
          hp,
          sh,
          vp,
          W1_ACC_REPS.hp,
          W1_ACC_REPS.sh,
          W1_ACC_REPS.vp,
          true,
          W1_ACC_REPS.opt,
          accW,
        ),
      ]),
      // Day 3: Heavy singles/doubles
      workout(24, "lower", [
        exercise("Squat", true, [
          ws(mround(s * 0.9, u) + inc, "3"),
          ws(mround(s * 0.95, u), "1-2"),
        ]),
        exercise("Deadlift", true, [
          ws(mround(d * 0.9, u) + inc, "3"),
          ws(mround(d * 0.95, u), "1-2"),
        ]),
        exercise("Optional Exercise 1", false, []),
        exercise("Optional Exercise 2", false, []),
      ]),
      // Day 4: Bench peaking
      workout(25, "upper", [
        exercise("Bench Press", true, [
          ws(mround(b * 0.875, u), "3"),
          ws(mround(b * 0.9, u), "2-4"),
          ws(mround(b * 0.95, u), "1-2"),
        ]),
        ...upperAccessories(
          hp,
          sh,
          vp,
          W1_ACC_REPS.hp,
          W1_ACC_REPS.sh,
          W1_ACC_REPS.vp,
          true,
          W1_ACC_REPS.opt,
          accW,
        ),
      ]),
    ],
  };
}

function week5(
  u: WeightUnit,
  b: number,
  s: number,
  d: number,
  hp: string,
  sh: string,
  vp: string,
  accW?: AccessoryWeightConfig,
): ProgramWeek {
  return {
    weekNumber: 5,
    title: "Week 5",
    subtitle: "High Intensity Strength",
    workoutDays: [
      // Day 1: Squat test + light deadlift
      workout(28, "lower", [
        exercise("Squat", true, [ws(mround(s * 0.975, u), "1-4")]),
        exercise("Deadlift", true, [
          ws(mround(d * 0.675, u), "4"),
          ws(mround(d * 0.7, u), "4"),
          ws(mround(d * 0.725, u), "2"),
        ]),
        exercise("Optional Lower Body", false, []),
        exercise("Optional Lower Body", false, []),
      ]),
      // Day 2: Bench test
      workout(30, "upper", [
        exercise("Bench Press", true, [
          ws(mround(b * 0.975, u), "1-4"),
        ]),
        ...upperAccessories(
          hp,
          sh,
          vp,
          W5_ACC_REPS.hp,
          W5_ACC_REPS.sh,
          W5_ACC_REPS.vp,
          true,
          W5_ACC_REPS.opt,
          accW,
        ),
      ]),
      // Day 3: Deadlift test
      workout(32, "lower", [
        exercise("Deadlift", true, [ws(mround(d * 0.975, u), "1-4")]),
        exercise("Optional Lower Body", false, []),
        exercise("Optional Lower Body", false, []),
      ]),
    ],
  };
}

function week6(): ProgramWeek {
  return {
    weekNumber: 6,
    title: "Week 6",
    subtitle: "Testing / Deload",
    workoutDays: [],
  };
}

export function generateProgram(inputs: ProgramInputs): Program {
  const {
    weightUnit: u,
    bench1RM: b,
    squat1RM: s,
    deadlift1RM: d,
    horizontalPull: hp,
    shoulderExercise: sh,
    verticalPull: vp,
  } = inputs;

  const accW: AccessoryWeightConfig = {
    unit: u,
    hp1RM: inputs.horizontalPull1RM,
    sh1RM: inputs.shoulderExercise1RM,
    vp1RM: inputs.verticalPull1RM,
  };

  return {
    inputs,
    weeks: [
      week1(u, b, s, d, hp, sh, vp, accW),
      week2(u, b, s, d, hp, sh, vp, accW),
      week3(u, b, s, d, hp, sh, vp, accW),
      week4(u, b, s, d, hp, sh, vp, accW),
      week5(u, b, s, d, hp, sh, vp, accW),
      week6(),
    ],
  };
}

/**
 * Projected 1RM based on Week 5 performance.
 * Multiply by 1.03 for 2 reps, 1.06 for 3 reps, 1.09 for 4 reps.
 */
export function projectedMax(weight: number, reps: number): number | null {
  if (reps === 1) return weight;
  if (reps === 2) return Math.round(weight * 1.03 * 10) / 10;
  if (reps === 3) return Math.round(weight * 1.06 * 10) / 10;
  if (reps === 4) return Math.round(weight * 1.09 * 10) / 10;
  return null;
}
