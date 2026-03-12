import { useState } from "react";
import type {
  ProgramWeek,
  WorkoutDay,
  WorkoutLog,
  SetLog,
} from "../types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { estimateFromPrescription, format1RM } from "../oneRepMax";

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
  const [show1RM, setShow1RM] = useState(false);

  function getSetLog(
    exerciseIndex: number,
    setIndex: number,
  ): SetLog | undefined {
    return log?.exerciseLogs[exerciseIndex]?.setLogs[setIndex];
  }

  return (
    <div className="min-h-dvh pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b px-4 py-3">
        <div className="max-w-lg mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground mb-1 -ml-2 h-7"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">
                {week.title} — {day.type === "lower" ? "Lower" : "Upper"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {formatDate(startDate, day.dayOffset)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {done && <Badge variant="success">Completed</Badge>}
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
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4">
        {/* Action buttons */}
        {!done && (
          <div className="flex gap-3 mb-6">
            <Button size="lg" className="flex-1" onClick={onStartWorkout}>
              Start Workout
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => onMarkComplete(emptyLog(day))}
            >
              Mark Done
            </Button>
          </div>
        )}

        {/* Workout notes */}
        {day.notes.length > 0 && (
          <Card className="mb-4 border-amber-800/30 bg-amber-950/20">
            <CardContent className="p-3">
              {day.notes.map((note, i) => (
                <p key={i} className="text-xs text-amber-300">
                  {note}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Exercises */}
        <div className="space-y-3">
          {day.exercises.map((exercise, exIdx) => (
            <Card key={exIdx}>
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{exercise.name}</CardTitle>
                  {exercise.isMainLift && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-primary border-primary/30"
                    >
                      Main
                    </Badge>
                  )}
                </div>
                {exercise.hasWarmUp && (
                  <p className="text-[10px] text-muted-foreground">
                    Warm up first
                  </p>
                )}
              </CardHeader>

              <CardContent className="pt-2">
                {/* Sets */}
                {exercise.sets.length > 0 && (
                  <div className="divide-y divide-border/50">
                    {exercise.sets.map((set, setIdx) => {
                      const setLog = getSetLog(exIdx, setIdx);
                      return (
                        <div
                          key={setIdx}
                          className="py-2 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-5 text-right">
                              {setIdx + 1}
                            </span>
                            <div>
                              {set.weight != null && (
                                <span className="text-base font-bold">
                                  {set.weight} {weightUnit}
                                </span>
                              )}
                              <span
                                className={`text-sm ${set.weight != null ? "text-muted-foreground ml-2" : "text-foreground/80"}`}
                              >
                                × {set.targetReps}
                              </span>
                              {show1RM && (() => {
                                const est = estimateFromPrescription(set.weight, set.targetReps);
                                if (est == null) return null;
                                return (
                                  <span className="text-[10px] text-primary/70 ml-2">
                                    ≈ 1RM {format1RM(est, weightUnit)}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>

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
                  <p className="text-xs text-muted-foreground py-1">
                    No prescribed sets — do as needed
                  </p>
                )}

                {/* Exercise notes */}
                {exercise.notes.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    {exercise.notes.map((note, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground">
                        {note}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Workout log notes */}
        {done && log != null && log.notes.length > 0 && (
          <Card className="mt-4">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Workout notes
              </p>
              <p className="text-sm">{log.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
