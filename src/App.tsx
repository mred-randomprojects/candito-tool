import { useState, useMemo, useCallback } from "react";
import type { ProgramInputs, CycleData, WorkoutLog, View } from "./types";
import { generateProgram } from "./programEngine";
import {
  loadCycle,
  saveCycle,
  clearCycle,
  archiveCycle,
  loadHistory,
  renameCycleInHistory,
  deleteCycleFromHistory,
  nextCycleName,
  StorageQuotaError,
} from "./storage";
import { SetupForm } from "./components/SetupForm";
import { ProgramOverview } from "./components/ProgramOverview";
import { WorkoutView } from "./components/WorkoutView";
import { ActiveWorkout } from "./components/ActiveWorkout";
import { CycleHistory } from "./components/CycleHistory";

function App() {
  const [cycleData, setCycleData] = useState<CycleData | null>(() =>
    loadCycle(),
  );
  const [view, setView] = useState<View>(() =>
    cycleData != null ? { page: "overview" } : { page: "setup" },
  );
  const [history, setHistory] = useState<CycleData[]>(() => loadHistory());
  const [viewingArchive, setViewingArchive] = useState<CycleData | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const activeCycle = viewingArchive ?? cycleData;
  const isReadOnly = viewingArchive != null;

  const program = useMemo(
    () => (activeCycle != null ? generateProgram(activeCycle.inputs) : null),
    [activeCycle],
  );

  const withQuotaGuard = useCallback(
    (fn: () => void) => {
      try {
        setStorageError(null);
        fn();
      } catch (e: unknown) {
        if (e instanceof StorageQuotaError) {
          setStorageError(e.message);
        } else {
          throw e;
        }
      }
    },
    [],
  );

  const defaultCycleName = useMemo(() => nextCycleName(), [history, cycleData]);

  const handleSetup = useCallback(
    (inputs: ProgramInputs, cycleName: string) => {
      withQuotaGuard(() => {
        const newCycle: CycleData = {
          id: crypto.randomUUID(),
          name: cycleName,
          inputs,
          workoutLogs: {},
          createdAt: new Date().toISOString(),
        };
        saveCycle(newCycle);
        setCycleData(newCycle);
        setView({ page: "overview" });
      });
    },
    [withQuotaGuard],
  );

  const updateLog = useCallback(
    (weekIndex: number, dayIndex: number, log: WorkoutLog) => {
      withQuotaGuard(() => {
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
      });
    },
    [withQuotaGuard],
  );

  const markWeekComplete = useCallback(
    (weekIndex: number) => {
      if (program == null || cycleData == null) return;
      const week = program.weeks[weekIndex];
      withQuotaGuard(() => {
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
      });
    },
    [program, cycleData, withQuotaGuard],
  );

  const handleNewCycle = useCallback(() => {
    withQuotaGuard(() => {
      if (cycleData != null) {
        archiveCycle(cycleData);
        setHistory(loadHistory());
      }
      clearCycle();
      setCycleData(null);
      setView({ page: "setup" });
    });
  }, [cycleData, withQuotaGuard]);

  const handleRenameCurrent = useCallback(
    (newName: string) => {
      withQuotaGuard(() => {
        setCycleData((prev) => {
          if (prev == null) return prev;
          const updated = { ...prev, name: newName };
          saveCycle(updated);
          return updated;
        });
      });
    },
    [withQuotaGuard],
  );

  const handleRenameArchived = useCallback(
    (cycleId: string, newName: string) => {
      withQuotaGuard(() => {
        renameCycleInHistory(cycleId, newName);
        setHistory(loadHistory());
      });
    },
    [withQuotaGuard],
  );

  const handleDeleteArchived = useCallback(
    (cycleId: string) => {
      deleteCycleFromHistory(cycleId);
      setHistory(loadHistory());
    },
    [],
  );

  const handleViewCycle = useCallback(
    (cycle: CycleData) => {
      if (cycleData != null && cycle.id === cycleData.id) {
        setViewingArchive(null);
        setView({ page: "overview" });
      } else {
        setViewingArchive(cycle);
        setView({ page: "overview" });
      }
    },
    [cycleData],
  );

  const handleDeleteCurrent = useCallback(() => {
    clearCycle();
    setCycleData(null);
    setHistory(loadHistory());
  }, []);

  const handleSetAsCurrent = useCallback(
    (cycle: CycleData) => {
      withQuotaGuard(() => {
        if (cycleData != null) {
          archiveCycle(cycleData);
        }
        deleteCycleFromHistory(cycle.id);
        saveCycle(cycle);
        setCycleData(cycle);
        setHistory(loadHistory());
      });
    },
    [cycleData, withQuotaGuard],
  );

  const handleUpdate1RMs = useCallback(
    (bench: number, squat: number, deadlift: number) => {
      withQuotaGuard(() => {
        setCycleData((prev) => {
          if (prev == null) return prev;
          const updated: CycleData = {
            ...prev,
            inputs: {
              ...prev.inputs,
              bench1RM: bench,
              squat1RM: squat,
              deadlift1RM: deadlift,
            },
          };
          saveCycle(updated);
          return updated;
        });
      });
    },
    [withQuotaGuard],
  );

  const handleBackFromArchive = useCallback(() => {
    setViewingArchive(null);
    setView({ page: "history" });
  }, []);

  // --- Render ---

  if (storageError != null) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-bold text-destructive">Storage Full</h2>
          <p className="text-sm text-muted-foreground">{storageError}</p>
          <button
            className="text-sm text-primary underline"
            onClick={() => {
              setStorageError(null);
              setView({ page: "history" });
            }}
          >
            Go to History to free up space
          </button>
        </div>
      </div>
    );
  }

  if (view.page === "history") {
    return (
      <CycleHistory
        currentCycle={cycleData}
        history={history}
        onBack={() =>
          setView(cycleData != null ? { page: "overview" } : { page: "setup" })
        }
        onViewCycle={handleViewCycle}
        onRenameCurrent={handleRenameCurrent}
        onRenameArchived={handleRenameArchived}
        onDeleteArchived={handleDeleteArchived}
        onDeleteCurrent={handleDeleteCurrent}
        onSetAsCurrent={handleSetAsCurrent}
      />
    );
  }

  if (view.page === "setup") {
    return (
      <SetupForm
        defaultCycleName={defaultCycleName}
        onSubmit={handleSetup}
      />
    );
  }

  if (program == null || activeCycle == null) {
    return (
      <SetupForm
        defaultCycleName={defaultCycleName}
        onSubmit={handleSetup}
      />
    );
  }

  if (view.page === "overview") {
    return (
      <ProgramOverview
        program={program}
        cycleData={activeCycle}
        onSelectWorkout={(wi, di) =>
          setView({ page: "workout", weekIndex: wi, dayIndex: di })
        }
        onMarkWeekComplete={markWeekComplete}
        onNewCycle={handleNewCycle}
        onHistory={() => setView({ page: "history" })}
        isReadOnly={isReadOnly}
        onBackFromArchive={handleBackFromArchive}
        onUpdate1RMs={!isReadOnly ? handleUpdate1RMs : undefined}
      />
    );
  }

  if (view.page === "workout") {
    const week = program.weeks[view.weekIndex];
    const day = week.workoutDays[view.dayIndex];
    const logKey = `w${view.weekIndex}-d${view.dayIndex}`;
    const log = activeCycle.workoutLogs[logKey];

    return (
      <WorkoutView
        week={week}
        day={day}
        weekIndex={view.weekIndex}
        dayIndex={view.dayIndex}
        startDate={activeCycle.inputs.startDate}
        weightUnit={activeCycle.inputs.weightUnit}
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
        onUpdateLog={(newLog) => {
          updateLog(view.weekIndex, view.dayIndex, newLog);
        }}
      />
    );
  }

  if (view.page === "active") {
    const week = program.weeks[view.weekIndex];
    const day = week.workoutDays[view.dayIndex];
    const logKey = `w${view.weekIndex}-d${view.dayIndex}`;
    const log = activeCycle.workoutLogs[logKey];

    return (
      <ActiveWorkout
        day={day}
        weekTitle={week.title}
        weightUnit={activeCycle.inputs.weightUnit}
        existingLog={log}
        onComplete={(newLog) => {
          updateLog(view.weekIndex, view.dayIndex, newLog);
          setView({
            page: "workout",
            weekIndex: view.weekIndex,
            dayIndex: view.dayIndex,
          });
        }}
        onSavePartial={(partialLog) => {
          updateLog(view.weekIndex, view.dayIndex, partialLog);
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
