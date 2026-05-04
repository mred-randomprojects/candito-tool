import { useState, memo } from "react";
import type {
  MainLift,
  MainLiftNameMap,
  Program,
  CycleData,
  WorkoutLog,
  Sex,
} from "../types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { ArrowLeft, Check, Clipboard, Pencil } from "lucide-react";
import { StrengthCategory } from "./StrengthCategory";
import { buildCycleClipboardText } from "../cycleClipboard";
import {
  mainLiftNamesFromInputs,
  normalizeMainLiftNames,
} from "../exerciseNames";

interface ProgramOverviewProps {
  program: Program;
  cycleData: CycleData;
  bodyWeight?: number;
  sex?: Sex;
  onSelectWorkout: (weekIndex: number, dayIndex: number) => void;
  onMarkWeekComplete: (weekIndex: number) => void;
  onNewCycle: () => void;
  onBack: () => void;
  isReadOnly: boolean;
  onUpdateTrainingInputs?: (
    bench: number,
    squat: number,
    deadlift: number,
    mainLiftNames: MainLiftNameMap,
  ) => void;
}

function formatDate(startDate: string, dayOffset: number, overrideDate?: string): string {
  const d = overrideDate != null
    ? new Date(overrideDate + "T00:00:00")
    : (() => {
        const dt = new Date(startDate + "T00:00:00");
        dt.setDate(dt.getDate() + dayOffset);
        return dt;
      })();
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
  exercises: { name: string; isMainLift: boolean; mainLift?: MainLift }[],
): string {
  const mainLifts = exercises
    .map((e) => {
      if (e.mainLift === "bench") {
        return e.name === "Bench Press" ? "Bench" : e.name;
      }
      if (e.mainLift != null) return e.name;
      if (!e.isMainLift) return "";
      if (e.name === "Bench Press") return "Bench";
      if (e.name === "Extra Volume Squats") return "";
      if (e.name === "Back Off Squats") return "";
      return e.name;
    })
    .filter((n) => n.length > 0);
  return [...new Set(mainLifts)].join(" + ");
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText != null) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command failed");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

export const ProgramOverview = memo(function ProgramOverview({
  program,
  cycleData,
  bodyWeight,
  sex,
  onSelectWorkout,
  onMarkWeekComplete,
  onNewCycle,
  onBack,
  isReadOnly,
  onUpdateTrainingInputs,
}: ProgramOverviewProps) {
  const { inputs } = program;
  const mainLiftNames = mainLiftNamesFromInputs(inputs);
  const [editing1RMs, setEditing1RMs] = useState(false);
  const [confirming1RMs, setConfirming1RMs] = useState(false);
  const [editBench, setEditBench] = useState("");
  const [editSquat, setEditSquat] = useState("");
  const [editDeadlift, setEditDeadlift] = useState("");
  const [editBenchName, setEditBenchName] = useState("");
  const [editSquatName, setEditSquatName] = useState("");
  const [editDeadliftName, setEditDeadliftName] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  function startEditing1RMs() {
    setEditBench(String(inputs.bench1RM));
    setEditSquat(String(inputs.squat1RM));
    setEditDeadlift(String(inputs.deadlift1RM));
    setEditBenchName(mainLiftNames.bench);
    setEditSquatName(mainLiftNames.squat);
    setEditDeadliftName(mainLiftNames.deadlift);
    setEditing1RMs(true);
    setConfirming1RMs(false);
  }

  function requestConfirmation() {
    const bench = parseFloat(editBench);
    const squat = parseFloat(editSquat);
    const deadlift = parseFloat(editDeadlift);
    if (isNaN(bench) || isNaN(squat) || isNaN(deadlift)) return;
    if (bench <= 0 || squat <= 0 || deadlift <= 0) return;
    const nextMainLiftNames = normalizeMainLiftNames({
      bench: editBenchName,
      squat: editSquatName,
      deadlift: editDeadliftName,
    });
    const namesUnchanged =
      nextMainLiftNames.bench === mainLiftNames.bench &&
      nextMainLiftNames.squat === mainLiftNames.squat &&
      nextMainLiftNames.deadlift === mainLiftNames.deadlift;
    if (
      bench === inputs.bench1RM &&
      squat === inputs.squat1RM &&
      deadlift === inputs.deadlift1RM &&
      namesUnchanged
    ) {
      setEditing1RMs(false);
      return;
    }
    setConfirming1RMs(true);
  }

  function confirmUpdate() {
    const bench = parseFloat(editBench);
    const squat = parseFloat(editSquat);
    const deadlift = parseFloat(editDeadlift);
    const updatedNames = normalizeMainLiftNames({
      bench: editBenchName,
      squat: editSquatName,
      deadlift: editDeadliftName,
    });
    onUpdateTrainingInputs?.(bench, squat, deadlift, updatedNames);
    setEditing1RMs(false);
    setConfirming1RMs(false);
  }

  function cancelEditing() {
    setEditing1RMs(false);
    setConfirming1RMs(false);
  }

  async function copyCycleToClipboard() {
    const text = buildCycleClipboardText(program, cycleData);
    try {
      await copyTextToClipboard(text);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 3000);
    }
  }

  // Find the first incomplete workout across all weeks
  let nextWorkout: { weekIndex: number; dayIndex: number } | null = null;
  for (let wi = 0; wi < program.weeks.length && nextWorkout == null; wi++) {
    const wk = program.weeks[wi];
    if (wk.weekNumber === 6) continue;
    for (let di = 0; di < wk.workoutDays.length; di++) {
      const log = getWorkoutLog(cycleData, wi, di);
      if (log == null || !log.completed) {
        nextWorkout = { weekIndex: wi, dayIndex: di };
        break;
      }
    }
  }

  const liftRows = [
    {
      key: "bench",
      label: "Bench",
      name: mainLiftNames.bench,
      value: inputs.bench1RM,
      editName: editBenchName,
      setEditName: setEditBenchName,
      editValue: editBench,
      setEditValue: setEditBench,
    },
    {
      key: "squat",
      label: "Squat",
      name: mainLiftNames.squat,
      value: inputs.squat1RM,
      editName: editSquatName,
      setEditName: setEditSquatName,
      editValue: editSquat,
      setEditValue: setEditSquat,
    },
    {
      key: "deadlift",
      label: "Deadlift",
      name: mainLiftNames.deadlift,
      value: inputs.deadlift1RM,
      editName: editDeadliftName,
      setEditName: setEditDeadliftName,
      editValue: editDeadlift,
      setEditValue: setEditDeadlift,
    },
  ] satisfies {
    key: MainLift;
    label: string;
    name: string;
    value: number;
    editName: string;
    setEditName: (value: string) => void;
    editValue: string;
    setEditValue: (value: string) => void;
  }[];

  return (
    <div className="min-h-dvh pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">
                {cycleData.name}
                {isReadOnly && (
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    (archived)
                  </span>
                )}
              </h1>
              <p className="text-xs text-muted-foreground">
                Started{" "}
                {new Date(inputs.startDate + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "long", day: "numeric", year: "numeric" },
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyCycleToClipboard}
              className="gap-1.5"
              title="Copy cycle details"
            >
              {copyStatus === "copied" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Clipboard className="h-3.5 w-3.5" />
              )}
              <span>{copyStatus === "copied" ? "Copied" : "Copy Cycle"}</span>
            </Button>
            {!isReadOnly && (
              <Button variant="outline" size="sm" onClick={onNewCycle}>
                New Cycle
              </Button>
            )}
          </div>
        </div>
        {copyStatus === "error" && (
          <div className="max-w-lg mx-auto mt-2 text-right text-[10px] text-destructive">
            Could not copy. Check browser clipboard permissions.
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="max-w-lg mx-auto px-4 mt-4">
        {!editing1RMs ? (
          <div
            className={`grid grid-cols-3 gap-3 ${onUpdateTrainingInputs != null && !isReadOnly ? "cursor-pointer group" : ""}`}
            onClick={() => {
              if (onUpdateTrainingInputs != null && !isReadOnly) startEditing1RMs();
            }}
          >
            {liftRows.map(({ key, name, value }) => (
              <Card key={key} className="text-center group-hover:border-foreground/20 transition-colors">
                <CardContent className="p-3">
                  <div
                    className="text-[11px] text-muted-foreground mb-0.5 truncate"
                    title={`${name} 1RM`}
                  >
                    {name} 1RM
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
            {onUpdateTrainingInputs != null && !isReadOnly && (
              <div className="col-span-3 flex justify-center">
                <span className="text-[10px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex items-center gap-1">
                  <Pencil className="h-2.5 w-2.5" />
                  Tap to edit
                </span>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-3">
              {!confirming1RMs ? (
                <>
                  <div className="text-xs text-muted-foreground font-medium">
                    Update main exercises ({inputs.weightUnit})
                  </div>
                  <div className="space-y-2">
                    {liftRows.map(({ key, label, editName, setEditName, editValue, setEditValue }) => (
                      <div key={key}>
                        <label className="block text-[10px] text-muted-foreground mb-1">
                          {label}
                        </label>
                        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="text-sm h-10"
                          />
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="text-center text-sm font-bold h-10"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={requestConfirmation}>
                      Update
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-center">
                    Update program settings?
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    This will update the program based on the new names and 1RM values.
                    Your logged workout data will not be affected.
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    {liftRows.map(({ key, name, editName, value, editValue }) => (
                      <div key={key}>
                        <div className="text-muted-foreground truncate">
                          {editName.trim().length > 0 ? editName.trim() : name}
                        </div>
                        <div>
                          <span className="text-muted-foreground/60">{value}</span>
                          {" → "}
                          <span className="font-bold">{editValue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={confirmUpdate}>
                      Confirm
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming1RMs(false)}>
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Strength Level */}
      {bodyWeight != null && sex != null && (
        <div className="max-w-lg mx-auto px-4 mt-4">
          <StrengthCategory
            bench1RM={inputs.bench1RM}
            squat1RM={inputs.squat1RM}
            deadlift1RM={inputs.deadlift1RM}
            bodyWeight={bodyWeight}
            sex={sex}
            weightUnit={inputs.weightUnit}
            mainLiftNames={mainLiftNames}
          />
        </div>
      )}

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
                  {!isReadOnly && !isWeek6 && !weekComplete && week.workoutDays.length > 0 && (
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
                    const logKey = `w${weekIndex}-d${dayIndex}`;
                    const dateOvr = cycleData.dateOverrides?.[logKey];
                    const workoutDate = dateOvr != null
                      ? new Date(dateOvr.date + "T00:00:00")
                      : (() => {
                          const dt = new Date(inputs.startDate + "T00:00:00");
                          dt.setDate(dt.getDate() + day.dayOffset);
                          return dt;
                        })();
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isPast = workoutDate < today && !done;
                    const isNext =
                      nextWorkout != null &&
                      nextWorkout.weekIndex === weekIndex &&
                      nextWorkout.dayIndex === dayIndex;

                    return (
                      <button
                        key={dayIndex}
                        onClick={() => onSelectWorkout(weekIndex, dayIndex)}
                        className={`rounded-xl p-3 text-left transition-all border ${
                          done
                            ? "bg-emerald-950/30 border-emerald-800/40"
                            : started
                              ? "bg-amber-950/20 border-amber-800/40"
                              : isNext
                                ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30"
                                : isPast
                                  ? "bg-secondary/30 border-border/50 opacity-60 hover:opacity-100 hover:border-foreground/20 hover:bg-secondary"
                                  : "bg-secondary/50 border-border hover:border-foreground/20 hover:bg-secondary"
                        }`}
                      >
                        <div className={`text-[10px] mb-1 ${dateOvr != null ? "text-amber-400" : "text-muted-foreground"}`}>
                          {formatDate(inputs.startDate, day.dayOffset, dateOvr?.date)}
                          {dateOvr != null && (
                            <span className="ml-1 text-amber-400/60">↻</span>
                          )}
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
                        {isNext && !started && (
                          <div className="text-[10px] text-primary mt-1">
                            Up next
                          </div>
                        )}
                        {isPast && !started && !isNext && (
                          <div className="text-[10px] text-muted-foreground/60 mt-1">
                            Past
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
});
