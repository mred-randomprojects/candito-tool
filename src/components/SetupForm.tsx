import { useState } from "react";
import { format, parse } from "date-fns";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import type {
  ProgramInputs,
  ProgramType,
  LinearVariant,
  UserProfile,
  WeightUnit,
  Sex,
  HorizontalPull,
  ShoulderExercise,
  VerticalPull,
  ExerciseDefinition,
  ExerciseMaxEntry,
  MainLift,
} from "../types";
import {
  DEFAULT_LINEAR_WEEK_COUNT,
  HORIZONTAL_PULL_OPTIONS,
  LINEAR_VARIANT_LABELS,
  SHOULDER_OPTIONS,
  VERTICAL_PULL_OPTIONS,
  linearVariantFromInputs,
  programTypeFromInputs,
} from "../types";
import { linearWeekCountFromInputs } from "../linearProgram";
import { parseFlexibleFloat } from "../numberInput";
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
import {
  exercisesForSelect,
  mainLiftExerciseIdsFromInputs,
  maxValueForExercise,
  normalizeProgramInputsFromExercises,
} from "../exerciseCatalog";

interface SetupFormProps {
  defaultCycleName: string;
  initialProfile: UserProfile;
  initialInputs?: ProgramInputs;
  exercises: Record<string, ExerciseDefinition>;
  exerciseMaxes: ExerciseMaxEntry[];
  submitLabel?: string;
  onSubmit: (inputs: ProgramInputs, cycleName: string, profile: UserProfile) => void;
  onCancel?: () => void;
}

const LINEAR_VARIANT_DESCRIPTIONS: Record<LinearVariant, string> = {
  control: "Paused variations on the lighter days. Candito's pick for most lifters.",
  power: "Explosive/speed work on the lower variation day; upper day stays Control.",
  hypertrophy: "Highest volume — variation days become higher-rep bodybuilding work.",
  "three-day": "Same program Mon/Wed/Fri: both heavy days, alternating variation day.",
};

function mondayOfWeek(date: Date): Date {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function SetupForm({
  defaultCycleName,
  initialProfile,
  initialInputs,
  exercises,
  exerciseMaxes,
  submitLabel,
  onSubmit,
  onCancel,
}: SetupFormProps) {
  const exerciseOptions = exercisesForSelect(exercises);
  const initialExerciseIds = mainLiftExerciseIdsFromInputs(initialInputs);
  const isEditing = initialInputs != null;
  const [cycleName, setCycleName] = useState(defaultCycleName);
  const [programType, setProgramType] = useState<ProgramType>(
    programTypeFromInputs(initialInputs),
  );
  const [linearVariant, setLinearVariant] = useState<LinearVariant>(
    linearVariantFromInputs(initialInputs),
  );
  const [linearWeeks, setLinearWeeks] = useState(
    initialInputs != null && programTypeFromInputs(initialInputs) === "linear"
      ? String(linearWeekCountFromInputs(initialInputs))
      : String(DEFAULT_LINEAR_WEEK_COUNT),
  );
  const [startDate, setStartDate] = useState<Date>(
    initialInputs != null
      ? parse(initialInputs.startDate, "yyyy-MM-dd", new Date())
      : new Date(),
  );
  const [dateTouched, setDateTouched] = useState(isEditing);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(initialInputs?.weightUnit ?? "kg");
  const [benchExerciseId, setBenchExerciseId] = useState(initialExerciseIds.bench);
  const [squatExerciseId, setSquatExerciseId] = useState(initialExerciseIds.squat);
  const [deadliftExerciseId, setDeadliftExerciseId] = useState(initialExerciseIds.deadlift);
  const [bench1RM, setBench1RM] = useState(
    initialInputs != null
      ? String(initialInputs.bench1RM)
      : maxValueForExercise(exerciseMaxes, initialExerciseIds.bench, weightUnit),
  );
  const [squat1RM, setSquat1RM] = useState(
    initialInputs != null
      ? String(initialInputs.squat1RM)
      : maxValueForExercise(exerciseMaxes, initialExerciseIds.squat, weightUnit),
  );
  const [deadlift1RM, setDeadlift1RM] = useState(
    initialInputs != null
      ? String(initialInputs.deadlift1RM)
      : maxValueForExercise(exerciseMaxes, initialExerciseIds.deadlift, weightUnit),
  );
  const [horizontalPull, setHorizontalPull] = useState<HorizontalPull>(initialInputs?.horizontalPull ?? "Dumbbell Row");
  const [shoulderExercise, setShoulderExercise] = useState<ShoulderExercise>(initialInputs?.shoulderExercise ?? "Military Press");
  const [verticalPull, setVerticalPull] = useState<VerticalPull>(initialInputs?.verticalPull ?? "Weighted Pull-up");
  const [horizontalPull1RM, setHorizontalPull1RM] = useState(
    initialInputs?.horizontalPull1RM != null ? String(initialInputs.horizontalPull1RM) : "",
  );
  const [shoulderExercise1RM, setShoulderExercise1RM] = useState(
    initialInputs?.shoulderExercise1RM != null ? String(initialInputs.shoulderExercise1RM) : "",
  );
  const [verticalPull1RM, setVerticalPull1RM] = useState(
    initialInputs?.verticalPull1RM != null ? String(initialInputs.verticalPull1RM) : "",
  );
  const [sex, setSex] = useState<Sex | null>(initialProfile.sex ?? null);
  const [bodyWeight, setBodyWeight] = useState(
    initialProfile.bodyWeight != null ? String(initialProfile.bodyWeight) : "",
  );

  const isLinear = programType === "linear";

  function selectProgramType(nextType: ProgramType) {
    if (isEditing) return;
    setProgramType(nextType);
    // The linear schedule is written from a Monday (Mon/Tue/Thu/Fri), so
    // default new linear cycles to this week's Monday until the user picks
    // a date themselves.
    if (!dateTouched) {
      setStartDate(nextType === "linear" ? mondayOfWeek(new Date()) : new Date());
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const b = parseFlexibleFloat(bench1RM);
    const s = parseFlexibleFloat(squat1RM);
    const d = parseFlexibleFloat(deadlift1RM);
    if (isNaN(b) || isNaN(s) || isNaN(d) || b <= 0 || s <= 0 || d <= 0) return;
    const weeks = parseInt(linearWeeks, 10);
    if (isLinear && (isNaN(weeks) || weeks < 1)) return;

    const name = cycleName.trim().length > 0 ? cycleName.trim() : defaultCycleName;
    const bw = parseFlexibleFloat(bodyWeight);
    const hp1RM = parseFlexibleFloat(horizontalPull1RM);
    const sh1RM = parseFlexibleFloat(shoulderExercise1RM);
    const vp1RM = parseFlexibleFloat(verticalPull1RM);
    const selectedIds = {
      bench: benchExerciseId,
      squat: squatExerciseId,
      deadlift: deadliftExerciseId,
    };
    if (
      exercises[selectedIds.bench] == null ||
      exercises[selectedIds.squat] == null ||
      exercises[selectedIds.deadlift] == null
    ) {
      return;
    }
    const inputs = normalizeProgramInputsFromExercises(
      {
        programType,
        ...(isLinear
          ? { linearVariant, linearWeekCount: Math.min(weeks, 52) }
          : {}),
        // Chosen weekly raises live outside this form; carry them through an
        // edit. They are denominated in the unit, so a unit switch resets them.
        ...(isLinear &&
        initialInputs?.linearIncrements != null &&
        initialInputs.weightUnit === weightUnit
          ? { linearIncrements: initialInputs.linearIncrements }
          : {}),
        startDate: format(startDate, "yyyy-MM-dd"),
        weightUnit,
        bench1RM: b,
        squat1RM: s,
        deadlift1RM: d,
        horizontalPull,
        shoulderExercise,
        verticalPull,
        ...(!isNaN(hp1RM) && hp1RM > 0 ? { horizontalPull1RM: hp1RM } : {}),
        ...(!isNaN(sh1RM) && sh1RM > 0 ? { shoulderExercise1RM: sh1RM } : {}),
        ...(!isNaN(vp1RM) && vp1RM > 0 ? { verticalPull1RM: vp1RM } : {}),
      },
      exercises,
      selectedIds,
    );
    onSubmit(
      inputs,
      name,
      {
        ...(sex != null ? { sex } : {}),
        ...(!isNaN(bw) && bw > 0 ? { bodyWeight: bw } : {}),
      },
    );
  }

  function updateExerciseSelection(
    lift: MainLift,
    exerciseId: string,
  ): void {
    const latest = maxValueForExercise(exerciseMaxes, exerciseId, weightUnit);
    if (lift === "bench") {
      setBenchExerciseId(exerciseId);
      setBench1RM(latest);
    } else if (lift === "squat") {
      setSquatExerciseId(exerciseId);
      setSquat1RM(latest);
    } else {
      setDeadliftExerciseId(exerciseId);
      setDeadlift1RM(latest);
    }
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
              <CardTitle className="text-2xl font-bold">
                {isLinear ? "Candito Linear Program" : "Candito 6-Week"}
              </CardTitle>
              <CardDescription>Strength Program Tracker</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Program Type */}
            <div className="space-y-2">
              <Label>Program</Label>
              {isEditing ? (
                <p className="text-sm text-muted-foreground">
                  {isLinear
                    ? `Linear Program · ${LINEAR_VARIANT_LABELS[linearVariant]}`
                    : "6-Week Strength Program"}
                  <span className="ml-1 text-xs">
                    (program can't change once a cycle exists)
                  </span>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "six-week", label: "6-Week" },
                    { value: "linear", label: "Linear" },
                  ] satisfies { value: ProgramType; label: string }[]).map(
                    ({ value, label }) => (
                      <Button
                        key={value}
                        type="button"
                        variant={programType === value ? "default" : "outline"}
                        className="h-11 text-base font-semibold"
                        onClick={() => selectProgramType(value)}
                      >
                        {label}
                      </Button>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* Linear variant + length */}
            {isLinear && !isEditing && (
              <div className="space-y-2">
                <Label>Emphasis</Label>
                <Select
                  value={linearVariant}
                  onValueChange={(value) => setLinearVariant(value as LinearVariant)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LINEAR_VARIANT_LABELS) as LinearVariant[]).map(
                      (variant) => (
                        <SelectItem key={variant} value={variant}>
                          {LINEAR_VARIANT_LABELS[variant]}
                          {variant === "control" ? " (recommended)" : ""}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {LINEAR_VARIANT_DESCRIPTIONS[linearVariant]}
                </p>
              </div>
            )}
            {isLinear && (
              <div className="space-y-2">
                <Label>Planned Weeks</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={linearWeeks}
                  onChange={(e) => setLinearWeeks(e.target.value)}
                  className="h-11 text-base"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The program has no fixed end — you can add weeks anytime from
                  the cycle overview.
                </p>
              </div>
            )}

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
                        setDateTouched(true);
                        setCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {isLinear && startDate.getDay() !== 1 && (
                <p className="text-xs text-amber-400">
                  The spreadsheet schedule runs{" "}
                  {linearVariant === "three-day" ? "Mon/Wed/Fri" : "Mon/Tue/Thu/Fri"}{" "}
                  from a Monday start. Starting on a{" "}
                  {format(startDate, "EEEE")} shifts every day — you can
                  reschedule individual days from each workout screen.
                </p>
              )}
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
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                placeholder="0"
                className="h-11 text-base"
              />
            </div>

            {/* 1RM Inputs */}
            <div className="space-y-3">
              <Label>Main Exercises ({weightUnit})</Label>
              {([
                {
                  key: "bench",
                  label: "Bench",
                  exerciseId: benchExerciseId,
                  value: bench1RM,
                  setValue: setBench1RM,
                },
                {
                  key: "squat",
                  label: "Squat",
                  exerciseId: squatExerciseId,
                  value: squat1RM,
                  setValue: setSquat1RM,
                },
                {
                  key: "deadlift",
                  label: "Deadlift",
                  exerciseId: deadliftExerciseId,
                  value: deadlift1RM,
                  setValue: setDeadlift1RM,
                },
              ] satisfies {
                key: MainLift;
                label: string;
                exerciseId: string;
                value: string;
                setValue: (value: string) => void;
              }[]).map(({ key, label, exerciseId, value, setValue }) => (
                <div key={key} className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                    <Select
                      value={exerciseId}
                      onValueChange={(id) => updateExerciseSelection(key, id)}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {exerciseOptions.map((exercise) => (
                          <SelectItem key={exercise.id} value={exercise.id}>
                            {exercise.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]*"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="1RM"
                      className="h-11 text-base"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Accessory Selection — picks the movements behind the upper
                accessory slots. The 6-week program also prescribes their
                weights from an optional 1RM; linear logs them by feel. */}
            <div className="space-y-3">
              <Label>Accessory Exercises</Label>
              {isLinear && (
                <p className="text-xs text-muted-foreground">
                  Named in every upper session so you always know what to do —
                  weights stay logged by feel.
                </p>
              )}

              {[
                {
                  label: isLinear
                    ? "Primary Upper Back (row)"
                    : "Upper Back #1 (horizontal pull)",
                  value: horizontalPull,
                  onChange: (v: string) => setHorizontalPull(v as HorizontalPull),
                  options: HORIZONTAL_PULL_OPTIONS,
                  rm: horizontalPull1RM,
                  setRM: setHorizontalPull1RM,
                },
                {
                  label: isLinear ? "Shoulder Exercise (press)" : "Shoulder Exercise",
                  value: shoulderExercise,
                  onChange: (v: string) => setShoulderExercise(v as ShoulderExercise),
                  options: SHOULDER_OPTIONS,
                  rm: shoulderExercise1RM,
                  setRM: setShoulderExercise1RM,
                },
                {
                  label: "Upper Back #2 (vertical pull)",
                  value: verticalPull,
                  onChange: (v: string) => setVerticalPull(v as VerticalPull),
                  options: VERTICAL_PULL_OPTIONS,
                  rm: verticalPull1RM,
                  setRM: setVerticalPull1RM,
                },
              ].map(({ label, value, onChange, options, rm, setRM }) => (
                <div key={label} className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isLinear && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        1RM ({weightUnit})
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.,]?[0-9]*"
                        value={rm}
                        onChange={(e) => setRM(e.target.value)}
                        placeholder="optional"
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
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
