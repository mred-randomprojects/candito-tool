import { useState } from "react";
import { format, parse } from "date-fns";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import type {
  ProgramInputs,
  UserProfile,
  WeightUnit,
  Sex,
  HorizontalPull,
  ShoulderExercise,
  VerticalPull,
} from "../types";
import {
  HORIZONTAL_PULL_OPTIONS,
  SHOULDER_OPTIONS,
  VERTICAL_PULL_OPTIONS,
} from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { cn } from "@/lib/utils";

interface SetupFormProps {
  defaultCycleName: string;
  initialProfile: UserProfile;
  initialInputs?: ProgramInputs;
  submitLabel?: string;
  onSubmit: (inputs: ProgramInputs, cycleName: string, profile: UserProfile) => void;
  onCancel?: () => void;
}

export function SetupForm({ defaultCycleName, initialProfile, initialInputs, submitLabel, onSubmit, onCancel }: SetupFormProps) {
  const [cycleName, setCycleName] = useState(defaultCycleName);
  const [startDate, setStartDate] = useState<Date>(
    initialInputs != null
      ? parse(initialInputs.startDate, "yyyy-MM-dd", new Date())
      : new Date(),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(initialInputs?.weightUnit ?? "kg");
  const [bench1RM, setBench1RM] = useState(initialInputs != null ? String(initialInputs.bench1RM) : "");
  const [squat1RM, setSquat1RM] = useState(initialInputs != null ? String(initialInputs.squat1RM) : "");
  const [deadlift1RM, setDeadlift1RM] = useState(initialInputs != null ? String(initialInputs.deadlift1RM) : "");
  const [horizontalPull, setHorizontalPull] = useState<HorizontalPull>(initialInputs?.horizontalPull ?? "Dumbbell Row");
  const [shoulderExercise, setShoulderExercise] = useState<ShoulderExercise>(initialInputs?.shoulderExercise ?? "Military Press");
  const [verticalPull, setVerticalPull] = useState<VerticalPull>(initialInputs?.verticalPull ?? "Weighted Pull-up");
  const [sex, setSex] = useState<Sex | null>(initialProfile.sex ?? null);
  const [bodyWeight, setBodyWeight] = useState(
    initialProfile.bodyWeight != null ? String(initialProfile.bodyWeight) : "",
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const b = parseFloat(bench1RM);
    const s = parseFloat(squat1RM);
    const d = parseFloat(deadlift1RM);
    if (isNaN(b) || isNaN(s) || isNaN(d) || b <= 0 || s <= 0 || d <= 0) return;

    const name = cycleName.trim().length > 0 ? cycleName.trim() : defaultCycleName;
    const bw = parseFloat(bodyWeight);
    onSubmit(
      {
        startDate: format(startDate, "yyyy-MM-dd"),
        weightUnit,
        bench1RM: b,
        squat1RM: s,
        deadlift1RM: d,
        horizontalPull,
        shoulderExercise,
        verticalPull,
      },
      name,
      {
        ...(sex != null ? { sex } : {}),
        ...(!isNaN(bw) && bw > 0 ? { bodyWeight: bw } : {}),
      },
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            {onCancel != null && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCancel}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className={onCancel != null ? "" : "text-center w-full"}>
              <CardTitle className="text-2xl font-bold">Candito 6-Week</CardTitle>
              <CardDescription>Strength Program Tracker</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Cycle Name */}
            <div className="space-y-2">
              <Label>Cycle Name</Label>
              <Input
                value={cycleName}
                onChange={(e) => setCycleName(e.target.value)}
                placeholder={defaultCycleName}
                className="h-11 text-base"
              />
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11",
                      !startDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "MMMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(day) => {
                      if (day != null) {
                        setStartDate(day);
                        setCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Weight Unit */}
            <div className="space-y-2">
              <Label>Weight Unit</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["kg", "lb"] as const).map((unit) => (
                  <Button
                    key={unit}
                    type="button"
                    variant={weightUnit === unit ? "default" : "outline"}
                    className="h-11 text-base font-semibold"
                    onClick={() => setWeightUnit(unit)}
                  >
                    {unit}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sex (optional) */}
            <div className="space-y-2">
              <Label>
                Sex{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (optional)
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(["male", "female"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={sex === s ? "default" : "outline"}
                    className="h-11 text-base font-semibold"
                    onClick={() => setSex(sex === s ? null : s)}
                  >
                    {s === "male" ? "Male" : "Female"}
                  </Button>
                ))}
              </div>
            </div>

            {/* Body Weight (optional) */}
            <div className="space-y-2">
              <Label>
                Body Weight ({weightUnit}){" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                placeholder="0"
                className="h-11 text-base"
              />
            </div>

            {/* 1RM Inputs */}
            <div className="space-y-3">
              <Label>One Rep Maxes ({weightUnit})</Label>
              {[
                { label: "Bench Press", value: bench1RM, set: setBench1RM },
                { label: "Squat", value: squat1RM, set: setSquat1RM },
                { label: "Deadlift", value: deadlift1RM, set: setDeadlift1RM },
              ].map(({ label, value, set }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-28">{label}</span>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder="0"
                    className="h-11 text-base"
                    required
                  />
                </div>
              ))}
            </div>

            {/* Accessory Selection */}
            <div className="space-y-3">
              <Label>Accessory Exercises</Label>

              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">
                  Upper Back #1 (horizontal pull)
                </span>
                <Select
                  value={horizontalPull}
                  onValueChange={(v) => setHorizontalPull(v as HorizontalPull)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HORIZONTAL_PULL_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">
                  Shoulder Exercise
                </span>
                <Select
                  value={shoulderExercise}
                  onValueChange={(v) => setShoulderExercise(v as ShoulderExercise)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOULDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">
                  Upper Back #2 (vertical pull)
                </span>
                <Select
                  value={verticalPull}
                  onValueChange={(v) => setVerticalPull(v as VerticalPull)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VERTICAL_PULL_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Submit */}
            <Button type="submit" size="lg" className="w-full mt-2">
              {submitLabel ?? "Start Program"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
