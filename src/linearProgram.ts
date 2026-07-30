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
import { mainLiftNamesFromInputs } from "./exerciseNames";

/**
 * Candito Linear Program, transcribed from the LiftVault spreadsheet.
 *
 * Main lifts start at 77.5% of 1RM (the middle of Candito's 75–80% range)
 * and the default target adds one plate increment per week — the sheet's
 * "add 0 to 10 lb (aim for 5)" guidance. Variation and accessory work has
 * no fixed percentage; it is logged by feel.
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

function weeklyIncrement(unit: WeightUnit): number {
  return unit === "kg" ? 2.5 : 5;
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

/** Default target for a given week: week 1 load plus one increment per week. */
function loadForWeek(oneRM: number, unit: WeightUnit, weekNumber: number): number {
  return linearWeekOneLoad(oneRM, unit) + (weekNumber - 1) * weeklyIncrement(unit);
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
  "Horizontal pull (row). Progresses weekly like the bench — pick one movement and stick with it for at least 4 weeks.";

function slowAccessoryNote(unit: WeightUnit, movement: string): string {
  const range = unit === "kg" ? "0–5 kg" : "0–10 lb";
  return `${movement} Slower progression by design: raise ${range} every ~3 weeks. Stick with one movement for at least 4 weeks.`;
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
  bench1RM: number;
  squat1RM: number;
  deadlift1RM: number;
  mainLiftNames: Record<MainLift, string>;
}

function heavyLower(ctx: LinearDayContext): Omit<WorkoutDay, "dayOffset"> {
  const squat = loadForWeek(ctx.squat1RM, ctx.unit, ctx.weekNumber);
  const deadlift = loadForWeek(ctx.deadlift1RM, ctx.unit, ctx.weekNumber);
  return {
    type: "lower",
    label: "Heavy Lower",
    exercises: [
      exercise(
        ctx.mainLiftNames.squat,
        sets(3, "6", squat),
        [mainLiftProgressionNote(ctx.unit)],
        "squat",
      ),
      exercise(ctx.mainLiftNames.deadlift, sets(2, "6", deadlift), [], "deadlift"),
      exercise("Optional Accessory 1", sets(3, "8-12"), [OPTIONAL_NOTE]),
      exercise("Optional Accessory 2", sets(3, "8-12")),
    ],
    notes: [HEAVY_REST_NOTE],
  };
}

function heavyUpper(ctx: LinearDayContext): Omit<WorkoutDay, "dayOffset"> {
  const bench = loadForWeek(ctx.bench1RM, ctx.unit, ctx.weekNumber);
  return {
    type: "upper",
    label: "Heavy Upper",
    exercises: [
      exercise(
        ctx.mainLiftNames.bench,
        sets(3, "6", bench),
        [mainLiftProgressionNote(ctx.unit)],
        "bench",
      ),
      exercise("Primary Upper Back", sets(3, "6"), [PRIMARY_UPPER_BACK_NOTE]),
      exercise("Shoulder Press", sets(3, "6-12"), [
        slowAccessoryNote(ctx.unit, "Shoulder movement."),
      ]),
      exercise("Upper Back Exercise 2", sets(3, "6-12"), [
        slowAccessoryNote(ctx.unit, "Vertical pull (pull-up, chin-up, pulldown)."),
      ]),
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
      exercise("Pause Front Squat", sets(3, "8-12")),
      exercise("Pause Deadlift", sets(3, "4"), [
        "Pause right after the weight comes off the floor.",
      ]),
      exercise("Deficit Deadlift", sets(3, "8-12")),
    ],
    notes: [CONTROL_INTENSITY_NOTE, CONTROL_SORENESS_NOTE],
  };
}

function controlUpper(): Omit<WorkoutDay, "dayOffset"> {
  return {
    type: "upper",
    label: "Control Upper",
    exercises: [
      exercise("Spoto Press", sets(6, "4")),
      exercise("Pause DB Row", sets(6, "4"), [
        "Pause at full contraction.",
      ]),
      exercise("Seated DB Press", sets(4, "6-10")),
      exercise("Weighted Pullup", sets(4, "6-10")),
      exercise("JM Press", sets(3, "8-12")),
      exercise("DB Curl", sets(3, "8-12")),
    ],
    notes: [CONTROL_INTENSITY_NOTE, CONTROL_SORENESS_NOTE],
  };
}

function powerLower(): Omit<WorkoutDay, "dayOffset"> {
  return {
    type: "lower",
    label: "Power Lower",
    exercises: [
      exercise("Explosive Squat (jump or box squat)", sets(6, "4"), [
        "Jumps are for max power — as high/far as possible every rep, never just going through the motions.",
      ]),
      exercise("Speed Deadlift", sets(6, "4"), [
        "50–70% of max, performed explosively.",
      ]),
      exercise("Optional Explosive Lower 1", sets(4, "4")),
      exercise("Optional Explosive Lower 2", sets(4, "4")),
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

function hypertrophyUpper(): Omit<WorkoutDay, "dayOffset"> {
  return {
    type: "upper",
    label: "Hypertrophy Upper",
    exercises: [
      exercise("Chest Press (flat or decline DB)", sets(4, "8"), [
        "Prioritize dumbbells for the chest pressing movements.",
      ]),
      exercise("Incline Chest Press", sets(4, "8")),
      exercise("Upper Back Exercise 1", sets(4, "8")),
      exercise("Upper Back Exercise 2", sets(4, "8")),
      exercise("Shoulder Press", sets(3, "10")),
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
      isWeekA ? controlLower() : controlUpper(),
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
    control: () => [controlLower(), controlUpper()],
    // There is no explosive upper day — the upper range of motion is too
    // short for it — so Power reuses the Control upper day.
    power: () => [powerLower(), controlUpper()],
    hypertrophy: () => [hypertrophyLower(), hypertrophyUpper()],
  };

  const days = [heavyLower(ctx), heavyUpper(ctx), ...variationDays[variant]()];
  return days.map((day, index) => ({
    ...day,
    dayOffset: weekIndex * 7 + FOUR_DAY_OFFSETS[index],
  }));
}

function weekSubtitle(
  variant: LinearVariant,
  weekIndex: number,
  unit: WeightUnit,
): string {
  const variantLabel = LINEAR_VARIANT_LABELS[variant];
  const schedule =
    variant === "three-day"
      ? weekIndex % 2 === 0
        ? "Week A · Mon/Wed/Fri"
        : "Week B · Mon/Wed/Fri"
      : "Mon/Tue/Thu/Fri";
  const load =
    weekIndex === 0
      ? "main lifts at 77.5% 1RM"
      : `main lifts +${weekIndex * weeklyIncrement(unit)} ${unit} vs Week 1`;
  return `${variantLabel} · ${schedule} · ${load}`;
}

export function generateLinearProgram(inputs: ProgramInputs): Program {
  const variant = linearVariantFromInputs(inputs);
  const weekCount = linearWeekCountFromInputs(inputs);
  const mainLiftNames = mainLiftNamesFromInputs(inputs);

  const weeks: ProgramWeek[] = Array.from({ length: weekCount }, (_, weekIndex) => {
    const ctx: LinearDayContext = {
      unit: inputs.weightUnit,
      weekNumber: weekIndex + 1,
      bench1RM: inputs.bench1RM,
      squat1RM: inputs.squat1RM,
      deadlift1RM: inputs.deadlift1RM,
      mainLiftNames,
    };
    return {
      weekNumber: weekIndex + 1,
      title: `Week ${weekIndex + 1}`,
      subtitle: weekSubtitle(variant, weekIndex, inputs.weightUnit),
      workoutDays: daysForWeek(variant, weekIndex, ctx),
    };
  });

  return { inputs, weeks };
}
