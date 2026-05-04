import type {
  CycleData,
  DateOverride,
  Program,
  ProgramSet,
  SetLog,
  WorkoutDay,
  WorkoutLog,
  WeightUnit,
} from "./types";
import { getWarmUpSetsForExercise } from "./warmUp";
import { mainLiftNamesFromInputs } from "./exerciseNames";

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Easy",
  2: "Moderate",
  3: "Hard",
  4: "Very Hard",
  5: "Maximum",
};

function formatDate(startDate: string, dayOffset: number, override?: DateOverride): string {
  const d = override != null
    ? new Date(override.date + "T00:00:00")
    : (() => {
        const date = new Date(startDate + "T00:00:00");
        date.setDate(date.getDate() + dayOffset);
        return date;
      })();

  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatProgramSet(set: ProgramSet, unit: WeightUnit): string {
  const weight = set.weight != null ? `${set.weight} ${unit} ` : "";
  return `${weight}x ${set.targetReps}`;
}

function formatSetLog(log: SetLog | undefined, prescribed: number | null, unit: WeightUnit): string {
  if (log == null) return "";

  const parts: string[] = [];
  const actualWeight = log.actualWeight ?? prescribed;
  if (log.actualReps != null) {
    parts.push(`did ${log.actualReps}${actualWeight != null ? ` @ ${actualWeight} ${unit}` : ""}`);
  } else if (log.actualWeight != null) {
    parts.push(`used ${log.actualWeight} ${unit}`);
  }

  if (log.difficulty != null) {
    parts.push(`difficulty: ${DIFFICULTY_LABELS[log.difficulty]}`);
  }

  if (log.notes.trim().length > 0) {
    parts.push(`NOTE: ${log.notes.trim()}`);
  }

  return parts.length > 0 ? ` (${parts.join("; ")})` : "";
}

function setLogHasData(log: SetLog): boolean {
  return (
    log.actualReps != null ||
    log.actualWeight != null ||
    log.difficulty != null ||
    log.notes.trim().length > 0
  );
}

function hasWorkoutData(log: WorkoutLog | undefined): boolean {
  if (log == null) return false;
  if (log.notes.trim().length > 0) return true;
  if (log.completed || log.startedAt != null || log.completedAt != null) return true;

  return log.exerciseLogs.some((exerciseLog) =>
    exerciseLog.setLogs.some(setLogHasData) ||
    (exerciseLog.warmUpSetLogs ?? []).some(setLogHasData),
  );
}

function appendWorkoutLogDetails(lines: string[], log: WorkoutLog | undefined): void {
  if (log == null) return;

  if (log.completed) {
    lines.push("    Status: completed");
  } else if (log.startedAt != null || hasWorkoutData(log)) {
    lines.push("    Status: in progress");
  }

  if (log.notes.trim().length > 0) {
    lines.push(`    WORKOUT NOTE: ${log.notes.trim()}`);
  }
}

function appendDay(
  lines: string[],
  day: WorkoutDay,
  dayLabel: string,
  cycleData: CycleData,
  logKey: string,
): void {
  const { weightUnit } = cycleData.inputs;
  const log = cycleData.workoutLogs[logKey];
  const dateOverride = cycleData.dateOverrides?.[logKey];
  const date = formatDate(cycleData.inputs.startDate, day.dayOffset, dateOverride);

  lines.push(`${dayLabel} - ${day.type === "lower" ? "Lower" : "Upper"} - ${date}`);
  if (dateOverride != null) {
    lines.push(`  RESCHEDULE NOTE: ${dateOverride.reason}`);
  }
  appendWorkoutLogDetails(lines, log);

  day.notes.forEach((note) => {
    lines.push(`  Program note: ${note}`);
  });

  day.exercises.forEach((exercise, exerciseIndex) => {
    lines.push(`  ${exercise.name}${exercise.isMainLift ? " (main lift)" : ""}`);

    const exerciseLog = log?.exerciseLogs[exerciseIndex];
    const warmUps = getWarmUpSetsForExercise(exercise, weightUnit);
    warmUps.forEach((warmUp, warmUpIndex) => {
      const warmUpLog = exerciseLog?.warmUpSetLogs?.[warmUpIndex];
      const prescribed = warmUpLog?.prescribedWeight ?? warmUp.weight;
      lines.push(
        `    Warm-up ${warmUpIndex + 1}: ${formatProgramSet({ ...warmUp, weight: prescribed }, weightUnit)}${formatSetLog(warmUpLog, prescribed, weightUnit)}`,
      );
    });

    if (exercise.sets.length === 0) {
      lines.push("    No prescribed sets - do as needed");
    } else {
      exercise.sets.forEach((set, setIndex) => {
        const setLog = exerciseLog?.setLogs[setIndex];
        const prescribed = setLog?.prescribedWeight ?? set.weight;
        lines.push(
          `    Set ${setIndex + 1}: ${formatProgramSet({ ...set, weight: prescribed }, weightUnit)}${formatSetLog(setLog, prescribed, weightUnit)}`,
        );
      });
    }

    exercise.notes.forEach((note) => {
      lines.push(`    Program note: ${note}`);
    });
  });
}

export function buildCycleClipboardText(program: Program, cycleData: CycleData): string {
  const { inputs } = cycleData;
  const mainLiftNames = mainLiftNamesFromInputs(inputs);
  const lines: string[] = [
    cycleData.name,
    `Started: ${formatDate(inputs.startDate, 0)}`,
    `1RMs: ${mainLiftNames.bench} ${inputs.bench1RM} ${inputs.weightUnit}, ${mainLiftNames.squat} ${inputs.squat1RM} ${inputs.weightUnit}, ${mainLiftNames.deadlift} ${inputs.deadlift1RM} ${inputs.weightUnit}`,
    `Accessories: ${inputs.horizontalPull}, ${inputs.shoulderExercise}, ${inputs.verticalPull}`,
    "",
    "Training cycle",
  ];

  program.weeks.forEach((week, weekIndex) => {
    if (week.workoutDays.length === 0) return;

    lines.push("");
    lines.push(`${week.title}: ${week.subtitle}`);
    week.workoutDays.forEach((day, dayIndex) => {
      lines.push("");
      appendDay(lines, day, `Day ${dayIndex + 1}`, cycleData, `w${weekIndex}-d${dayIndex}`);
    });
  });

  return lines.join("\n");
}
