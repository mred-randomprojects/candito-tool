import { Navigate, useNavigate, useParams } from "react-router-dom";
import type {
  AppData,
  CycleData,
  DateOverride,
  ExerciseMaxEntry,
  FreeTrainingDay,
  MainLift,
  Program,
  ProgramInputs,
  UserProfile,
  WeightUnit,
  WorkoutLog,
} from "../types";
import { programTypeFromInputs } from "../types";
import type { WorkoutDay } from "../types";
import { findPreviousComparableSessions } from "../programEngine";
import {
  controlStartLoad,
  linearDefaultIncrement,
  linearIncrementChoicesForInputs,
  linearIncrementForWeek,
} from "../linearProgram";
import { formatLoggedSets } from "../setLogs";
import {
  signWorkoutLogPrescription,
  snapshotFromInputs,
} from "../trainingMaxSnapshot";
import { SetupForm } from "./SetupForm";
import {
  WorkoutView,
  type ControlLiftReference,
  type LinearProgressionControls,
  type PreviousSession,
} from "./WorkoutView";
import { ActiveWorkout } from "./ActiveWorkout";
import { FreeTrainingDayPage } from "./FreeTrainingPage";

function workoutLogHasContent(log: WorkoutLog): boolean {
  if (log.completed || log.startedAt != null || log.notes.trim().length > 0) {
    return true;
  }
  return log.exerciseLogs.some((exerciseLog) =>
    [...exerciseLog.setLogs, ...(exerciseLog.warmUpSetLogs ?? [])].some(
      (setLog) =>
        setLog.actualReps != null ||
        setLog.actualWeight != null ||
        setLog.difficulty != null ||
        setLog.notes.length > 0,
    ),
  );
}

/**
 * Matching earlier weeks' logs, shown as session history while training —
 * most recent first. Only surfaced for the linear program, where
 * week-to-week comparison is the core progression signal (the
 * spreadsheet's green cells).
 */
function findPreviousSessionLogs(
  program: Program,
  cycle: CycleData,
  weekIndex: number,
  dayIndex: number,
): PreviousSession[] {
  if (programTypeFromInputs(cycle.inputs) !== "linear") return [];
  return findPreviousComparableSessions(program, weekIndex, dayIndex, 10)
    .map((session) => ({
      weekNumber: session.weekNumber,
      log: cycle.workoutLogs[session.logKey],
    }))
    .filter(
      (session): session is PreviousSession =>
        session.log != null && workoutLogHasContent(session.log),
    )
    .slice(0, 5);
}

/**
 * Control-day aid: for each pause variation on the day, this week's
 * heavy-day numbers for the mirrored main lift plus the guide's ~70%-of-1RM
 * starting weight.
 */
function buildControlReferences(
  program: Program,
  cycle: CycleData,
  weekIndex: number,
  day: WorkoutDay,
): Partial<Record<MainLift, ControlLiftReference>> | undefined {
  if (programTypeFromInputs(cycle.inputs) !== "linear") return undefined;
  const week = program.weeks[weekIndex];
  if (week == null) return undefined;
  const references: Partial<Record<MainLift, ControlLiftReference>> = {};
  for (const controlExercise of day.exercises) {
    const lift = controlExercise.controlOf;
    if (lift == null || references[lift] != null) continue;
    for (let dayIdx = 0; dayIdx < week.workoutDays.length; dayIdx++) {
      const heavyDay = week.workoutDays[dayIdx];
      const exerciseIdx = heavyDay.exercises.findIndex(
        (exercise) => exercise.mainLift === lift,
      );
      if (exerciseIdx < 0) continue;
      const heavyExercise = heavyDay.exercises[exerciseIdx];
      const exerciseLog =
        cycle.workoutLogs[`w${weekIndex}-d${dayIdx}`]?.exerciseLogs[exerciseIdx];
      references[lift] = {
        liftName: heavyExercise.name,
        guideStart: controlStartLoad(cycle.inputs, lift),
        heavyPrescribed:
          exerciseLog?.setLogs[0]?.prescribedWeight ??
          heavyExercise.sets[0]?.weight ??
          null,
        heavySummary: formatLoggedSets(exerciseLog),
      };
      break;
    }
  }
  return Object.keys(references).length > 0 ? references : undefined;
}

export function WorkoutRoute({
  program,
  activeCycle,
  profile,
  isReadOnly,
  updateLog,
  updateDateOverride,
  updateLinearIncrement,
  navigate,
}: {
  program: Program;
  activeCycle: CycleData;
  profile: UserProfile;
  isReadOnly: boolean;
  updateLog: (cycleId: string, weekIndex: number, dayIndex: number, log: WorkoutLog) => void;
  updateDateOverride: (cycleId: string, weekIndex: number, dayIndex: number, override: DateOverride | null) => void;
  updateLinearIncrement: (cycleId: string, lift: MainLift, weekNumber: number, increment: number) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { weekIndex: wi, dayIndex: di } = useParams();
  const weekIndex = Number(wi);
  const dayIndex = Number(di);

  const week = program.weeks[weekIndex];
  if (week == null) return <Navigate to="/overview" replace />;

  const day = week.workoutDays[dayIndex];
  if (day == null) return <Navigate to="/overview" replace />;

  const logKey = `w${weekIndex}-d${dayIndex}`;
  const log = activeCycle.workoutLogs[logKey];
  const dateOverride = activeCycle.dateOverrides?.[logKey];
  const calculatedFrom = log?.calculatedFrom ?? snapshotFromInputs(activeCycle.inputs);
  const previousSessions = findPreviousSessionLogs(
    program,
    activeCycle,
    weekIndex,
    dayIndex,
  );

  // Week 1 sets the baseline, so the raise chooser starts at week 2. A
  // completed day keeps its snapshotted prescription — choices lock with it.
  const inputs = activeCycle.inputs;
  const linearProgression: LinearProgressionControls | undefined =
    programTypeFromInputs(inputs) === "linear" && week.weekNumber >= 2
      ? {
          unit: inputs.weightUnit,
          increments: {
            bench: linearIncrementForWeek(inputs, "bench", week.weekNumber),
            squat: linearIncrementForWeek(inputs, "squat", week.weekNumber),
            deadlift: linearIncrementForWeek(inputs, "deadlift", week.weekNumber),
          },
          choices: linearIncrementChoicesForInputs(inputs),
          defaultIncrement: linearDefaultIncrement(inputs.weightUnit),
          onSelectIncrement:
            !isReadOnly && log?.completed !== true
              ? (lift, increment) =>
                  updateLinearIncrement(activeCycle.id, lift, week.weekNumber, increment)
              : undefined,
        }
      : undefined;

  return (
    <WorkoutView
      week={week}
      day={day}
      weekIndex={weekIndex}
      dayIndex={dayIndex}
      startDate={activeCycle.inputs.startDate}
      weightUnit={activeCycle.inputs.weightUnit}
      bodyWeight={profile.bodyWeight}
      sex={profile.sex}
      log={log}
      previousSessions={previousSessions}
      calculatedFrom={calculatedFrom}
      dateOverride={dateOverride}
      linearProgression={linearProgression}
      controlReferences={buildControlReferences(program, activeCycle, weekIndex, day)}
      onStartWorkout={!isReadOnly ? () => navigate(`/active/${weekIndex}/${dayIndex}`) : undefined}
      onBack={() => navigate("/overview")}
      onMarkComplete={!isReadOnly ? (newLog) => {
        const nextCalculatedFrom = newLog.calculatedFrom ?? calculatedFrom;
        updateLog(activeCycle.id, weekIndex, dayIndex, {
          ...signWorkoutLogPrescription(newLog, nextCalculatedFrom),
        });
        navigate("/overview");
      } : undefined}
      onUpdateLog={!isReadOnly ? (newLog) => {
        const nextCalculatedFrom = newLog.calculatedFrom ?? calculatedFrom;
        updateLog(activeCycle.id, weekIndex, dayIndex, {
          ...signWorkoutLogPrescription(newLog, nextCalculatedFrom),
        });
      } : undefined}
      onUpdateDateOverride={!isReadOnly ? (override) => {
        updateDateOverride(activeCycle.id, weekIndex, dayIndex, override);
      } : undefined}
    />
  );
}

export function ActiveWorkoutRoute({
  program,
  activeCycle,
  updateLog,
  navigate,
}: {
  program: Program;
  activeCycle: CycleData;
  updateLog: (cycleId: string, weekIndex: number, dayIndex: number, log: WorkoutLog) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { weekIndex: wi, dayIndex: di } = useParams();
  const weekIndex = Number(wi);
  const dayIndex = Number(di);

  const week = program.weeks[weekIndex];
  if (week == null) return <Navigate to="/overview" replace />;

  const day = week.workoutDays[dayIndex];
  if (day == null) return <Navigate to="/overview" replace />;

  const logKey = `w${weekIndex}-d${dayIndex}`;
  const log = activeCycle.workoutLogs[logKey];
  const calculatedFrom = log?.calculatedFrom ?? snapshotFromInputs(activeCycle.inputs);
  const previousLog = findPreviousSessionLogs(
    program,
    activeCycle,
    weekIndex,
    dayIndex,
  )[0]?.log;

  return (
    <ActiveWorkout
      day={day}
      weekTitle={week.title}
      weightUnit={activeCycle.inputs.weightUnit}
      existingLog={log}
      previousLog={previousLog}
      controlReferences={buildControlReferences(program, activeCycle, weekIndex, day)}
      calculatedFrom={calculatedFrom}
      onComplete={(newLog) => {
        const nextCalculatedFrom = newLog.calculatedFrom ?? calculatedFrom;
        updateLog(activeCycle.id, weekIndex, dayIndex, {
          ...signWorkoutLogPrescription(newLog, nextCalculatedFrom),
        });
        navigate(`/workout/${weekIndex}/${dayIndex}`);
      }}
      onSavePartial={(partialLog) => {
        const nextCalculatedFrom = partialLog.calculatedFrom ?? calculatedFrom;
        updateLog(activeCycle.id, weekIndex, dayIndex, {
          ...signWorkoutLogPrescription(partialLog, nextCalculatedFrom),
        });
      }}
      onBack={() => navigate(`/workout/${weekIndex}/${dayIndex}`)}
    />
  );
}

export function FreeTrainingDayRoute({
  freeTrainingDays,
  exercises,
  preferredUnit,
  updateTrainingDay,
  deleteTrainingDay,
  navigate,
}: {
  freeTrainingDays: FreeTrainingDay[];
  exercises: AppData["exercises"];
  preferredUnit: WeightUnit;
  updateTrainingDay: (day: FreeTrainingDay) => void;
  deleteTrainingDay: (dayId: string) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { dayId } = useParams();
  const day = freeTrainingDays.find((trainingDay) => trainingDay.id === dayId);
  if (day == null) return <Navigate to="/free-training" replace />;

  return (
    <FreeTrainingDayPage
      day={day}
      exercises={exercises}
      preferredUnit={preferredUnit}
      onUpdateTrainingDay={updateTrainingDay}
      onDeleteTrainingDay={deleteTrainingDay}
      onBack={() => navigate("/free-training")}
    />
  );
}

export function EditCycleRoute({
  cycleData,
  history,
  profile,
  exercises,
  exerciseMaxes,
  onSubmit,
  onCancel,
}: {
  cycleData: CycleData | null;
  history: CycleData[];
  profile: UserProfile;
  exercises: AppData["exercises"];
  exerciseMaxes: ExerciseMaxEntry[];
  onSubmit: (cycleId: string, inputs: ProgramInputs, cycleName: string, profile: UserProfile) => void;
  onCancel: () => void;
}) {
  const { cycleId } = useParams();
  const cycle =
    cycleData != null && cycleData.id === cycleId
      ? cycleData
      : history.find((c) => c.id === cycleId);

  if (cycle == null) return <Navigate to="/history" replace />;

  return (
    <SetupForm
      defaultCycleName={cycle.name}
      initialProfile={profile}
      initialInputs={cycle.inputs}
      exercises={exercises}
      exerciseMaxes={exerciseMaxes}
      submitLabel="Save Changes"
      onSubmit={(inputs, name, updatedProfile) =>
        onSubmit(cycle.id, inputs, name, updatedProfile)
      }
      onCancel={onCancel}
    />
  );
}
