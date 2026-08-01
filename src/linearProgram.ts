import {
  DEFAULT_LINEAR_WEEK_COUNT,
  linearVariantFromInputs,
  LINEAR_VARIANT_LABELS,
  type LinearVariant,
  type MainLift,
  type Program,
  type ProgramExercise,
  type ProgramInputs,
  type ProgramSet,
  type ProgramWeek,
  type WeightUnit,
  type WorkoutDay,
} from "./types";
import { cleanExerciseName, mainLiftNamesFromInputs } from "./exerciseNames";

/**
 * Candito Linear Program, transcribed from the LiftVault spreadsheet.
 *
 * Main lifts start at 77.5% of 1RM (the middle of Candito's 75–80% range)
 * and the default target adds one plate increment per week — the sheet's
 * "add 0 to 10 lb (aim for 5)" guidance. Each week's raise can be chosen
 * per lift (inputs.linearIncrements), including the guide's reset drop
 * after missed reps. Variation and accessory work has no fixed percentage;
 * it is logged by feel.
 */
const LINEAR_START_PERCENTAGE = 0.775;

/**
 * The spreadsheet uses MROUND(x, 5) for lb and recommends 2.5 for kg.
 * Unlike the 6-week engine (which floors), the sheet rounds to nearest.
 */
function mroundNearest(value: number, unit: WeightUnit): number {
  const multiple = unit === "kg" ? 2.5 : 5;
  return Math.round(value / multiple) * multiple;
}

/** The guide's "aim for the smallest increment": one plate pair per week. */
export function linearDefaultIncrement(unit: WeightUnit): number {
  return unit === "kg" ? 2.5 : 5;
}

/**
 * Selectable week-over-week changes: the guide's 0–10 lb band (stretched a
 * plate further for lifters feeling great) plus the reset drop prescribed
 * after missed reps (−15 lb / −7.5 kg).
 */
export function linearIncrementChoices(unit: WeightUnit): number[] {
  return unit === "kg" ? [-7.5, 0, 2.5, 5, 7.5] : [-15, 0, 5, 10];
}

const LIFT_1RM_KEYS = {
  bench: "bench1RM",
  squat: "squat1RM",
  deadlift: "deadlift1RM",
} as const satisfies Record<MainLift, keyof ProgramInputs>;

type LinearLoadInputs = Pick<
  ProgramInputs,
  "weightUnit" | "bench1RM" | "squat1RM" | "deadlift1RM" | "linearIncrements"
>;

/** The chosen (or default) change vs the previous week for a lift, week 2+. */
export function linearIncrementForWeek(
  inputs: Pick<ProgramInputs, "weightUnit" | "linearIncrements">,
  lift: MainLift,
  weekNumber: number,
): number {
  const stored = inputs.linearIncrements?.[lift]?.[weekNumber];
  return typeof stored === "number" && Number.isFinite(stored)
    ? stored
    : linearDefaultIncrement(inputs.weightUnit);
}

/** A lift's target load for a week: week 1 plus each chosen weekly change. */
export function linearLoadForWeek(
  inputs: LinearLoadInputs,
  lift: MainLift,
  weekNumber: number,
): number {
  let load = linearWeekOneLoad(inputs[LIFT_1RM_KEYS[lift]], inputs.weightUnit);
  for (let week = 2; week <= weekNumber; week += 1) {
    load += linearIncrementForWeek(inputs, lift, week);
  }
  return load;
}

/**
 * Records the user's chosen raise for a lift/week. Choices are stored
 * explicitly (even when equal to the default) so a later revert still
 * syncs as a change rather than a missing key.
 */
export function withLinearIncrement(
  inputs: ProgramInputs,
  lift: MainLift,
  weekNumber: number,
  increment: number,
): ProgramInputs {
  if (weekNumber < 2 || !Number.isFinite(increment)) return inputs;
  if (inputs.linearIncrements?.[lift]?.[weekNumber] === increment) return inputs;
  return {
    ...inputs,
    linearIncrements: {
      ...(inputs.linearIncrements ?? {}),
      [lift]: {
        ...(inputs.linearIncrements?.[lift] ?? {}),
        [weekNumber]: increment,
      },
    },
  };
}

export function linearWeekCountFromInputs(
  inputs: Pick<ProgramInputs, "linearWeekCount"> | undefined,
): number {
  const count = inputs?.linearWeekCount;
  if (count == null || !Number.isFinite(count)) return DEFAULT_LINEAR_WEEK_COUNT;
  return Math.max(1, Math.floor(count));
}

export function linearDaysPerWeek(variant: LinearVariant): number {
  return variant === "three-day" ? 3 : 4;
}

/** Week 1 main-lift load for a given 1RM, as the spreadsheet's gray cells. */
export function linearWeekOneLoad(oneRM: number, unit: WeightUnit): number {
  return mroundNearest(oneRM * LINEAR_START_PERCENTAGE, unit);
}

function sets(count: number, targetReps: string, weight: number | null = null): ProgramSet[] {
  return Array.from({ length: count }, () => ({ weight, targetReps }));
}

function exercise(
  name: string,
  sets: ProgramSet[],
  notes: string[] = [],
  mainLift?: MainLift,
): ProgramExercise {
  return {
    name,
    isMainLift: mainLift != null,
    mainLift,
    hasWarmUp: true,
    sets,
    notes,
  };
}

// --- Coaching notes from the original program guide (PDF) ---

function mainLiftProgressionNote(unit: WeightUnit): string {
  const range = unit === "kg" ? "0–5 kg" : "0–10 lb";
  const aim = unit === "kg" ? "2.5 kg" : "5 lb";
  return `Add ${range} vs last week (${aim} is the usual goal — adding 0 is fine, the bench often needs 2 weeks per jump).`;
}

const HEAVY_REST_NOTE =
  "Rest 3–10 min between working sets — start each one fully recovered and 100% focused. These sessions are where limits get pushed.";

const SUPERSET_NOTE =
  "Short on time? Superset press/pull pairs (bench↔row, shoulder↔curl) with normal rest — never squats or deadlifts.";

const PRIMARY_UPPER_BACK_NOTE =
  "Progresses weekly like the bench — stick with this movement for at least 4 weeks.";

function slowAccessoryNote(unit: WeightUnit): string {
  const range = unit === "kg" ? "0–5 kg" : "0–10 lb";
  return `Slower progression by design: raise ${range} every ~3 weeks. Stick with this movement for at least 4 weeks.`;
}

const OPTIONAL_NOTE =
  "Just lift — no numbers to chase, and you can swap movements freely each workout. 1–2 min rest works well here.";

const OPTIONAL_UPPER_NOTE =
  OPTIONAL_NOTE +
  " Curls or rear delts are great picks; skip direct triceps work (pressing already taxes them).";

const CONTROL_INTENSITY_NOTE =
  "Pause work at ~70% of your normal 1RM: challenging, but never at serious risk of missing a rep — the heavy days are where limits get pushed. ~3 min rest is enough.";

const CONTROL_SORENESS_NOTE =
  "Sore from the heavy days? Hold the weight here this week and let the heavy/control gap grow.";

const BY_FEEL_NOTE =
  "No fixed percentages — pick a weight, log it, push it up over time.";

interface LinearDayContext {
  unit: WeightUnit;
  weekNumber: number;
  /** This week's target loads per main lift, honoring chosen increments. */
  loads: Record<MainLift, number>;
  mainLiftNames: Record<MainLift, string>;
  /** The cycle's chosen movements for the recurring upper accessory slots. */
  horizontalPull: string;
  shoulderExercise: string;
  verticalPull: string;
}

/**
 * Resolves the guide's named accessory slots to the movements picked at
 * setup, falling back to the slot labels for cycles saved without them.
 */
function accessoryNamesFromInputs(inputs: ProgramInputs): {
  horizontalPull: string;
  shoulderExercise: string;
  verticalPull: string;
} {
  return {
    horizontalPull: cleanExerciseName(inputs.horizontalPull, "Primary Upper Back"),
    shoulderExercise: cleanExerciseName(inputs.shoulderExercise, "Shoulder Exercise"),
    verticalPull: cleanExerciseName(inputs.verticalPull, "Upper Back Exercise 2"),
  };
}

function heavyLower(ctx: LinearDayContext): Omit<WorkoutDay, "dayOffset"> {
  return {
    type: "lower",
    label: "Heavy Lower",
    exercises: [
      exercise(
        ctx.mainLiftNames.squat,
        sets(3, "6", ctx.loads.squat),
        [mainLiftProgressionNote(ctx.unit)],
        "squat",
      ),
      exercise(ctx.mainLiftNames.deadlift, sets(2, "6", ctx.loads.deadlift), [], "deadlift"),
      exercise("Optional Accessory 1", sets(3, "8-12"), [OPTIONAL_NOTE]),
      exercise("Optional Accessory 2", sets(3, "8-12")),
    ],
    notes: [HEAVY_REST_NOTE],
  };
}

function heavyUpper(ctx: LinearDayContext): Omit<WorkoutDay, "dayOffset"> {
  return {
    type: "upper",
    label: "Heavy Upper",
    exercises: [
      exercise(
        ctx.mainLiftNames.bench,
        sets(3, "6", ctx.loads.bench),
        [mainLiftProgressionNote(ctx.unit)],
        "bench",
      ),
      exercise(ctx.horizontalPull, sets(3, "6"), [PRIMARY_UPPER_BACK_NOTE]),
      exercise(ctx.shoulderExercise, sets(1, "6"), [slowAccessoryNote(ctx.unit)]),
      exercise(ctx.verticalPull, sets(1, "6"), [slowAccessoryNote(ctx.unit)]),
      exercise("Optional Accessory 1", sets(3, "8-12"), [OPTIONAL_UPPER_NOTE]),
      exercise("Optional Accessory 2", sets(3, "8-12")),
    ],
    notes: [HEAVY_REST_NOTE, SUPERSET_NOTE],
  };
}

function controlLower(): Omit<WorkoutDay, "dayOffset"> {
  return {
    type: "lower",
    label: "Control Lower",
    exercises: [
      exercise("Pause Squat", sets(6, "4")),
      exercise("Pause Deadlift", sets(3, "4"), [
        "Pause right after the weight comes off the floor.",
      ]),
      exercise("Optional Accessory 1", sets(3, "8-12"), [OPTIONAL_NOTE]),
      exercise("Optional Accessory 2", sets(3, "8-12")),
    ],
    notes: [CONTROL_INTENSITY_NOTE, CONTROL_SORENESS_NOTE],
  };
}

function controlUpper(ctx: LinearDayContext): Omit<WorkoutDay, "dayOffset"> {
  return {
    type: "upper",
    label: "Control Upper",
    exercises: [
      exercise("Spoto Press", sets(6, "4")),
      exercise(`Pause ${ctx.horizontalPull}`, sets(6, "4"), [
        "Same rowing movement as the heavy day, paused at full contraction.",
      ]),
      exercise(ctx.shoulderExercise, sets(1, "10")),
      exercise(ctx.verticalPull, sets(1, "10"), ["Not paused."]),
      exercise("Optional Accessory 1", sets(3, "8-12"), [OPTIONAL_UPPER_NOTE]),
      exercise("Optional Accessory 2", sets(3, "8-12")),
    ],
    notes: [CONTROL_INTENSITY_NOTE, CONTROL_SORENESS_NOTE],
  };
}

function powerLower(): Omit<WorkoutDay, "dayOffset"> {
  return {
    type: "lower",
    label: "Power Lower",
    exercises: [
      exercise("Weighted Explosive Exercise 1", sets(6, "4"), [
        "Jump squat, box jump, power clean, speed squat, trap bar jump — max power every rep, never just going through the motions.",
      ]),
      exercise("Weighted Explosive Exercise 2", sets(6, "4"), [
        "Speed deadlifts work well here: 50–70% of max, performed explosively.",
      ]),
      exercise("Optional Explosive Exercise 1", sets(5, "4"), [
        "Unweighted options: squat jump, box jump, broad jump, one-legged variations.",
      ]),
      exercise("Optional Explosive Exercise 2", sets(5, "4")),
    ],
    notes: [
      BY_FEEL_NOTE,
      "Trains the nervous system and fast-twitch fibers without going heavy — speed over load.",
    ],
  };
}

function hypertrophyLower(): Omit<WorkoutDay, "dayOffset"> {
  return {
    type: "lower",
    label: "Hypertrophy Lower",
    exercises: [
      exercise("Back or Front Squat", sets(5, "8")),
      exercise("Deadlift Variation", sets(3, "8"), [
        "Stiff-legged, deficit, or snatch-grip deadlift.",
      ]),
      exercise("Hamstring Curl", sets(3, "12")),
      exercise("Calf Raise", sets(5, "15")),
      exercise("Optional Accessory 1", sets(4, "8-12"), [OPTIONAL_NOTE]),
      exercise("Optional Accessory 2", sets(4, "8-12")),
    ],
    notes: [BY_FEEL_NOTE],
  };
}

function hypertrophyUpper(ctx: LinearDayContext): Omit<WorkoutDay, "dayOffset"> {
  return {
    type: "upper",
    label: "Hypertrophy Upper",
    exercises: [
      exercise("Chest Press (flat or decline DB)", sets(4, "8"), [
        "Prioritize dumbbells for the chest pressing movements.",
      ]),
      exercise("Incline Chest Press", sets(4, "8")),
      exercise(ctx.horizontalPull, sets(4, "8")),
      exercise(ctx.verticalPull, sets(4, "8")),
      exercise(ctx.shoulderExercise, sets(3, "10")),
      exercise("Bicep Exercise", sets(3, "10")),
      exercise("Optional Accessory 1", sets(4, "8-12"), [OPTIONAL_UPPER_NOTE]),
      exercise("Optional Accessory 2", sets(4, "8-12")),
    ],
    notes: [BY_FEEL_NOTE],
  };
}

/** Mon/Tue/Thu/Fri for 4-day variants; Mon/Wed/Fri for the 3-day schedule. */
const FOUR_DAY_OFFSETS = [0, 1, 3, 4];
const THREE_DAY_OFFSETS = [0, 2, 4];

function daysForWeek(
  variant: LinearVariant,
  weekIndex: number,
  ctx: LinearDayContext,
): WorkoutDay[] {
  if (variant === "three-day") {
    // Candito's documented 3-day schedule: keep both heavy days and
    // alternate the (Control) variation day — Week A lower, Week B upper.
    const isWeekA = weekIndex % 2 === 0;
    const days = [
      heavyLower(ctx),
      heavyUpper(ctx),
      isWeekA ? controlLower() : controlUpper(ctx),
    ];
    return days.map((day, index) => ({
      ...day,
      dayOffset: weekIndex * 7 + THREE_DAY_OFFSETS[index],
    }));
  }

  const variationDays: Record<
    Exclude<LinearVariant, "three-day">,
    () => Omit<WorkoutDay, "dayOffset">[]
  > = {
    control: () => [controlLower(), controlUpper(ctx)],
    // There is no explosive upper day — the upper range of motion is too
    // short for it — so Power reuses the Control upper day.
    power: () => [powerLower(), controlUpper(ctx)],
    hypertrophy: () => [hypertrophyLower(), hypertrophyUpper(ctx)],
  };

  const days = [heavyLower(ctx), heavyUpper(ctx), ...variationDays[variant]()];
  return days.map((day, index) => ({
    ...day,
    dayOffset: weekIndex * 7 + FOUR_DAY_OFFSETS[index],
  }));
}

function signedWeight(value: number): string {
  return value < 0 ? String(value) : `+${value}`;
}

function weekSubtitle(
  variant: LinearVariant,
  weekIndex: number,
  inputs: LinearLoadInputs,
): string {
  const variantLabel = LINEAR_VARIANT_LABELS[variant];
  const schedule =
    variant === "three-day"
      ? weekIndex % 2 === 0
        ? "Week A · Mon/Wed/Fri"
        : "Week B · Mon/Wed/Fri"
      : "Mon/Tue/Thu/Fri";
  const unit = inputs.weightUnit;
  const weekNumber = weekIndex + 1;
  const offsets = (["bench", "squat", "deadlift"] as const).map(
    (lift) =>
      linearLoadForWeek(inputs, lift, weekNumber) -
      linearWeekOneLoad(inputs[LIFT_1RM_KEYS[lift]], unit),
  );
  const [bench, squat, deadlift] = offsets;
  const load =
    weekIndex === 0
      ? "main lifts at 77.5% 1RM"
      : offsets.every((offset) => offset === offsets[0])
        ? `main lifts ${signedWeight(bench)} ${unit} vs Week 1`
        : `B ${signedWeight(bench)} / S ${signedWeight(squat)} / D ${signedWeight(deadlift)} ${unit} vs Week 1`;
  return `${variantLabel} · ${schedule} · ${load}`;
}

export function generateLinearProgram(inputs: ProgramInputs): Program {
  const variant = linearVariantFromInputs(inputs);
  const weekCount = linearWeekCountFromInputs(inputs);
  const mainLiftNames = mainLiftNamesFromInputs(inputs);
  const accessoryNames = accessoryNamesFromInputs(inputs);

  const weeks: ProgramWeek[] = Array.from({ length: weekCount }, (_, weekIndex) => {
    const weekNumber = weekIndex + 1;
    const ctx: LinearDayContext = {
      unit: inputs.weightUnit,
      weekNumber,
      loads: {
        bench: linearLoadForWeek(inputs, "bench", weekNumber),
        squat: linearLoadForWeek(inputs, "squat", weekNumber),
        deadlift: linearLoadForWeek(inputs, "deadlift", weekNumber),
      },
      mainLiftNames,
      ...accessoryNames,
    };
    return {
      weekNumber,
      title: `Week ${weekNumber}`,
      subtitle: weekSubtitle(variant, weekIndex, inputs),
      workoutDays: daysForWeek(variant, weekIndex, ctx),
    };
  });

  return { inputs, weeks };
}
