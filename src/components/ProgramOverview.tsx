import type { Program, CycleData, WorkoutLog } from "../types";

interface ProgramOverviewProps {
  program: Program;
  cycleData: CycleData;
  onSelectWorkout: (weekIndex: number, dayIndex: number) => void;
  onMarkWeekComplete: (weekIndex: number) => void;
  onNewCycle: () => void;
}

function formatDate(startDate: string, dayOffset: number): string {
  const d = new Date(startDate + "T00:00:00");
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getWorkoutLog(
  cycleData: CycleData,
  weekIndex: number,
  dayIndex: number,
): WorkoutLog | undefined {
  return cycleData.workoutLogs[`w${weekIndex}-d${dayIndex}`];
}

function isWeekComplete(
  cycleData: CycleData,
  weekIndex: number,
  dayCount: number,
): boolean {
  if (dayCount === 0) return false;
  for (let i = 0; i < dayCount; i++) {
    const log = getWorkoutLog(cycleData, weekIndex, i);
    if (log == null || !log.completed) return false;
  }
  return true;
}

function getWorkoutSummary(
  exercises: { name: string; isMainLift: boolean }[],
): string {
  const mainLifts = exercises
    .filter((e) => e.isMainLift)
    .map((e) => {
      if (e.name === "Bench Press") return "Bench";
      if (e.name === "Extra Volume Squats") return "";
      if (e.name === "Back Off Squats") return "";
      return e.name;
    })
    .filter((n) => n.length > 0);
  const unique = [...new Set(mainLifts)];
  return unique.join(" + ");
}

export function ProgramOverview({
  program,
  cycleData,
  onSelectWorkout,
  onMarkWeekComplete,
  onNewCycle,
}: ProgramOverviewProps) {
  const { inputs } = program;

  return (
    <div className="min-h-dvh pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a12]/90 backdrop-blur-sm border-b border-border px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Candito 6-Week</h1>
            <p className="text-xs text-gray-500">
              Started{" "}
              {new Date(inputs.startDate + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" },
              )}
            </p>
          </div>
          <button
            onClick={onNewCycle}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-gray-600"
          >
            New Cycle
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="max-w-lg mx-auto px-4 mt-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Bench", value: inputs.bench1RM },
            { label: "Squat", value: inputs.squat1RM },
            { label: "Deadlift", value: inputs.deadlift1RM },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-surface rounded-xl p-3 text-center border border-border"
            >
              <div className="text-xs text-gray-500 mb-0.5">{label} 1RM</div>
              <div className="text-lg font-bold text-white">
                {value}
                <span className="text-xs text-gray-500 ml-0.5">
                  {inputs.weightUnit}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weeks */}
      <div className="max-w-lg mx-auto px-4 mt-6 space-y-4">
        {program.weeks.map((week, weekIndex) => {
          const weekComplete = isWeekComplete(
            cycleData,
            weekIndex,
            week.workoutDays.length,
          );
          const isWeek6 = week.weekNumber === 6;

          return (
            <div
              key={week.weekNumber}
              className={`rounded-2xl border overflow-hidden ${
                weekComplete
                  ? "border-emerald-800/50 bg-emerald-950/20"
                  : "border-border bg-surface"
              }`}
            >
              {/* Week header */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">
                      {week.title}
                    </h2>
                    {weekComplete && (
                      <span className="text-xs bg-emerald-900/60 text-emerald-400 px-2 py-0.5 rounded-full">
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {week.subtitle}
                  </p>
                </div>
                {!isWeek6 &&
                  !weekComplete &&
                  week.workoutDays.length > 0 && (
                    <button
                      onClick={() => onMarkWeekComplete(weekIndex)}
                      className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded border border-border hover:border-gray-600"
                    >
                      Mark all done
                    </button>
                  )}
              </div>

              {/* Workout days */}
              {!isWeek6 && (
                <div className="px-3 pb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {week.workoutDays.map((day, dayIndex) => {
                    const log = getWorkoutLog(cycleData, weekIndex, dayIndex);
                    const done = log?.completed === true;
                    const started = log?.startedAt != null;

                    return (
                      <button
                        key={dayIndex}
                        onClick={() => onSelectWorkout(weekIndex, dayIndex)}
                        className={`rounded-xl p-3 text-left transition-all ${
                          done
                            ? "bg-emerald-950/40 border border-emerald-800/40"
                            : started
                              ? "bg-amber-950/30 border border-amber-800/40"
                              : "bg-surface-light border border-border hover:border-gray-600"
                        }`}
                      >
                        <div className="text-[10px] text-gray-500 mb-1">
                          {formatDate(inputs.startDate, day.dayOffset)}
                        </div>
                        <div className="text-sm font-semibold text-white mb-0.5">
                          {day.type === "lower" ? "Lower" : "Upper"}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">
                          {getWorkoutSummary(day.exercises)}
                        </div>
                        {done && (
                          <div className="text-[10px] text-emerald-500 mt-1">
                            Completed
                          </div>
                        )}
                        {started && !done && (
                          <div className="text-[10px] text-amber-500 mt-1">
                            In progress
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Week 6 special content */}
              {isWeek6 && (
                <div className="px-4 pb-4 space-y-2">
                  <p className="text-xs text-gray-400">
                    Choose one of these options:
                  </p>
                  <div className="space-y-1.5 text-xs text-gray-300">
                    <div className="bg-surface-light rounded-lg p-2.5 border border-border">
                      <span className="text-accent font-semibold">1.</span> Skip
                      Week 6. Use projected 1RM from Week 5. Start next cycle.
                    </div>
                    <div className="bg-surface-light rounded-lg p-2.5 border border-border">
                      <span className="text-accent font-semibold">2.</span> Use
                      projected max for next cycle, but take a deload week.
                    </div>
                    <div className="bg-surface-light rounded-lg p-2.5 border border-border">
                      <span className="text-accent font-semibold">3.</span>{" "}
                      Test your actual 1RM, then deload or start new cycle.
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    Projected max: multiply Week 5 weight by 1.03 (2 reps),
                    1.06 (3 reps), or 1.09 (4 reps).
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
