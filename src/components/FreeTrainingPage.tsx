import { useMemo, useState } from "react";
import { parse } from "date-fns";
import type {
  Difficulty,
  ExerciseDefinition,
  FreeTrainingDay,
  FreeTrainingExerciseLog,
  SetLog,
  WeightUnit,
} from "../types";
import { exercisesForSelect } from "../exerciseCatalog";
import { estimate1RM } from "../oneRepMax";
import { formatTrainingDate, localDateString } from "../trainingDate";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";

interface FreeTrainingPageProps {
  exercises: Record<string, ExerciseDefinition>;
  freeTrainingDays: FreeTrainingDay[];
  preferredUnit: WeightUnit;
  onStartTrainingDay: () => void;
  onOpenTrainingDay: (dayId: string) => void;
  onDeleteTrainingDay: (dayId: string) => void;
}

interface FreeTrainingDayPageProps {
  day: FreeTrainingDay;
  exercises: Record<string, ExerciseDefinition>;
  preferredUnit: WeightUnit;
  onUpdateTrainingDay: (day: FreeTrainingDay) => void;
  onDeleteTrainingDay: (dayId: string) => void;
  onBack: () => void;
}

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; activeClass: string }[] = [
  { value: 1, label: "Easy", activeClass: "bg-emerald-700 text-emerald-100 border-emerald-600" },
  { value: 2, label: "Med", activeClass: "bg-green-700 text-green-100 border-green-600" },
  { value: 3, label: "Hard", activeClass: "bg-yellow-700 text-yellow-100 border-yellow-600" },
  { value: 4, label: "V.Hard", activeClass: "bg-orange-700 text-orange-100 border-orange-600" },
  { value: 5, label: "Max", activeClass: "bg-red-700 text-red-100 border-red-600" },
];

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "Easy",
  2: "Moderate",
  3: "Hard",
  4: "Very Hard",
  5: "Maximum",
};

function emptySetLog(): SetLog {
  return {
    actualWeight: null,
    actualReps: null,
    difficulty: null,
    prescribedWeight: null,
    notes: "",
  };
}

function emptyExerciseLog(exerciseId: string): FreeTrainingExerciseLog {
  return {
    exerciseId,
    setLogs: [emptySetLog()],
    notes: "",
  };
}

function parseNullableFloat(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseNullableInt(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function setSummary(set: SetLog, unit: WeightUnit): string {
  if (set.actualWeight != null && set.actualReps != null) {
    return `${set.actualWeight} ${unit} x ${set.actualReps}`;
  }
  if (set.actualWeight != null) return `${set.actualWeight} ${unit}`;
  if (set.actualReps != null) return `${set.actualReps} reps`;
  return "Empty set";
}

function estimatedMax(set: SetLog, unit: WeightUnit): string | null {
  if (set.actualWeight == null || set.actualReps == null || set.actualReps > 12) {
    return null;
  }
  const estimate = estimate1RM(set.actualWeight, set.actualReps);
  return estimate != null ? `${estimate.toFixed(1)} ${unit}` : null;
}

function countSets(day: FreeTrainingDay): number {
  return day.exerciseLogs.reduce(
    (total, exercise) => total + exercise.setLogs.length,
    0,
  );
}

function compareFreeTrainingDaysDesc(a: FreeTrainingDay, b: FreeTrainingDay): number {
  const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
  if (dateDiff !== 0) return dateDiff;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function exerciseName(
  exercises: Record<string, ExerciseDefinition>,
  exerciseId: string,
): string {
  return exercises[exerciseId]?.name ?? "Unknown exercise";
}

function TrainingDaySummary({
  day,
  exercises,
  preferredUnit,
}: {
  day: FreeTrainingDay;
  exercises: Record<string, ExerciseDefinition>;
  preferredUnit: WeightUnit;
}) {
  if (day.exerciseLogs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No exercises logged yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {day.exerciseLogs.map((exerciseLog, exerciseIndex) => (
        <div key={`${day.id}-${exerciseIndex}`} className="space-y-2">
          <div className="text-sm font-semibold">
            {exerciseName(exercises, exerciseLog.exerciseId)}
          </div>
          {exerciseLog.setLogs.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {exerciseLog.setLogs.map((set, setIndex) => {
                const estimate = estimatedMax(set, preferredUnit);
                return (
                  <div
                    key={setIndex}
                    className="rounded-md border border-border/70 bg-secondary/40 px-2 py-1"
                  >
                    <div className="text-xs font-medium">
                      {setSummary(set, preferredUnit)}
                    </div>
                    {(set.difficulty != null || estimate != null) && (
                      <div className="text-[10px] text-muted-foreground">
                        {set.difficulty != null
                          ? DIFFICULTY_LABELS[set.difficulty]
                          : ""}
                        {set.difficulty != null && estimate != null ? " / " : ""}
                        {estimate != null ? `1RM ${estimate}` : ""}
                      </div>
                    )}
                    {set.notes.length > 0 && (
                      <div className="mt-0.5 max-w-[12rem] truncate text-[10px] text-muted-foreground">
                        {set.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No sets yet.</p>
          )}
          {exerciseLog.notes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {exerciseLog.notes}
            </p>
          )}
        </div>
      ))}
      {day.notes.length > 0 && (
        <div className="border-t border-border/50 pt-2 text-xs text-muted-foreground">
          {day.notes}
        </div>
      )}
    </div>
  );
}

export function FreeTrainingPage({
  exercises,
  freeTrainingDays,
  preferredUnit,
  onStartTrainingDay,
  onOpenTrainingDay,
  onDeleteTrainingDay,
}: FreeTrainingPageProps) {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const sortedDays = useMemo(
    () => [...freeTrainingDays].sort(compareFreeTrainingDaysDesc),
    [freeTrainingDays],
  );

  function deleteTrainingDay(dayId: string) {
    if (confirmingDeleteId !== dayId) {
      setConfirmingDeleteId(dayId);
      return;
    }
    onDeleteTrainingDay(dayId);
    setConfirmingDeleteId(null);
  }

  return (
    <div className="min-h-dvh pb-24">
      <div className="sticky top-0 z-10 border-b bg-background/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Free Training</h1>
            <p className="text-xs text-muted-foreground">Outside the cycle</p>
          </div>
          <Button type="button" onClick={onStartTrainingDay} className="gap-1.5">
            <CalendarPlus className="h-4 w-4" />
            Start
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-lg space-y-3 px-4">
        {sortedDays.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-center">
              <CalendarPlus className="mx-auto h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">No free training logged yet.</p>
                <p className="text-xs text-muted-foreground">
                  Start a day first, then log work as you go.
                </p>
              </div>
              <Button type="button" onClick={onStartTrainingDay}>
                Start Training Day
              </Button>
            </CardContent>
          </Card>
        ) : (
          sortedDays.map((day) => (
            <Card key={day.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {formatTrainingDate(day.date)}
                    </CardTitle>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {day.exerciseLogs.length} exercise
                      {day.exerciseLogs.length === 1 ? "" : "s"} / {countSets(day)} set
                      {countSets(day) === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => onOpenTrainingDay(day.id)}
                    >
                      Open
                    </Button>
                    <Button
                      type="button"
                      variant={confirmingDeleteId === day.id ? "destructive" : "ghost"}
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => deleteTrainingDay(day.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {confirmingDeleteId === day.id ? "Confirm" : "Delete"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <TrainingDaySummary
                  day={day}
                  exercises={exercises}
                  preferredUnit={preferredUnit}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export function FreeTrainingDayPage({
  day,
  exercises,
  preferredUnit,
  onUpdateTrainingDay,
  onDeleteTrainingDay,
  onBack,
}: FreeTrainingDayPageProps) {
  const exerciseOptions = useMemo(() => exercisesForSelect(exercises), [exercises]);
  const defaultExerciseId = exerciseOptions[0]?.id ?? "";
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function updateDay(updates: Partial<FreeTrainingDay>) {
    onUpdateTrainingDay({ ...day, ...updates });
  }

  function updateExercise(
    exerciseIndex: number,
    updates: Partial<FreeTrainingExerciseLog>,
  ) {
    updateDay({
      exerciseLogs: day.exerciseLogs.map((exercise, index) =>
        index === exerciseIndex ? { ...exercise, ...updates } : exercise,
      ),
    });
  }

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    updates: Partial<SetLog>,
  ) {
    updateDay({
      exerciseLogs: day.exerciseLogs.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        return {
          ...exercise,
          setLogs: exercise.setLogs.map((set, currentSetIndex) =>
            currentSetIndex === setIndex ? { ...set, ...updates } : set,
          ),
        };
      }),
    });
  }

  function addExercise() {
    if (defaultExerciseId.length === 0) return;
    updateDay({
      exerciseLogs: [...day.exerciseLogs, emptyExerciseLog(defaultExerciseId)],
    });
  }

  function removeExercise(exerciseIndex: number) {
    updateDay({
      exerciseLogs: day.exerciseLogs.filter((_, index) => index !== exerciseIndex),
    });
  }

  function addSet(exerciseIndex: number) {
    updateDay({
      exerciseLogs: day.exerciseLogs.map((exercise, index) =>
        index === exerciseIndex
          ? { ...exercise, setLogs: [...exercise.setLogs, emptySetLog()] }
          : exercise,
      ),
    });
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    updateDay({
      exerciseLogs: day.exerciseLogs.map((exercise, index) =>
        index === exerciseIndex
          ? {
              ...exercise,
              setLogs: exercise.setLogs.filter(
                (_, currentSetIndex) => currentSetIndex !== setIndex,
              ),
            }
          : exercise,
      ),
    });
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDeleteTrainingDay(day.id);
    onBack();
  }

  return (
    <div className="min-h-dvh pb-24">
      <div className="sticky top-0 z-10 border-b bg-background/90 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 h-7 text-muted-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold">Free Training</h1>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <CalendarDays className="h-3 w-3" />
                    {formatTrainingDate(day.date)}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <Calendar
                    mode="single"
                    selected={parse(day.date, "yyyy-MM-dd", new Date())}
                    onSelect={(selected) => {
                      if (selected == null) return;
                      updateDay({ date: localDateString(selected) });
                      setDatePopoverOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {preferredUnit}
              </Badge>
              <Button
                type="button"
                variant={confirmingDelete ? "destructive" : "ghost"}
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmingDelete ? "Confirm" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-lg space-y-4 px-4">
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-3">
            <div className="text-xs text-muted-foreground">
              {day.exerciseLogs.length} exercise
              {day.exerciseLogs.length === 1 ? "" : "s"} / {countSets(day)} set
              {countSets(day) === 1 ? "" : "s"}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addExercise}
              className="h-9 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Exercise
            </Button>
          </CardContent>
        </Card>

        {day.exerciseLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Add your first exercise when you start working.
          </div>
        ) : (
          <div className="space-y-3">
            {day.exerciseLogs.map((exerciseLog, exerciseIndex) => (
              <Card key={`${day.id}-${exerciseIndex}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Select
                        value={exerciseLog.exerciseId}
                        onValueChange={(exerciseId) =>
                          updateExercise(exerciseIndex, { exerciseId })
                        }
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select exercise" />
                        </SelectTrigger>
                        <SelectContent>
                          {exerciseOptions.map((exercise) => (
                            <SelectItem key={exercise.id} value={exercise.id}>
                              {exercise.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground"
                      onClick={() => removeExercise(exerciseIndex)}
                      title="Remove exercise"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {exerciseLog.setLogs.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                      No sets on this exercise yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {exerciseLog.setLogs.map((set, setIndex) => (
                        <div
                          key={setIndex}
                          className="space-y-2 rounded-md bg-secondary/30 p-2"
                        >
                          <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2">
                            <div className="flex items-center justify-center text-xs text-muted-foreground">
                              {setIndex + 1}
                            </div>
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={set.actualWeight ?? ""}
                              onChange={(event) =>
                                updateSet(exerciseIndex, setIndex, {
                                  actualWeight: parseNullableFloat(event.target.value),
                                })
                              }
                              placeholder={`Weight (${preferredUnit})`}
                              className="h-9 text-sm"
                            />
                            <Input
                              type="number"
                              min="0"
                              value={set.actualReps ?? ""}
                              onChange={(event) =>
                                updateSet(exerciseIndex, setIndex, {
                                  actualReps: parseNullableInt(event.target.value),
                                })
                              }
                              placeholder="Reps"
                              className="h-9 text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-8 text-muted-foreground"
                              onClick={() => removeSet(exerciseIndex, setIndex)}
                              title="Remove set"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="flex gap-1">
                            {DIFFICULTY_OPTIONS.map(({ value, label, activeClass }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() =>
                                  updateSet(exerciseIndex, setIndex, {
                                    difficulty:
                                      set.difficulty === value ? null : value,
                                  })
                                }
                                className={`flex-1 rounded-md border py-1 text-[10px] font-medium transition-all ${
                                  set.difficulty === value
                                    ? activeClass
                                    : "border-border bg-secondary text-muted-foreground"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>

                          <Input
                            value={set.notes}
                            onChange={(event) =>
                              updateSet(exerciseIndex, setIndex, {
                                notes: event.target.value,
                              })
                            }
                            placeholder="Set notes"
                            className="h-8 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      value={exerciseLog.notes}
                      onChange={(event) =>
                        updateExercise(exerciseIndex, {
                          notes: event.target.value,
                        })
                      }
                      placeholder="Exercise notes"
                      className="h-9 text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSet(exerciseIndex)}
                      className="h-9 gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Set
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="space-y-2 p-3">
            <Label>Day Notes</Label>
            <textarea
              value={day.notes}
              onChange={(event) => updateDay({ notes: event.target.value })}
              rows={3}
              className="flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="How did it go?"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
