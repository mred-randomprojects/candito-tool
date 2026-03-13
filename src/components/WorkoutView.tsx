import { useState } from "react";
import type {
  ProgramWeek,
  WorkoutDay,
  WorkoutLog,
  SetLog,
  WeightUnit,
} from "../types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { ArrowLeft, Eye, EyeOff, Check, X } from "lucide-react";
import { estimate1RM, estimateFromPrescription, format1RM } from "../oneRepMax";
import { getWarmUpSetsForExercise } from "../warmUp";

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
  log: WorkoutLog | undefined;
  onStartWorkout: () => void;
  onBack: () => void;
  onMarkComplete: (log: WorkoutLog) => void;
  onUpdateLog?: (log: WorkoutLog) => void;
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
  log,
  onStartWorkout,
  onBack,
  onMarkComplete,
  onUpdateLog,
}: WorkoutViewProps) {
  const done = log?.completed === true;
  const [show1RM, setShow1RM] = useState(false);
  const [editingSet, setEditingSet] = useState<EditingSet | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editNotes, setEditNotes] = useState("");

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
