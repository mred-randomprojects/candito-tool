import { useState } from "react";
import { format, parse } from "date-fns";
import type {
  ProgramWeek,
  WorkoutDay,
  WorkoutLog,
  SetLog,
  WeightUnit,
  DateOverride,
} from "../types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { ArrowLeft, Eye, EyeOff, Check, X, CalendarDays } from "lucide-react";
import { estimate1RM, estimateFromPrescription, format1RM } from "../oneRepMax";
import { classifyStrength, liftFromExerciseName, LEVEL_COLORS } from "../strengthStandards";
import type { Sex } from "../types";
import { getWarmUpSetsForExercise } from "../warmUp";
import { cn } from "@/lib/utils";

interface EditingSet {
  exerciseIndex: number;
  setIndex: number;
  isWarmUp: boolean;
}

interface WorkoutViewProps {
  week: ProgramWeek;
  day: WorkoutDay;
  weekIndex: number;
  dayIndex: number;
  startDate: string;
  weightUnit: WeightUnit;
  bodyWeight?: number;
  sex?: Sex;
  log: WorkoutLog | undefined;
  dateOverride?: DateOverride;
  onStartWorkout: () => void;
  onBack: () => void;
  onMarkComplete: (log: WorkoutLog) => void;
  onUpdateLog?: (log: WorkoutLog) => void;
  onUpdateDateOverride?: (override: DateOverride | null) => void;
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
      setLogs: ex.sets.map((set) => ({
        actualReps: null,
        difficulty: null,
        actualWeight: null,
        prescribedWeight: set.weight,
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
  bodyWeight,
  sex,
  log,
  dateOverride,
  onStartWorkout,
  onBack,
  onMarkComplete,
  onUpdateLog,
  onUpdateDateOverride,
}: WorkoutViewProps) {
  const done = log?.completed === true;
  const [show1RM, setShow1RM] = useState(false);
  const [editingSet, setEditingSet] = useState<EditingSet | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editReason, setEditReason] = useState("");

  const originalDate = (() => {
    const d = new Date(startDate + "T00:00:00");
    d.setDate(d.getDate() + day.dayOffset);
    return d;
  })();

  const displayDate = dateOverride != null
    ? new Date(dateOverride.date + "T00:00:00")
    : originalDate;

  function handleSaveDateOverride() {
    if (editDate == null || editReason.trim().length === 0 || onUpdateDateOverride == null) return;
    onUpdateDateOverride({
      date: format(editDate, "yyyy-MM-dd"),
      reason: editReason.trim(),
    });
    setDatePopoverOpen(false);
  }

  function handleRemoveDateOverride() {
    onUpdateDateOverride?.(null);
    setDatePopoverOpen(false);
  }

  function getSetLog(
    exerciseIndex: number,
    setIndex: number,
  ): SetLog | undefined {
    return log?.exerciseLogs[exerciseIndex]?.setLogs[setIndex];
  }

  function getWarmUpSetLog(
    exerciseIndex: number,
    setIndex: number,
  ): SetLog | undefined {
    return log?.exerciseLogs[exerciseIndex]?.warmUpSetLogs?.[setIndex];
  }

  function startEditing(exIdx: number, setIdx: number, isWarmUp: boolean) {
    const setLog = isWarmUp
      ? getWarmUpSetLog(exIdx, setIdx)
      : getSetLog(exIdx, setIdx);
    setEditingSet({ exerciseIndex: exIdx, setIndex: setIdx, isWarmUp });
    setEditWeight(setLog?.actualWeight != null ? String(setLog.actualWeight) : "");
    setEditReps(setLog?.actualReps != null ? String(setLog.actualReps) : "");
    setEditNotes(setLog?.notes ?? "");
  }

  function cancelEditing() {
    setEditingSet(null);
  }

  function saveEdit() {
    if (editingSet == null || log == null || onUpdateLog == null) return;
    const { exerciseIndex, setIndex, isWarmUp } = editingSet;

    const updatedLog: WorkoutLog = {
      ...log,
      exerciseLogs: log.exerciseLogs.map((exLog, exIdx) => {
        if (exIdx !== exerciseIndex) return exLog;

        if (isWarmUp) {
          const warmUpSetLogs = (exLog.warmUpSetLogs ?? []).map((sl, slIdx) => {
            if (slIdx !== setIndex) return sl;
            return {
              ...sl,
              actualWeight: editWeight === "" ? null : parseFloat(editWeight),
              actualReps: editReps === "" ? null : parseInt(editReps, 10),
              notes: editNotes,
            };
          });
          return { ...exLog, warmUpSetLogs };
        }

        const setLogs = exLog.setLogs.map((sl, slIdx) => {
          if (slIdx !== setIndex) return sl;
          return {
            ...sl,
            actualWeight: editWeight === "" ? null : parseFloat(editWeight),
            actualReps: editReps === "" ? null : parseInt(editReps, 10),
            notes: editNotes,
          };
        });
        return { ...exLog, setLogs };
      }),
    };

    onUpdateLog(updatedLog);
    setEditingSet(null);
  }

  const isEditing = (exIdx: number, setIdx: number, isWarmUp: boolean) =>
    editingSet != null &&
    editingSet.exerciseIndex === exIdx &&
    editingSet.setIndex === setIdx &&
    editingSet.isWarmUp === isWarmUp;

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
              <div className="flex items-center gap-1.5">
                <Popover
                  open={datePopoverOpen}
                  onOpenChange={(open) => {
                    if (open) {
                      setEditDate(dateOverride != null
                        ? parse(dateOverride.date, "yyyy-MM-dd", new Date())
                        : originalDate);
                      setEditReason(dateOverride?.reason ?? "");
                    }
                    setDatePopoverOpen(open);
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-1 text-xs transition-colors",
                        dateOverride != null
                          ? "text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <CalendarDays className="h-3 w-3" />
                      {displayDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4 space-y-3" align="start">
                    {dateOverride != null && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                        <div className="text-[10px] text-amber-400/70 mb-0.5">Reason for reschedule</div>
                        <div className="text-xs text-amber-300">{dateOverride.reason}</div>
                      </div>
                    )}
                    {onUpdateDateOverride != null && (
                      <>
                        <Calendar
                          mode="single"
                          selected={editDate}
                          onSelect={(d) => { if (d != null) setEditDate(d); }}
                          initialFocus
                        />
                        <Input
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          placeholder="Reason for rescheduling..."
                          className="text-sm h-8"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={editDate == null || editReason.trim().length === 0}
                            onClick={handleSaveDateOverride}
                          >
                            Save
                          </Button>
                          {dateOverride != null && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={handleRemoveDateOverride}
                            >
                              Remove
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setDatePopoverOpen(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
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
              {log?.startedAt != null ? "Continue Workout" : "Start Workout"}
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
                {exercise.hasWarmUp && getWarmUpSetsForExercise(exercise, weightUnit).length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Warm up first
                  </p>
                )}
              </CardHeader>

              <CardContent className="pt-2">
                {/* Warm-up + working sets */}
                {(() => {
                  const warmUps = getWarmUpSetsForExercise(exercise, weightUnit);
                  const hasAnySets = warmUps.length > 0 || exercise.sets.length > 0;

                  if (!hasAnySets) return null;

                  return (
                    <div className="divide-y divide-border/50">
                      {/* Warm-up sets */}
                      {warmUps.map((wuSet, wuIdx) => {
                        const wuLog = getWarmUpSetLog(exIdx, wuIdx);
                        const editing = isEditing(exIdx, wuIdx, true);
                        const canEdit = log != null && onUpdateLog != null;
                        return (
                          <div key={`wu-${wuIdx}`} className="py-2 opacity-50">
                            <div
                              className={`flex items-center justify-between ${canEdit ? "cursor-pointer hover:bg-secondary/50 -mx-2 px-2 rounded-lg" : ""}`}
                              onClick={() => {
                                if (canEdit) startEditing(exIdx, wuIdx, true);
                              }}
                            >
                              {(() => {
                                const frozenWeight = wuLog?.prescribedWeight ?? wuSet.weight;
                                return (
                                  <>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[10px] text-muted-foreground w-5 text-right">
                                        W{wuIdx + 1}
                                      </span>
                                      <div>
                                        <span className="text-sm">
                                          {frozenWeight} {weightUnit}
                                        </span>
                                        <span className="text-sm text-muted-foreground ml-2">
                                          × {wuSet.targetReps}
                                        </span>
                                      </div>
                                    </div>
                                    {wuLog != null && (wuLog.actualReps != null || wuLog.actualWeight != null) && (
                                      <div className="text-right">
                                        <span className="text-xs text-emerald-400 font-medium">
                                          {wuLog.actualReps != null ? `Did ${wuLog.actualReps}` : ""}
                                          {wuLog.actualWeight != null ? ` @ ${wuLog.actualWeight} ${weightUnit}` : ""}
                                        </span>
                                        {wuLog.actualReps != null && wuLog.actualReps <= 12 && (() => {
                                          const w = wuLog.actualWeight ?? frozenWeight;
                                          if (w == null) return null;
                                          const est = estimate1RM(w, wuLog.actualReps);
                                          if (est == null) return null;
                                          return <span className="text-[10px] text-primary/70 ml-1">[{est.toFixed(1)}]</span>;
                                        })()}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            {wuLog != null && wuLog.notes.length > 0 && (
                              <p className="text-[10px] text-muted-foreground/70 ml-8 mt-0.5">{wuLog.notes}</p>
                            )}
                            {editing && (
                              <div className="ml-8 mt-2 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={editWeight}
                                    onChange={(e) => setEditWeight(e.target.value)}
                                    placeholder={(() => { const w = wuLog?.prescribedWeight ?? wuSet.weight; return w != null ? String(w) : "Weight"; })()}
                                    className="text-sm h-8"
                                  />
                                  <Input
                                    type="number"
                                    min="0"
                                    value={editReps}
                                    onChange={(e) => setEditReps(e.target.value)}
                                    placeholder="Reps"
                                    className="text-sm h-8"
                                  />
                                </div>
                                <Input
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  placeholder="Notes..."
                                  className="text-sm h-8"
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" className="h-7 text-xs" onClick={saveEdit}>
                                    <Check className="h-3 w-3 mr-1" />
                                    Save
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEditing}>
                                    <X className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Working sets */}
                      {exercise.sets.map((set, setIdx) => {
                        const setLog = getSetLog(exIdx, setIdx);
                        const editing = isEditing(exIdx, setIdx, false);
                        const canEdit = log != null && onUpdateLog != null;
                        return (
                          <div key={setIdx} className="py-2">
                            <div
                              className={`flex items-center justify-between ${canEdit ? "cursor-pointer hover:bg-secondary/50 -mx-2 px-2 rounded-lg" : ""}`}
                              onClick={() => {
                                if (canEdit) startEditing(exIdx, setIdx, false);
                              }}
                            >
                              {(() => {
                                const frozenWeight = setLog?.prescribedWeight ?? set.weight;
                                return (
                                  <>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-muted-foreground w-5 text-right">
                                        {setIdx + 1}
                                      </span>
                                      <div>
                                        {frozenWeight != null && (
                                          <span className="text-base font-bold">
                                            {frozenWeight} {weightUnit}
                                          </span>
                                        )}
                                        <span
                                          className={`text-sm ${frozenWeight != null ? "text-muted-foreground ml-2" : "text-foreground/80"}`}
                                        >
                                          × {set.targetReps}
                                        </span>
                                        {show1RM && (() => {
                                          const est = estimateFromPrescription(frozenWeight, set.targetReps);
                                          if (est == null) return null;
                                          return (
                                            <span className="text-[10px] text-primary/70 ml-2">
                                              ≈ 1RM {format1RM(est, weightUnit)}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                    </div>

                                    {setLog != null && (setLog.actualReps != null || setLog.actualWeight != null) && (
                                      <div className="text-right">
                                        <span className="text-sm text-emerald-400 font-medium">
                                          {setLog.actualReps != null ? `Did ${setLog.actualReps}` : ""}
                                          {setLog.actualWeight != null ? ` @ ${setLog.actualWeight} ${weightUnit}` : ""}
                                        </span>
                                        {setLog.actualReps != null && setLog.actualReps <= 12 && (() => {
                                          const w = setLog.actualWeight ?? frozenWeight;
                                          if (w == null) return null;
                                          const est = estimate1RM(w, setLog.actualReps);
                                          if (est == null) return null;
                                          return <span className="text-[10px] text-primary/70 ml-1">[{est.toFixed(1)}]</span>;
                                        })()}
                                        {setLog.difficulty != null && (
                                          <span
                                            className={`text-[10px] ml-1.5 ${DIFFICULTY_COLORS[setLog.difficulty]}`}
                                          >
                                            {DIFFICULTY_LABELS[setLog.difficulty]}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            {setLog != null && setLog.notes.length > 0 && (
                              <p className="text-[10px] text-muted-foreground/70 ml-8 mt-0.5">{setLog.notes}</p>
                            )}
                            {editing && (
                              <div className="ml-8 mt-2 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={editWeight}
                                    onChange={(e) => setEditWeight(e.target.value)}
                                    placeholder={(() => { const w = setLog?.prescribedWeight ?? set.weight; return w != null ? String(w) : "Weight"; })()}
                                    className="text-sm h-8"
                                  />
                                  <Input
                                    type="number"
                                    min="0"
                                    value={editReps}
                                    onChange={(e) => setEditReps(e.target.value)}
                                    placeholder="Reps"
                                    className="text-sm h-8"
                                  />
                                </div>
                                <Input
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  placeholder="Notes..."
                                  className="text-sm h-8"
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" className="h-7 text-xs" onClick={saveEdit}>
                                    <Check className="h-3 w-3 mr-1" />
                                    Save
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEditing}>
                                    <X className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Week 5 rep projections */}
                {week.weekNumber === 5 &&
                  exercise.isMainLift &&
                  bodyWeight != null &&
                  sex != null &&
                  (() => {
                    const testSet = exercise.sets.find(
                      (s) => s.targetReps === "1-4",
                    );
                    if (testSet == null) return null;
                    const weight = testSet.weight;
                    if (weight == null) return null;
                    const lift = liftFromExerciseName(exercise.name);
                    if (lift == null) return null;

                    const projections = [1, 2, 3, 4]
                      .map((reps) => {
                        const est = estimate1RM(weight, reps);
                        if (est == null) return null;
                        return {
                          reps,
                          est1RM: est,
                          classification: classifyStrength(
                            est,
                            bodyWeight,
                            sex,
                            lift,
                          ),
                        };
                      })
                      .filter(
                        (
                          p,
                        ): p is {
                          reps: number;
                          est1RM: number;
                          classification: ReturnType<typeof classifyStrength>;
                        } => p != null,
                      );

                    return (
                      <div className="mt-3 rounded-lg bg-secondary/30 border border-border/50 p-3 space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          If you hit...
                        </div>
                        {projections.map((p, i) => {
                          const levelUp =
                            i > 0 &&
                            p.classification.level !==
                              projections[i - 1].classification.level;
                          return (
                            <div
                              key={p.reps}
                              className={`flex items-center justify-between text-xs ${
                                levelUp
                                  ? "bg-emerald-950/30 border border-emerald-800/40 rounded-md px-2 py-1.5 -mx-1"
                                  : ""
                              }`}
                            >
                              <span>
                                <span className="font-medium">
                                  {p.reps}
                                </span>{" "}
                                rep{p.reps > 1 ? "s" : ""}{" "}
                                <span className="text-muted-foreground">
                                  → ~{p.est1RM.toFixed(1)} {weightUnit}
                                </span>
                              </span>
                              <span>
                                <span
                                  className={`font-bold ${LEVEL_COLORS[p.classification.level]}`}
                                >
                                  {p.classification.level}
                                </span>
                                {p.classification.progressToNext != null &&
                                  p.classification.nextLevel != null && (
                                    <span className="text-muted-foreground/70 ml-1">
                                      ({p.classification.progressToNext.toFixed(1)}%
                                      → {p.classification.nextLevel})
                                    </span>
                                  )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

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
