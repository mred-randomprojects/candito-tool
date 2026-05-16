import { useMemo, useState } from "react";
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
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import { CalendarPlus, Plus, Trash2, X } from "lucide-react";

interface FreeTrainingPageProps {
  exercises: Record<string, ExerciseDefinition>;
  freeTrainingDays: FreeTrainingDay[];
  preferredUnit: WeightUnit;
  onSaveTrainingDay: (day: FreeTrainingDay) => void;
  onDeleteTrainingDay: (dayId: string) => void;
}

interface DraftSet {
  id: string;
  weight: string;
  reps: string;
  difficulty: Difficulty | null;
  notes: string;
}

interface DraftExercise {
  id: string;
  exerciseId: string;
  sets: DraftSet[];
  notes: string;
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

function localDateString(date = new Date()): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function makeDraftSet(): DraftSet {
  return {
    id: crypto.randomUUID(),
    weight: "",
    reps: "",
    difficulty: null,
    notes: "",
  };
}

function makeDraftExercise(exerciseId: string): DraftExercise {
  return {
    id: crypto.randomUUID(),
    exerciseId,
    sets: [makeDraftSet()],
    notes: "",
  };
}

function parseNullableFloat(value: string): number | null {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseNullableInt(value: string): number | null {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function draftSetHasData(set: DraftSet): boolean {
  return (
    set.weight.trim().length > 0 ||
    set.reps.trim().length > 0 ||
    set.difficulty != null ||
    set.notes.trim().length > 0
  );
}

function setLogHasData(set: SetLog): boolean {
  return (
    set.actualWeight != null ||
    set.actualReps != null ||
    set.difficulty != null ||
    set.notes.trim().length > 0
  );
}

function setSummary(set: SetLog, unit: WeightUnit): string {
  if (set.actualWeight != null && set.actualReps != null) {
    return `${set.actualWeight} ${unit} x ${set.actualReps}`;
  }
  if (set.actualWeight != null) return `${set.actualWeight} ${unit}`;
  if (set.actualReps != null) return `${set.actualReps} reps`;
  return "Logged";
}

function estimatedMax(set: SetLog, unit: WeightUnit): string | null {
  if (set.actualWeight == null || set.actualReps == null || set.actualReps > 12) {
    return null;
  }
  const estimate = estimate1RM(set.actualWeight, set.actualReps);
  return estimate != null ? `${estimate.toFixed(1)} ${unit}` : null;
}

function countSets(day: FreeTrainingDay): number {
  return day.exerciseLogs.reduce((total, exercise) => total + exercise.setLogs.length, 0);
}

function compareFreeTrainingDaysDesc(a: FreeTrainingDay, b: FreeTrainingDay): number {
  const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
  if (dateDiff !== 0) return dateDiff;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function FreeTrainingPage({
  exercises,
  freeTrainingDays,
  preferredUnit,
  onSaveTrainingDay,
  onDeleteTrainingDay,
}: FreeTrainingPageProps) {
  const exerciseOptions = useMemo(() => exercisesForSelect(exercises), [exercises]);
  const defaultExerciseId = exerciseOptions[0]?.id ?? "";
  const [date, setDate] = useState(localDateString());
  const [notes, setNotes] = useState("");
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>(() => [
    makeDraftExercise(defaultExerciseId),
  ]);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const sortedDays = useMemo(
    () => [...freeTrainingDays].sort(compareFreeTrainingDaysDesc),
    [freeTrainingDays],
  );

  const canSave = draftExercises.some(
    (exercise) =>
      exercise.exerciseId.length > 0 && exercise.sets.some(draftSetHasData),
  );

  function updateDraftExercise(
    draftExerciseId: string,
    updates: Partial<DraftExercise>,
  ) {
    setDraftExercises((prev) =>
      prev.map((exercise) =>
        exercise.id === draftExerciseId ? { ...exercise, ...updates } : exercise,
      ),
    );
  }

  function updateDraftSet(
    draftExerciseId: string,
    draftSetId: string,
    updates: Partial<DraftSet>,
  ) {
    setDraftExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.id !== draftExerciseId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === draftSetId ? { ...set, ...updates } : set,
          ),
        };
      }),
    );
  }

  function addExerciseBlock() {
    setDraftExercises((prev) => [...prev, makeDraftExercise(defaultExerciseId)]);
  }

  function removeExerciseBlock(draftExerciseId: string) {
    setDraftExercises((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((exercise) => exercise.id !== draftExerciseId);
    });
  }

  function addSet(draftExerciseId: string) {
    setDraftExercises((prev) =>
      prev.map((exercise) =>
        exercise.id === draftExerciseId
          ? { ...exercise, sets: [...exercise.sets, makeDraftSet()] }
          : exercise,
      ),
    );
  }

  function removeSet(draftExerciseId: string, draftSetId: string) {
    setDraftExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.id !== draftExerciseId || exercise.sets.length === 1) {
          return exercise;
        }
        return {
          ...exercise,
          sets: exercise.sets.filter((set) => set.id !== draftSetId),
        };
      }),
    );
  }

  function buildExerciseLogs(): FreeTrainingExerciseLog[] {
    return draftExercises
      .map((exercise) => ({
        exerciseId: exercise.exerciseId,
        setLogs: exercise.sets
          .filter(draftSetHasData)
          .map((set) => ({
            actualWeight: parseNullableFloat(set.weight),
            actualReps: parseNullableInt(set.reps),
            difficulty: set.difficulty,
            prescribedWeight: null,
            notes: set.notes.trim(),
          }))
          .filter(setLogHasData),
        notes: exercise.notes.trim(),
      }))
      .filter(
        (exercise) =>
          exercise.exerciseId.length > 0 &&
          (exercise.setLogs.length > 0 || exercise.notes.length > 0),
      );
  }

  function saveTrainingDay() {
    const exerciseLogs = buildExerciseLogs();
    if (exerciseLogs.length === 0) return;
    const now = new Date().toISOString();
    onSaveTrainingDay({
      id: crypto.randomUUID(),
      date,
      exerciseLogs,
      notes: notes.trim(),
      createdAt: now,
      updatedAt: now,
    });
    setDate(localDateString());
    setNotes("");
    setDraftExercises([makeDraftExercise(defaultExerciseId)]);
  }

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
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Free Training</h1>
            <p className="text-xs text-muted-foreground">Outside the cycle</p>
          </div>
          <CalendarPlus className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-lg space-y-4 px-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">New Training Day</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {preferredUnit}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addExerciseBlock}
                  className="h-10 gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Exercise
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {draftExercises.map((draftExercise, exerciseIndex) => (
                <div
                  key={draftExercise.id}
                  className="rounded-lg border border-border/70 bg-secondary/20 p-3"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Select
                        value={draftExercise.exerciseId}
                        onValueChange={(exerciseId) =>
                          updateDraftExercise(draftExercise.id, { exerciseId })
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
                      disabled={draftExercises.length === 1}
                      onClick={() => removeExerciseBlock(draftExercise.id)}
                      title="Remove exercise"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {draftExercise.sets.map((set, setIndex) => (
                      <div key={set.id} className="space-y-2 rounded-md bg-background/60 p-2">
                        <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2">
                          <div className="flex items-center justify-center text-xs text-muted-foreground">
                            {setIndex + 1}
                          </div>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={set.weight}
                            onChange={(e) =>
                              updateDraftSet(draftExercise.id, set.id, {
                                weight: e.target.value,
                              })
                            }
                            placeholder={`Weight (${preferredUnit})`}
                            className="h-9 text-sm"
                          />
                          <Input
                            type="number"
                            min="0"
                            value={set.reps}
                            onChange={(e) =>
                              updateDraftSet(draftExercise.id, set.id, {
                                reps: e.target.value,
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
                            disabled={draftExercise.sets.length === 1}
                            onClick={() => removeSet(draftExercise.id, set.id)}
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
                                updateDraftSet(draftExercise.id, set.id, {
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
                          onChange={(e) =>
                            updateDraftSet(draftExercise.id, set.id, {
                              notes: e.target.value,
                            })
                          }
                          placeholder="Set notes"
                          className="h-8 text-xs"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Input
                      value={draftExercise.notes}
                      onChange={(e) =>
                        updateDraftExercise(draftExercise.id, {
                          notes: e.target.value,
                        })
                      }
                      placeholder={`Notes for exercise ${exerciseIndex + 1}`}
                      className="h-9 text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addSet(draftExercise.id)}
                      className="h-9 gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Set
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Day Notes</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="How did it go?"
              />
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={!canSave}
              onClick={saveTrainingDay}
            >
              Save Training Day
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {sortedDays.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No free training logged yet.
            </div>
          ) : (
            sortedDays.map((day) => (
              <Card key={day.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{formatDate(day.date)}</CardTitle>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {day.exerciseLogs.length} exercise
                        {day.exerciseLogs.length === 1 ? "" : "s"} / {countSets(day)} set
                        {countSets(day) === 1 ? "" : "s"}
                      </div>
                    </div>
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
                </CardHeader>
                <CardContent className="space-y-3">
                  {day.exerciseLogs.map((exerciseLog, exerciseIndex) => {
                    const exerciseName =
                      exercises[exerciseLog.exerciseId]?.name ?? "Unknown exercise";
                    return (
                      <div key={`${day.id}-${exerciseIndex}`} className="space-y-2">
                        <div className="text-sm font-semibold">{exerciseName}</div>
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
                        {exerciseLog.notes.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {exerciseLog.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {day.notes.length > 0 && (
                    <div className="border-t border-border/50 pt-2 text-xs text-muted-foreground">
                      {day.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
