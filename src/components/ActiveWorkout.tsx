import { useState, useMemo } from "react";
import type {
  WorkoutDay,
  WorkoutLog,
  SetLog,
  Difficulty,
} from "../types";

interface ActiveWorkoutProps {
  day: WorkoutDay;
  weekTitle: string;
  weightUnit: string;
  existingLog: WorkoutLog | undefined;
  onComplete: (log: WorkoutLog) => void;
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
}

function buildFlatSets(day: WorkoutDay): FlatSet[] {
  const result: FlatSet[] = [];
  day.exercises.forEach((ex, exIdx) => {
    ex.sets.forEach((set, setIdx) => {
      result.push({
        exerciseIndex: exIdx,
        exerciseName: ex.name,
        isMainLift: ex.isMainLift,
        setIndex: setIdx,
        totalSets: ex.sets.length,
        weight: set.weight,
        targetReps: set.targetReps,
      });
    });
  });
  return result;
}

function initLog(day: WorkoutDay, existing: WorkoutLog | undefined): SetLog[][] {
  if (existing != null) {
    return day.exercises.map((ex, exIdx) =>
      ex.sets.map((_set, setIdx) => {
        const prev = existing.exerciseLogs[exIdx]?.setLogs[setIdx];
        return prev ?? { actualReps: null, difficulty: null, actualWeight: null, notes: "" };
      }),
    );
  }
  return day.exercises.map((ex) =>
    ex.sets.map(() => ({
      actualReps: null,
      difficulty: null,
      actualWeight: null,
      notes: "",
    })),
  );
}

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; color: string }[] = [
  { value: 1, label: "Easy", color: "bg-emerald-800 text-emerald-200" },
  { value: 2, label: "Med", color: "bg-green-800 text-green-200" },
  { value: 3, label: "Hard", color: "bg-yellow-800 text-yellow-200" },
  { value: 4, label: "V.Hard", color: "bg-orange-800 text-orange-200" },
  { value: 5, label: "Max", color: "bg-red-800 text-red-200" },
];

export function ActiveWorkout({
  day,
  weekTitle,
  weightUnit,
  existingLog,
  onComplete,
  onBack,
}: ActiveWorkoutProps) {
  const flatSets = useMemo(() => buildFlatSets(day), [day]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logs, setLogs] = useState<SetLog[][]>(() => initLog(day, existingLog));
  const [workoutNotes, setWorkoutNotes] = useState(existingLog?.notes ?? "");
  const [showSummary, setShowSummary] = useState(false);

  if (flatSets.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6">
        <p className="text-gray-400 mb-4">No prescribed sets for this workout.</p>
        <button
          onClick={onBack}
          className="text-accent hover:text-yellow-400 transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  const current = flatSets[currentIndex];
  const currentLog = logs[current.exerciseIndex][current.setIndex];
  const totalExercises = day.exercises.filter((e) => e.sets.length > 0).length;
  const exerciseNumber =
    new Set(flatSets.slice(0, currentIndex + 1).map((s) => s.exerciseIndex))
      .size;

  const progress = ((currentIndex + 1) / flatSets.length) * 100;

  function updateCurrentLog(updates: Partial<SetLog>) {
    setLogs((prev) => {
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

  function finish() {
    const workoutLog: WorkoutLog = {
      completed: true,
      startedAt: existingLog?.startedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      exerciseLogs: logs.map((exLogs) => ({ setLogs: exLogs })),
      notes: workoutNotes,
    };
    onComplete(workoutLog);
  }

  if (showSummary) {
    return (
      <div className="min-h-dvh pb-8">
        <div className="sticky top-0 z-10 bg-[#0a0a12]/90 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="max-w-lg mx-auto">
            <h1 className="text-lg font-bold text-white">Workout Summary</h1>
            <p className="text-xs text-gray-500">{weekTitle}</p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
          {day.exercises.map((ex, exIdx) => {
            if (ex.sets.length === 0) return null;
            return (
              <div key={exIdx} className="bg-surface rounded-xl border border-border p-4">
                <h3 className="text-sm font-bold text-white mb-2">
                  {ex.name}
                </h3>
                <div className="space-y-1">
                  {ex.sets.map((set, setIdx) => {
                    const sl = logs[exIdx][setIdx];
                    return (
                      <div
                        key={setIdx}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-400">
                          Set {setIdx + 1}:{" "}
                          {set.weight != null
                            ? `${set.weight} ${weightUnit} × ${set.targetReps}`
                            : `× ${set.targetReps}`}
                        </span>
                        <span className="text-emerald-400">
                          {sl.actualReps != null
                            ? `Did ${sl.actualReps}`
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Workout notes
            </label>
            <textarea
              value={workoutNotes}
              onChange={(e) => setWorkoutNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-surface-light border border-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              placeholder="How did it go?"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={goPrev}
              className="rounded-xl bg-surface-light text-gray-300 font-medium py-3 px-6 text-sm border border-border hover:border-gray-600 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={finish}
              className="flex-1 rounded-xl bg-emerald-600 text-white font-bold py-3 text-base hover:bg-emerald-500 transition-colors"
            >
              Finish Workout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top bar */}
      <div className="bg-[#0a0a12]/90 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              ← Exit
            </button>
            <span className="text-xs text-gray-500">
              Exercise {exerciseNumber}/{totalExercises} — Set{" "}
              {current.setIndex + 1}/{current.totalSets}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-surface-lighter rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-1">
            {current.exerciseName}
          </h2>
          <p className="text-sm text-gray-500">
            Set {current.setIndex + 1} of {current.totalSets}
          </p>
        </div>

        {/* Weight & reps display */}
        <div className="bg-surface rounded-2xl border border-border p-8 text-center mb-8 w-full max-w-xs">
          {current.weight != null && (
            <div className="mb-3">
              <span className="text-5xl font-black text-white">
                {current.weight}
              </span>
              <span className="text-xl text-gray-400 ml-2">{weightUnit}</span>
            </div>
          )}
          <div className={current.weight != null ? "" : "mb-0"}>
            <span className="text-2xl text-gray-300">
              × {current.targetReps}
            </span>
            {current.targetReps === "MR" && (
              <p className="text-xs text-gray-500 mt-1">Max Reps</p>
            )}
            {current.targetReps === "MR10" && (
              <p className="text-xs text-gray-500 mt-1">
                Max Reps (cap at 10)
              </p>
            )}
          </div>
        </div>

        {/* Reps input */}
        <div className="w-full max-w-xs space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 text-center">
              Reps completed
            </label>
            <input
              type="number"
              min="0"
              value={currentLog.actualReps ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                updateCurrentLog({
                  actualReps: val === "" ? null : parseInt(val, 10),
                });
              }}
              className="w-full rounded-xl bg-surface-light border border-border px-4 py-3 text-center text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="—"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 text-center">
              Difficulty
            </label>
            <div className="flex gap-1.5">
              {DIFFICULTY_OPTIONS.map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() =>
                    updateCurrentLog({
                      difficulty:
                        currentLog.difficulty === value ? null : value,
                    })
                  }
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                    currentLog.difficulty === value
                      ? color + " ring-2 ring-white/30"
                      : "bg-surface-light text-gray-500 border border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-[#0a0a12]/90 backdrop-blur-sm border-t border-border px-4 py-4">
        <div className="max-w-lg mx-auto flex gap-3">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className={`rounded-xl py-3 px-6 text-sm font-medium transition-colors ${
              currentIndex === 0
                ? "bg-surface-light text-gray-700 cursor-not-allowed"
                : "bg-surface-light text-gray-300 border border-border hover:border-gray-600"
            }`}
          >
            ← Prev
          </button>
          <button
            onClick={goNext}
            className="flex-1 rounded-xl bg-accent text-black font-bold py-3 text-base hover:bg-yellow-400 transition-colors"
          >
            {currentIndex === flatSets.length - 1 ? "Review →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
