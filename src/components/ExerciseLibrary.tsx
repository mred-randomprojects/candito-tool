import { useState } from "react";
import type {
  ExerciseCategory,
  ExerciseDefinition,
  ExerciseMaxEntry,
  WeightUnit,
} from "../types";
import {
  exercisesForSelect,
  latestMaxForExercise,
  maxesForExercise,
} from "../exerciseCatalog";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Dumbbell, Plus } from "lucide-react";

interface ExerciseLibraryProps {
  exercises: Record<string, ExerciseDefinition>;
  exerciseMaxes: ExerciseMaxEntry[];
  preferredUnit: WeightUnit;
  onAddExercise: (name: string, category: ExerciseCategory) => void;
  onAddMax: (
    exerciseId: string,
    value: number,
    unit: WeightUnit,
    date: string,
    notes: string,
  ) => void;
}

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  upper: "Upper",
  lower: "Lower",
  accessory: "Accessory",
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ExerciseCard({
  exercise,
  maxes,
  preferredUnit,
  onAddMax,
}: {
  exercise: ExerciseDefinition;
  maxes: ExerciseMaxEntry[];
  preferredUnit: WeightUnit;
  onAddMax: ExerciseLibraryProps["onAddMax"];
}) {
  const latest = latestMaxForExercise(maxes, exercise.id);
  const history = maxesForExercise(maxes, exercise.id);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<WeightUnit>(latest?.unit ?? preferredUnit);
  const [date, setDate] = useState(todayString());
  const [notes, setNotes] = useState("");

  function submitMax() {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    onAddMax(exercise.id, parsed, unit, date, notes);
    setValue("");
    setNotes("");
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{exercise.name}</CardTitle>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {CATEGORY_LABELS[exercise.category]}
              </Badge>
              {latest != null && (
                <span className="text-xs text-muted-foreground">
                  Latest {latest.value} {latest.unit}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_7rem] gap-2">
          <Input
            type="number"
            min="0"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="1RM"
            className="h-10"
          />
          <Select value={unit} onValueChange={(next) => setUnit(next as WeightUnit)}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="lb">lb</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 text-xs"
          />
        </div>
        <div className="flex gap-2">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="h-9 text-sm"
          />
          <Button type="button" size="sm" onClick={submitMax}>
            Add
          </Button>
        </div>

        {history.length > 0 ? (
          <div className="divide-y divide-border/50">
            {history.slice(0, 6).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {entry.value} {entry.unit}
                  </div>
                  {entry.notes != null && entry.notes.length > 0 && (
                    <div className="truncate text-muted-foreground">
                      {entry.notes}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right text-muted-foreground">
                  <div>{formatDate(entry.date)}</div>
                  <div className="capitalize">{entry.source}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No maxes logged yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ExerciseLibrary({
  exercises,
  exerciseMaxes,
  preferredUnit,
  onAddExercise,
  onAddMax,
}: ExerciseLibraryProps) {
  const exerciseList = exercisesForSelect(exercises);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<ExerciseCategory>("lower");

  function submitExercise() {
    if (newName.trim().length === 0) return;
    onAddExercise(newName, newCategory);
    setNewName("");
  }

  return (
    <div className="min-h-dvh pb-24">
      <div className="sticky top-0 z-10 border-b bg-background/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Exercises</h1>
            <p className="text-xs text-muted-foreground">
              Exercise list and max history
            </p>
          </div>
          <Dumbbell className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-lg space-y-4 px-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Add Exercise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Hip Thrust"
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Select
                value={newCategory}
                onValueChange={(value) =>
                  setNewCategory(value as ExerciseCategory)
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lower">Lower</SelectItem>
                  <SelectItem value="upper">Upper</SelectItem>
                  <SelectItem value="accessory">Accessory</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" onClick={submitExercise} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {exerciseList.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              maxes={exerciseMaxes}
              preferredUnit={preferredUnit}
              onAddMax={onAddMax}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
