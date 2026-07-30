import { Navigate, useNavigate, useParams } from "react-router-dom";
import type {
  AppData,
  CycleData,
  DateOverride,
  ExerciseMaxEntry,
  FreeTrainingDay,
  Program,
  ProgramInputs,
  UserProfile,
  WeightUnit,
  WorkoutLog,
} from "../types";
import { programTypeFromInputs } from "../types";
import { findPreviousComparableSessions } from "../programEngine";
import {
  signWorkoutLogPrescription,
  snapshotFromInputs,
} from "../trainingMaxSnapshot";
import { SetupForm } from "./SetupForm";
import { WorkoutView, type PreviousSession } from "./WorkoutView";
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

export function WorkoutRoute({
  program,
  activeCycle,
  profile,
  isReadOnly,
  updateLog,
  updateDateOverride,
  navigate,
}: {
  program: Program;
  activeCycle: CycleData;
  profile: UserProfile;
  isReadOnly: boolean;
  updateLog: (cycleId: string, weekIndex: number, dayIndex: number, log: WorkoutLog) => void;
  updateDateOverride: (cycleId: string, weekIndex: number, dayIndex: number, override: DateOverride | null) => void;
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
