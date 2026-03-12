import { useState, useMemo, useCallback } from "react";
import type { ProgramInputs, CycleData, WorkoutLog, View } from "./types";
import { generateProgram } from "./programEngine";
import { loadCycle, saveCycle, clearCycle, archiveCycle } from "./storage";
import { SetupForm } from "./components/SetupForm";
import { ProgramOverview } from "./components/ProgramOverview";
import { WorkoutView } from "./components/WorkoutView";
import { ActiveWorkout } from "./components/ActiveWorkout";

function App() {
  const [cycleData, setCycleData] = useState<CycleData | null>(() =>
    loadCycle(),
  );
  const [view, setView] = useState<View>(() =>
    cycleData != null ? { page: "overview" } : { page: "setup" },
  );

  const program = useMemo(
    () => (cycleData != null ? generateProgram(cycleData.inputs) : null),
    [cycleData],
  );

  const handleSetup = useCallback((inputs: ProgramInputs) => {
    const newCycle: CycleData = {
      id: crypto.randomUUID(),
      inputs,
      workoutLogs: {},
      createdAt: new Date().toISOString(),
    };
    saveCycle(newCycle);
    setCycleData(newCycle);
    setView({ page: "overview" });
  }, []);

  const updateLog = useCallback(
    (weekIndex: number, dayIndex: number, log: WorkoutLog) => {
      setCycleData((prev) => {
        if (prev == null) return prev;
        const key = `w${weekIndex}-d${dayIndex}`;
        const updated: CycleData = {
          ...prev,
          workoutLogs: { ...prev.workoutLogs, [key]: log },
        };
        saveCycle(updated);
        return updated;
      });
    },
    [],
  );

  const markWeekComplete = useCallback(
    (weekIndex: number) => {
      if (program == null || cycleData == null) return;
      const week = program.weeks[weekIndex];
      setCycleData((prev) => {
        if (prev == null) return prev;
        const updatedLogs = { ...prev.workoutLogs };
        week.workoutDays.forEach((day, dayIndex) => {
          const key = `w${weekIndex}-d${dayIndex}`;
          if (updatedLogs[key] == null || !updatedLogs[key].completed) {
            updatedLogs[key] = {
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
        });
        const updated: CycleData = { ...prev, workoutLogs: updatedLogs };
        saveCycle(updated);
        return updated;
      });
    },
    [program, cycleData],
  );

  const handleNewCycle = useCallback(() => {
    if (cycleData != null) {
      archiveCycle(cycleData);
    }
    clearCycle();
    setCycleData(null);
    setView({ page: "setup" });
  }, [cycleData]);

  // --- Render ---

  if (view.page === "setup") {
    return <SetupForm onSubmit={handleSetup} />;
  }

  if (program == null || cycleData == null) {
    return <SetupForm onSubmit={handleSetup} />;
  }

  if (view.page === "overview") {
    return (
      <ProgramOverview
        program={program}
        cycleData={cycleData}
        onSelectWorkout={(wi, di) =>
          setView({ page: "workout", weekIndex: wi, dayIndex: di })
        }
        onMarkWeekComplete={markWeekComplete}
        onNewCycle={handleNewCycle}
      />
    );
  }

  if (view.page === "workout") {
    const week = program.weeks[view.weekIndex];
    const day = week.workoutDays[view.dayIndex];
    const logKey = `w${view.weekIndex}-d${view.dayIndex}`;
    const log = cycleData.workoutLogs[logKey];

    return (
      <WorkoutView
        week={week}
        day={day}
        weekIndex={view.weekIndex}
        dayIndex={view.dayIndex}
        startDate={cycleData.inputs.startDate}
        weightUnit={cycleData.inputs.weightUnit}
        log={log}
        onStartWorkout={() =>
          setView({
            page: "active",
            weekIndex: view.weekIndex,
            dayIndex: view.dayIndex,
          })
        }
        onBack={() => setView({ page: "overview" })}
        onMarkComplete={(newLog) => {
          updateLog(view.weekIndex, view.dayIndex, newLog);
          setView({ page: "overview" });
        }}
      />
    );
  }

  if (view.page === "active") {
    const week = program.weeks[view.weekIndex];
    const day = week.workoutDays[view.dayIndex];
    const logKey = `w${view.weekIndex}-d${view.dayIndex}`;
    const log = cycleData.workoutLogs[logKey];

    return (
      <ActiveWorkout
        day={day}
        weekTitle={week.title}
        weightUnit={cycleData.inputs.weightUnit}
        existingLog={log}
        onComplete={(newLog) => {
          updateLog(view.weekIndex, view.dayIndex, newLog);
          setView({
            page: "workout",
            weekIndex: view.weekIndex,
            dayIndex: view.dayIndex,
          });
        }}
        onBack={() =>
          setView({
            page: "workout",
            weekIndex: view.weekIndex,
            dayIndex: view.dayIndex,
          })
        }
      />
    );
  }

  return null;
}

export default App;
