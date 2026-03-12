import type {
  ProgramWeek,
  WorkoutDay,
  WorkoutLog,
  SetLog,
} from "../types";

interface WorkoutViewProps {
  week: ProgramWeek;
  day: WorkoutDay;
  weekIndex: number;
  dayIndex: number;
  startDate: string;
  weightUnit: string;
  log: WorkoutLog | undefined;
  onStartWorkout: () => void;
  onBack: () => void;
  onMarkComplete: (log: WorkoutLog) => void;
}

function formatDate(startDate: string, dayOffset: number): string {
  const d = new Date(startDate + "T00:00:00");
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function emptyLog(day: WorkoutDay): WorkoutLog {
  return {
    completed: true,
    startedAt: null,
    completedAt: new Date().toISOString(),
    exerciseLogs: day.exercises.map((ex) => ({
      setLogs: ex.sets.map(() => ({
        actualReps: null,
        difficulty: null,
        actualWeight: null,
        notes: "",
      })),
    })),
    notes: "",
  };
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Easy",
  2: "Moderate",
  3: "Hard",
  4: "Very Hard",
  5: "Maximum",
};

const DIFFICULTY_COLORS: Record<number, string> = {
  1: "text-emerald-400",
  2: "text-green-400",
  3: "text-yellow-400",
  4: "text-orange-400",
  5: "text-red-400",
};

export function WorkoutView({
  week,
  day,
  startDate,
  weightUnit,
  log,
  onStartWorkout,
  onBack,
  onMarkComplete,
}: WorkoutViewProps) {
  const done = log?.completed === true;

  function getSetLog(
    exerciseIndex: number,
    setIndex: number,
  ): SetLog | undefined {
    return log?.exerciseLogs[exerciseIndex]?.setLogs[setIndex];
  }

  return (
    <div className="min-h-dvh pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a12]/90 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white text-sm mb-1 transition-colors"
          >
            ← Back to overview
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">
                {week.title} — Day {day.type === "lower" ? "Lower" : "Upper"}
              </h1>
              <p className="text-xs text-gray-500">
                {formatDate(startDate, day.dayOffset)}
              </p>
            </div>
            {done && (
              <span className="text-xs bg-emerald-900/60 text-emerald-400 px-2.5 py-1 rounded-full">
                Completed
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4">
        {/* Action buttons */}
        {!done && (
          <div className="flex gap-3 mb-6">
            <button
              onClick={onStartWorkout}
              className="flex-1 rounded-xl bg-accent text-black font-bold py-3.5 text-base hover:bg-yellow-400 transition-colors"
            >
              Start Workout
            </button>
            <button
              onClick={() => onMarkComplete(emptyLog(day))}
              className="rounded-xl bg-surface-light text-gray-300 font-medium py-3.5 px-5 text-sm border border-border hover:border-gray-600 transition-colors"
            >
              Mark Done
            </button>
          </div>
        )}

        {/* Workout notes */}
        {day.notes.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-3 mb-4">
            {day.notes.map((note, i) => (
              <p key={i} className="text-xs text-amber-300">
                {note}
              </p>
            ))}
          </div>
        )}

        {/* Exercises */}
        <div className="space-y-3">
          {day.exercises.map((exercise, exIdx) => (
            <div
              key={exIdx}
              className="bg-surface rounded-xl border border-border overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    {exercise.name}
                  </h3>
                  {exercise.isMainLift && (
                    <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                      Main
                    </span>
                  )}
                </div>
                {exercise.hasWarmUp && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Warm up first
                  </p>
                )}
              </div>

              {/* Sets */}
              {exercise.sets.length > 0 && (
                <div className="divide-y divide-border/50">
                  {exercise.sets.map((set, setIdx) => {
                    const setLog = getSetLog(exIdx, setIdx);
                    return (
                      <div
                        key={setIdx}
                        className="px-4 py-2.5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 w-5">
                            {setIdx + 1}
                          </span>
                          <div>
                            {set.weight != null && (
                              <span className="text-base font-bold text-white">
                                {set.weight} {weightUnit}
                              </span>
                            )}
                            <span
                              className={`text-sm ${set.weight != null ? "text-gray-400 ml-2" : "text-gray-300"}`}
                            >
                              × {set.targetReps}
                            </span>
                          </div>
                        </div>

                        {/* Logged data */}
                        {setLog != null && setLog.actualReps != null && (
                          <div className="text-right">
                            <span className="text-sm text-emerald-400 font-medium">
                              Did {setLog.actualReps}
                            </span>
                            {setLog.difficulty != null && (
                              <span
                                className={`text-[10px] ml-1.5 ${DIFFICULTY_COLORS[setLog.difficulty]}`}
                              >
                                {DIFFICULTY_LABELS[setLog.difficulty]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {exercise.sets.length === 0 && (
                <div className="px-4 py-2.5 text-xs text-gray-500">
                  No prescribed sets — do as needed
                </div>
              )}

              {/* Exercise notes */}
              {exercise.notes.length > 0 && (
                <div className="px-4 py-2 bg-surface-light/50">
                  {exercise.notes.map((note, i) => (
                    <p key={i} className="text-[10px] text-gray-400">
                      {note}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Workout log notes */}
        {done && log != null && log.notes.length > 0 && (
          <div className="mt-4 bg-surface rounded-xl border border-border p-3">
            <p className="text-xs text-gray-500 mb-1">Workout notes</p>
            <p className="text-sm text-gray-300">{log.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
