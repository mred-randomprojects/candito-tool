import { useState, useMemo, useEffect, useRef, memo } from "react";
import type {
  WorkoutDay,
  WorkoutLog,
  SetLog,
  Difficulty,
  WeightUnit,
  TrainingMaxSnapshot,
} from "../types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronUp, Eye, EyeOff, NotebookPen, SkipForward } from "lucide-react";
import { estimate1RM, estimateFromPrescription, format1RM } from "../oneRepMax";
import { getWarmUpSetsForExercise } from "../warmUp";
import { emptySetLog } from "../setLogs";
import { parseNullableFloat, parseNullableInt } from "../numberInput";
import { formatTrainingMaxSnapshot, trainingMaxSnapshotTitle } from "../trainingMaxSnapshot";

interface ActiveWorkoutProps {
  day: WorkoutDay;
  weekTitle: string;
  weightUnit: WeightUnit;
  existingLog: WorkoutLog | undefined;
  /** Log of the matching workout from an earlier week (linear program). */
  previousLog?: WorkoutLog;
  calculatedFrom: TrainingMaxSnapshot;
  onComplete: (log: WorkoutLog) => void;
  onSavePartial: (log: WorkoutLog) => void;
  onBack: () => void;
}

interface FlatSet {
  exerciseIndex: number;
  exerciseName: string;
  isMainLift: boolean;
  setIndex: number;
  totalSets: number;
  weight: number | null;
  targetReps: string;
  isWarmUp: boolean;
}

function buildFlatSets(day: WorkoutDay, unit: WeightUnit): FlatSet[] {
  const result: FlatSet[] = [];
  day.exercises.forEach((ex, exIdx) => {
    const warmUps = getWarmUpSetsForExercise(ex, unit);
    warmUps.forEach((wuSet, wuIdx) => {
      result.push({
        exerciseIndex: exIdx,
        exerciseName: ex.name,
        isMainLift: ex.isMainLift,
        setIndex: wuIdx,
        totalSets: warmUps.length,
        weight: wuSet.weight,
        targetReps: wuSet.targetReps,
        isWarmUp: true,
      });
    });
    ex.sets.forEach((set, setIdx) => {
      result.push({
        exerciseIndex: exIdx,
        exerciseName: ex.name,
        isMainLift: ex.isMainLift,
        setIndex: setIdx,
        totalSets: ex.sets.length,
        weight: set.weight,
        targetReps: set.targetReps,
        isWarmUp: false,
      });
    });
  });
  return result;
}

function initLog(day: WorkoutDay, existing: WorkoutLog | undefined): SetLog[][] {
  return day.exercises.map((ex, exIdx) =>
    ex.sets.map((_set, setIdx) => {
      const prev = existing?.exerciseLogs[exIdx]?.setLogs[setIdx];
      return prev ?? emptySetLog();
    }),
  );
}

function initWarmUpLog(
  day: WorkoutDay,
  unit: WeightUnit,
  existing: WorkoutLog | undefined,
): SetLog[][] {
  return day.exercises.map((ex, exIdx) => {
    const warmUps = getWarmUpSetsForExercise(ex, unit);
    return warmUps.map((_wuSet, wuIdx) => {
      const prev = existing?.exerciseLogs[exIdx]?.warmUpSetLogs?.[wuIdx];
      return prev ?? emptySetLog();
    });
  });
}

function findResumeIndex(
  day: WorkoutDay,
  unit: WeightUnit,
  existing: WorkoutLog | undefined,
): number {
  if (existing == null) return 0;
  const sets = buildFlatSets(day, unit);
  for (let i = 0; i < sets.length; i++) {
    const fs = sets[i];
    const sl = fs.isWarmUp
      ? existing.exerciseLogs[fs.exerciseIndex]?.warmUpSetLogs?.[fs.setIndex]
      : existing.exerciseLogs[fs.exerciseIndex]?.setLogs[fs.setIndex];
    if (sl == null) return i;
    if (
      sl.actualReps == null &&
      sl.actualWeight == null &&
      sl.difficulty == null &&
      sl.notes.length === 0
    ) {
      return i;
    }
  }
  return Math.max(sets.length - 1, 0);
}

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; activeClass: string }[] = [
  { value: 1, label: "Easy", activeClass: "bg-emerald-700 text-emerald-100 border-emerald-600" },
  { value: 2, label: "Med", activeClass: "bg-green-700 text-green-100 border-green-600" },
  { value: 3, label: "Hard", activeClass: "bg-yellow-700 text-yellow-100 border-yellow-600" },
  { value: 4, label: "V.Hard", activeClass: "bg-orange-700 text-orange-100 border-orange-600" },
  { value: 5, label: "Max", activeClass: "bg-red-700 text-red-100 border-red-600" },
];

export const ActiveWorkout = memo(function ActiveWorkout({
  day,
  weekTitle,
  weightUnit,
  existingLog,
  previousLog,
  calculatedFrom,
  onComplete,
  onSavePartial,
  onBack,
}: ActiveWorkoutProps) {
  const flatSets = useMemo(() => buildFlatSets(day, weightUnit), [day, weightUnit]);
  const [currentIndex, setCurrentIndex] = useState(() =>
    findResumeIndex(day, weightUnit, existingLog),
  );
  const [logs, setLogs] = useState<SetLog[][]>(() => initLog(day, existingLog));
  const [warmUpLogs, setWarmUpLogs] = useState<SetLog[][]>(() =>
    initWarmUpLog(day, weightUnit, existingLog),
  );
  const [workoutNotes, setWorkoutNotes] = useState(existingLog?.notes ?? "");
  const [showSummary, setShowSummary] = useState(false);
  const [show1RM, setShow1RM] = useState(false);
  const [showWorkoutNotes, setShowWorkoutNotes] = useState(false);

  const onSavePartialRef = useRef(onSavePartial);
  onSavePartialRef.current = onSavePartial;

  useEffect(() => {
    if (!hasAnyData() && existingLog == null) return;
    onSavePartialRef.current({
      completed: false,
      startedAt: existingLog?.startedAt ?? new Date().toISOString(),
      completedAt: null,
      exerciseLogs: buildExerciseLogs(),
      notes: workoutNotes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, warmUpLogs, workoutNotes]);

  // The visible weight/reps text is local so partial decimals ("77.")
  // survive typing; it reseeds from the log when navigating between sets.
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  useEffect(() => {
    const fs = flatSets[currentIndex];
    if (fs == null) return;
    const sl = fs.isWarmUp
      ? warmUpLogs[fs.exerciseIndex][fs.setIndex]
      : logs[fs.exerciseIndex][fs.setIndex];
    setWeightInput(sl.actualWeight != null ? String(sl.actualWeight) : "");
    setRepsInput(sl.actualReps != null ? String(sl.actualReps) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  if (flatSets.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">
          No prescribed sets for this workout.
        </p>
        <Button variant="ghost" onClick={handleExit}>
          Go back
        </Button>
      </div>
    );
  }

  const current = flatSets[currentIndex];
  const currentLog = current.isWarmUp
    ? warmUpLogs[current.exerciseIndex][current.setIndex]
    : logs[current.exerciseIndex][current.setIndex];
  const totalExercises = day.exercises.filter((e) => e.sets.length > 0).length;
  const exerciseNumber =
    new Set(flatSets.slice(0, currentIndex + 1).map((s) => s.exerciseIndex))
      .size;

  const progress = ((currentIndex + 1) / flatSets.length) * 100;

  function updateCurrentLog(updates: Partial<SetLog>) {
    const setter = current.isWarmUp ? setWarmUpLogs : setLogs;
    setter((prev) => {
      const next = prev.map((ex) => ex.map((s) => ({ ...s })));
      next[current.exerciseIndex][current.setIndex] = {
        ...next[current.exerciseIndex][current.setIndex],
        ...updates,
      };
      return next;
    });
  }

  function goNext() {
    if (currentIndex < flatSets.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowSummary(true);
    }
  }

  function goPrev() {
    if (showSummary) {
      setShowSummary(false);
      return;
    }
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  function buildExerciseLogs() {
    return logs.map((exLogs, exIdx) => {
      const exercise = day.exercises[exIdx];
      const wuLogs = warmUpLogs[exIdx];
      const warmUps = getWarmUpSetsForExercise(exercise, weightUnit);
      return {
        setLogs: exLogs.map((sl, setIdx) => ({
          ...sl,
          prescribedWeight: exercise.sets[setIdx]?.weight ?? null,
        })),
        ...(wuLogs.length > 0 ? {
          warmUpSetLogs: wuLogs.map((sl, wuIdx) => ({
            ...sl,
            prescribedWeight: warmUps[wuIdx]?.weight ?? null,
          })),
        } : {}),
      };
    });
  }

  function hasAnyData(): boolean {
    for (const exLogs of logs) {
      for (const sl of exLogs) {
        if (sl.actualReps != null || sl.actualWeight != null || sl.difficulty != null || sl.notes.length > 0) return true;
      }
    }
    for (const wuExLogs of warmUpLogs) {
      for (const sl of wuExLogs) {
        if (sl.actualReps != null || sl.actualWeight != null || sl.difficulty != null || sl.notes.length > 0) return true;
      }
    }
    if (workoutNotes.length > 0) return true;
    return false;
  }

  function finish() {
    const workoutLog: WorkoutLog = {
      completed: true,
      startedAt: existingLog?.startedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      exerciseLogs: buildExerciseLogs(),
      notes: workoutNotes,
    };
    onComplete(workoutLog);
  }

  function handleExit() {
    if (hasAnyData() || existingLog != null) {
      const partialLog: WorkoutLog = {
        completed: false,
        startedAt: existingLog?.startedAt ?? new Date().toISOString(),
        completedAt: null,
        exerciseLogs: buildExerciseLogs(),
        notes: workoutNotes,
      };
      onSavePartial(partialLog);
    }
    onBack();
  }

  // --- Summary view ---
  if (showSummary) {
    return (
      <div className="min-h-dvh pb-8">
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b px-4 py-3">
          <div className="max-w-lg mx-auto">
            <h1 className="text-lg font-bold">Workout Summary</h1>
            <p className="text-xs text-muted-foreground">{weekTitle}</p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
          {day.exercises.map((ex, exIdx) => {
            const warmUps = getWarmUpSetsForExercise(ex, weightUnit);
            if (ex.sets.length === 0 && warmUps.length === 0) return null;
            return (
              <Card key={exIdx}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm">{ex.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {warmUps.map((wuSet, wuIdx) => {
                    const wuSl = warmUpLogs[exIdx][wuIdx];
                    return (
                      <div key={`wu-${wuIdx}`} className="opacity-50">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Warm up #{wuIdx + 1}: {wuSet.weight} {weightUnit} × {wuSet.targetReps}
                          </span>
                          <span>
                            <span className="text-emerald-400 font-medium">
                              {wuSl.actualReps != null
                                ? `Did ${wuSl.actualReps}${wuSl.actualWeight != null ? ` @ ${wuSl.actualWeight} ${weightUnit}` : ""}`
                                : "—"}
                            </span>
                            {wuSl.actualReps != null && wuSl.actualReps <= 12 && (() => {
                              const w = wuSl.actualWeight ?? wuSet.weight;
                              if (w == null) return null;
                              const est = estimate1RM(w, wuSl.actualReps);
                              if (est == null) return null;
                              return <span className="text-[10px] text-primary/70 ml-1">[{est.toFixed(1)}]</span>;
                            })()}
                          </span>
                        </div>
                        {wuSl.notes.length > 0 && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 text-right">{wuSl.notes}</p>
                        )}
                      </div>
                    );
                  })}
                  {ex.sets.map((set, setIdx) => {
                    const sl = logs[exIdx][setIdx];
                    return (
                      <div key={setIdx}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Set {setIdx + 1}:{" "}
                            {set.weight != null
                              ? `${set.weight} ${weightUnit} × ${set.targetReps}`
                              : `× ${set.targetReps}`}
                          </span>
                          <span>
                            <span className="text-emerald-400 font-medium">
                              {sl.actualReps != null
                                ? `Did ${sl.actualReps}${sl.actualWeight != null ? ` @ ${sl.actualWeight} ${weightUnit}` : ""}`
                                : "—"}
                            </span>
                            {sl.actualReps != null && sl.actualReps <= 12 && (() => {
                              const w = sl.actualWeight ?? set.weight;
                              if (w == null) return null;
                              const est = estimate1RM(w, sl.actualReps);
                              if (est == null) return null;
                              return <span className="text-[10px] text-primary/70 ml-1">[{est.toFixed(1)}]</span>;
                            })()}
                          </span>
                        </div>
                        {sl.notes.length > 0 && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 text-right">{sl.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Workout notes
            </label>
            <textarea
              value={workoutNotes}
              onChange={(e) => setWorkoutNotes(e.target.value)}
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              placeholder="How did it go?"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={goPrev}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-500"
              size="lg"
              onClick={finish}
            >
              Finish Workout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Active set view ---
  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top bar */}
      <div className="bg-background/90 backdrop-blur-sm border-b px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-2 h-7"
              onClick={handleExit}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Save & Exit
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Exercise {exerciseNumber}/{totalExercises} —{" "}
                {current.isWarmUp
                  ? `Warm up #${current.setIndex + 1}/${current.totalSets}`
                  : `Set ${current.setIndex + 1}/${current.totalSets}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground"
                onClick={() => setShow1RM((prev) => !prev)}
                title={show1RM ? "Hide estimated 1RM" : "Show estimated 1RM"}
              >
                {show1RM ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <Progress value={progress} />
          <div
            className="mt-2 truncate text-[10px] font-semibold text-primary/80"
            title={trainingMaxSnapshotTitle(calculatedFrom)}
          >
            Calculated from {formatTrainingMaxSnapshot(calculatedFrom)}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-1">{current.exerciseName}</h2>
          <p className={`text-sm ${current.isWarmUp ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
            {current.isWarmUp
              ? `Warm up #${current.setIndex + 1} of ${current.totalSets}`
              : `Set ${current.setIndex + 1} of ${current.totalSets}`}
          </p>
        </div>

        {/* Weight & reps display */}
        <Card className={`text-center mb-8 w-full max-w-xs ${current.isWarmUp ? "opacity-60" : ""}`}>
          <CardContent className="p-8">
            {current.weight != null && (
              <div className="mb-3">
                <span className="text-5xl font-black">{current.weight}</span>
                <span className="text-xl text-muted-foreground ml-2">
                  {weightUnit}
                </span>
              </div>
            )}
            <div>
              <span className="text-2xl text-foreground/80">
                × {current.targetReps}
              </span>
              {current.targetReps === "MR" && (
                <p className="text-xs text-muted-foreground mt-1">Max Reps</p>
              )}
              {current.targetReps === "MR10" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Max Reps (cap at 10)
                </p>
              )}
            </div>
            {show1RM && (() => {
              const est = estimateFromPrescription(current.weight, current.targetReps);
              if (est == null) return null;
              return (
                <p className="text-xs text-primary/70 mt-3">
                  ≈ 1RM {format1RM(est, weightUnit)}
                </p>
              );
            })()}
            {(() => {
              if (current.isWarmUp) return null;
              const prevSetLog =
                previousLog?.exerciseLogs[current.exerciseIndex]?.setLogs[
                  current.setIndex
                ];
              if (
                prevSetLog == null ||
                (prevSetLog.actualReps == null && prevSetLog.actualWeight == null)
              ) {
                return null;
              }
              const prevWeight =
                prevSetLog.actualWeight ?? prevSetLog.prescribedWeight;
              return (
                <p className="text-xs text-primary/70 mt-3">
                  Last time:{" "}
                  {prevWeight != null ? `${prevWeight} ${weightUnit}` : "—"}
                  {prevSetLog.actualReps != null
                    ? ` × ${prevSetLog.actualReps}`
                    : ""}
                </p>
              );
            })()}
          </CardContent>
        </Card>

        {/* Weight, Reps, Difficulty, Notes */}
        <div className="w-full max-w-xs space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 text-center">
                Weight ({weightUnit})
              </label>
              <Input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={weightInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setWeightInput(val);
                  updateCurrentLog({ actualWeight: parseNullableFloat(val) });
                }}
                className="text-center text-xl font-bold h-14"
                placeholder={current.weight != null ? String(current.weight) : "—"}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 text-center">
                Reps done
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={repsInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setRepsInput(val);
                  updateCurrentLog({ actualReps: parseNullableInt(val) });
                }}
                className="text-center text-xl font-bold h-14"
                placeholder="—"
              />
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 text-center">
              Difficulty
            </label>
            <div className="flex gap-1.5">
              {DIFFICULTY_OPTIONS.map(({ value, label, activeClass }) => (
                <button
                  key={value}
                  onClick={() =>
                    updateCurrentLog({
                      difficulty:
                        value,
                    })
                  }
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all border ${
                    currentLog.difficulty === value
                      ? activeClass
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 text-center">
              Notes
            </label>
            <Input
              value={currentLog.notes}
              onChange={(e) => updateCurrentLog({ notes: e.target.value })}
              className="text-center text-sm"
              placeholder="Optional notes for this set..."
            />
          </div>

          {/* Session notes — for anything beyond the prescribed sets */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowWorkoutNotes((prev) => !prev)}
              className="mx-auto flex min-h-9 items-center gap-1.5 px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {showWorkoutNotes ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <NotebookPen className="h-3.5 w-3.5" />
              )}
              Session notes
              {!showWorkoutNotes && workoutNotes.trim().length > 0 && (
                <span className="max-w-[9rem] truncate text-muted-foreground/60">
                  — {workoutNotes}
                </span>
              )}
            </button>
            {showWorkoutNotes && (
              <textarea
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                rows={3}
                autoFocus
                className="mt-1.5 flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Anything else from today — cardio, aches, tweaks..."
              />
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-background/90 backdrop-blur-sm border-t px-4 py-4">
        <div className="max-w-lg mx-auto flex gap-3">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="px-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={goNext}
          >
            <SkipForward className="h-4 w-4 mr-1" />
            Skip
          </Button>
          <Button size="lg" className="flex-1" onClick={goNext}>
            {currentIndex === flatSets.length - 1 ? "Review" : "Next"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
});
