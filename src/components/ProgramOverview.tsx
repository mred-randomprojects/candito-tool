import type { Program, CycleData, WorkoutLog } from "../types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";

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
  return [...new Set(mainLifts)].join(" + ");
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
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Candito 6-Week</h1>
            <p className="text-xs text-muted-foreground">
              Started{" "}
              {new Date(inputs.startDate + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" },
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onNewCycle}>
            New Cycle
          </Button>
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
            <Card key={label} className="text-center">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground mb-0.5">
                  {label} 1RM
                </div>
                <div className="text-lg font-bold">
                  {value}
                  <span className="text-xs text-muted-foreground ml-0.5">
                    {inputs.weightUnit}
                  </span>
                </div>
              </CardContent>
            </Card>
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
            <Card
              key={week.weekNumber}
              className={
                weekComplete
                  ? "border-emerald-800/50 bg-emerald-950/20"
                  : undefined
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle>{week.title}</CardTitle>
                    {weekComplete && <Badge variant="success">Done</Badge>}
                  </div>
                  {!isWeek6 && !weekComplete && week.workoutDays.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground h-7"
                      onClick={() => onMarkWeekComplete(weekIndex)}
                    >
                      Mark all done
                    </Button>
                  )}
                </div>
                <CardDescription>{week.subtitle}</CardDescription>
              </CardHeader>

              {/* Workout days grid */}
              {!isWeek6 && (
                <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {week.workoutDays.map((day, dayIndex) => {
                    const log = getWorkoutLog(cycleData, weekIndex, dayIndex);
                    const done = log?.completed === true;
                    const started = log?.startedAt != null;

                    return (
                      <button
                        key={dayIndex}
                        onClick={() => onSelectWorkout(weekIndex, dayIndex)}
                        className={`rounded-xl p-3 text-left transition-all border ${
                          done
                            ? "bg-emerald-950/30 border-emerald-800/40"
                            : started
                              ? "bg-amber-950/20 border-amber-800/40"
                              : "bg-secondary/50 border-border hover:border-foreground/20 hover:bg-secondary"
                        }`}
                      >
                        <div className="text-[10px] text-muted-foreground mb-1">
                          {formatDate(inputs.startDate, day.dayOffset)}
                        </div>
                        <div className="text-sm font-semibold mb-0.5">
                          {day.type === "lower" ? "Lower" : "Upper"}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
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
                </CardContent>
              )}

              {/* Week 6 special content */}
              {isWeek6 && (
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Choose one of these options:
                  </p>
                  <div className="space-y-1.5 text-xs">
                    {[
                      "Skip Week 6. Use projected 1RM from Week 5. Start next cycle.",
                      "Use projected max for next cycle, but take a deload week.",
                      "Test your actual 1RM, then deload or start new cycle.",
                    ].map((text, i) => (
                      <div
                        key={i}
                        className="bg-secondary/50 rounded-lg p-2.5 border"
                      >
                        <span className="text-primary font-semibold">
                          {i + 1}.
                        </span>{" "}
                        {text}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Projected max: multiply Week 5 weight by 1.03 (2 reps),
                    1.06 (3 reps), or 1.09 (4 reps).
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
