import { useState, useMemo, useCallback, useTransition, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import type { ProgramInputs, CycleData, WorkoutLog, Program, UserProfile, DateOverride } from "./types";
import { generateProgram } from "./programEngine";
import {
  loadCycle,
  saveCycle,
  clearCycle,
  archiveCycle,
  loadHistory,
  renameCycleInHistory,
  updateCycleInHistory,
  deleteCycleFromHistory,
  nextCycleName,
  loadProfile,
  saveProfile,
  StorageQuotaError,
} from "./storage";
import { SetupForm } from "./components/SetupForm";
import { ProgramOverview } from "./components/ProgramOverview";
import { WorkoutView } from "./components/WorkoutView";
import { ActiveWorkout } from "./components/ActiveWorkout";
import { CycleHistory } from "./components/CycleHistory";

function WorkoutRoute({
  program,
  activeCycle,
  profile,
  updateLog,
  updateDateOverride,
  navigate,
}: {
  program: Program;
  activeCycle: CycleData;
  profile: UserProfile;
  updateLog: (weekIndex: number, dayIndex: number, log: WorkoutLog) => void;
  updateDateOverride: (weekIndex: number, dayIndex: number, override: DateOverride | null) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { weekIndex: wi, dayIndex: di } = useParams();
  const weekIndex = Number(wi);
  const dayIndex = Number(di);

  const week = program.weeks[weekIndex];
  if (week == null) return <Navigate to="/overview" replace />;

  const day = week.workoutDays[dayIndex];
  if (day == null) return <Navigate to="/overview" replace />;

  const logKey = `w${weekIndex}-d${dayIndex}`;
  const log = activeCycle.workoutLogs[logKey];
  const dateOverride = activeCycle.dateOverrides?.[logKey];

  return (
    <WorkoutView
      week={week}
      day={day}
      weekIndex={weekIndex}
      dayIndex={dayIndex}
      startDate={activeCycle.inputs.startDate}
      weightUnit={activeCycle.inputs.weightUnit}
      bodyWeight={profile.bodyWeight}
      sex={profile.sex}
      log={log}
      dateOverride={dateOverride}
      onStartWorkout={() => navigate(`/active/${weekIndex}/${dayIndex}`)}
      onBack={() => navigate("/overview")}
      onMarkComplete={(newLog) => {
        updateLog(weekIndex, dayIndex, newLog);
        navigate("/overview");
      }}
      onUpdateLog={(newLog) => {
        updateLog(weekIndex, dayIndex, newLog);
      }}
      onUpdateDateOverride={(override) => {
        updateDateOverride(weekIndex, dayIndex, override);
      }}
    />
  );
}

function ActiveWorkoutRoute({
  program,
  activeCycle,
  updateLog,
  navigate,
}: {
  program: Program;
  activeCycle: CycleData;
  updateLog: (weekIndex: number, dayIndex: number, log: WorkoutLog) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { weekIndex: wi, dayIndex: di } = useParams();
  const weekIndex = Number(wi);
  const dayIndex = Number(di);

  const week = program.weeks[weekIndex];
  if (week == null) return <Navigate to="/overview" replace />;

  const day = week.workoutDays[dayIndex];
  if (day == null) return <Navigate to="/overview" replace />;

  const logKey = `w${weekIndex}-d${dayIndex}`;
  const log = activeCycle.workoutLogs[logKey];

  return (
    <ActiveWorkout
      day={day}
      weekTitle={week.title}
      weightUnit={activeCycle.inputs.weightUnit}
      existingLog={log}
      onComplete={(newLog) => {
        updateLog(weekIndex, dayIndex, newLog);
        navigate(`/workout/${weekIndex}/${dayIndex}`);
      }}
      onSavePartial={(partialLog) => {
        updateLog(weekIndex, dayIndex, partialLog);
      }}
      onBack={() => navigate(`/workout/${weekIndex}/${dayIndex}`)}
    />
  );
}

function EditCycleRoute({
  cycleData,
  history,
  profile,
  onSubmit,
  onCancel,
}: {
  cycleData: CycleData | null;
  history: CycleData[];
  profile: UserProfile;
  onSubmit: (cycleId: string, inputs: ProgramInputs, cycleName: string, profile: UserProfile) => void;
  onCancel: () => void;
}) {
  const { cycleId } = useParams();
  const cycle =
    cycleData != null && cycleData.id === cycleId
      ? cycleData
      : history.find((c) => c.id === cycleId);

  if (cycle == null) return <Navigate to="/history" replace />;

  return (
    <SetupForm
      defaultCycleName={cycle.name}
      initialProfile={profile}
      initialInputs={cycle.inputs}
      submitLabel="Save Changes"
      onSubmit={(inputs, name, updatedProfile) =>
        onSubmit(cycle.id, inputs, name, updatedProfile)
      }
      onCancel={onCancel}
    />
  );
}

function App() {
  const navigate = useNavigate();

  const [cycleData, setCycleData] = useState<CycleData | null>(() =>
    loadCycle(),
  );
  const [history, setHistory] = useState<CycleData[]>(() => loadHistory());
  const [viewingArchive, setViewingArchive] = useState<CycleData | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile());
  const [, startTransition] = useTransition();

  const activeCycle = viewingArchive ?? cycleData;
  const isReadOnly = viewingArchive != null;

  const inputs = activeCycle?.inputs;
  const program = useMemo(
    () => (inputs != null ? generateProgram(inputs) : null),
    [inputs],
  );

  useEffect(() => {
    if (cycleData != null) {
      try {
        saveCycle(cycleData);
      } catch (e: unknown) {
        if (e instanceof StorageQuotaError) {
          setStorageError(e.message);
        } else {
          throw e;
        }
      }
    }
  }, [cycleData]);

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
    (inputs: ProgramInputs, cycleName: string, updatedProfile: UserProfile) => {
      withQuotaGuard(() => {
        saveProfile(updatedProfile);
        setProfile(updatedProfile);

        // Archive current cycle before creating new one
        if (cycleData != null) {
          archiveCycle(cycleData);
        }
        const newCycle: CycleData = {
          id: crypto.randomUUID(),
          name: cycleName,
          inputs,
          workoutLogs: {},
          createdAt: new Date().toISOString(),
        };
        setCycleData(newCycle);
        setHistory(loadHistory());
        navigate("/overview");
      });
    },
    [withQuotaGuard, navigate, cycleData],
  );

  const updateLog = useCallback(
    (weekIndex: number, dayIndex: number, log: WorkoutLog) => {
      withQuotaGuard(() => {
        startTransition(() => {
          setCycleData((prev) => {
            if (prev == null) return prev;
            const key = `w${weekIndex}-d${dayIndex}`;
            return {
              ...prev,
              workoutLogs: { ...prev.workoutLogs, [key]: log },
            };
          });
        });
      });
    },
    [withQuotaGuard, startTransition],
  );

  const markWeekComplete = useCallback(
    (weekIndex: number) => {
      if (program == null || cycleData == null) return;
      const week = program.weeks[weekIndex];
      withQuotaGuard(() => {
        startTransition(() => {
          setCycleData((prev) => {
            if (prev == null) return prev;
            const updatedLogs = { ...prev.workoutLogs };
            week.workoutDays.forEach((day, dayIndex) => {
              const key = `w${weekIndex}-d${dayIndex}`;
              if (updatedLogs[key] == null) {
                updatedLogs[key] = {
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
              } else if (!updatedLogs[key].completed) {
                updatedLogs[key] = {
                  ...updatedLogs[key],
                  completed: true,
                  completedAt: new Date().toISOString(),
                };
              }
            });
            return { ...prev, workoutLogs: updatedLogs };
          });
        });
      });
    },
    [program, cycleData, withQuotaGuard, startTransition],
  );

  const handleRenameCurrent = useCallback(
    (newName: string) => {
      withQuotaGuard(() => {
        startTransition(() => {
          setCycleData((prev) => {
            if (prev == null) return prev;
            return { ...prev, name: newName };
          });
        });
      });
    },
    [withQuotaGuard, startTransition],
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
      } else {
        setViewingArchive(cycle);
      }
      navigate("/overview");
    },
    [cycleData, navigate],
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
        setCycleData(cycle);
        setHistory(loadHistory());
      });
    },
    [cycleData, withQuotaGuard],
  );

  const handleUpdate1RMs = useCallback(
    (bench: number, squat: number, deadlift: number) => {
      withQuotaGuard(() => {
        startTransition(() => {
          setCycleData((prev) => {
            if (prev == null) return prev;
            return {
              ...prev,
              inputs: {
                ...prev.inputs,
                bench1RM: bench,
                squat1RM: squat,
                deadlift1RM: deadlift,
              },
            };
          });
        });
      });
    },
    [withQuotaGuard, startTransition],
  );

  const handleUpdateDateOverride = useCallback(
    (weekIndex: number, dayIndex: number, override: DateOverride | null) => {
      withQuotaGuard(() => {
        startTransition(() => {
          setCycleData((prev) => {
            if (prev == null) return prev;
            const key = `w${weekIndex}-d${dayIndex}`;
            const overrides = { ...(prev.dateOverrides ?? {}) };
            if (override != null) {
              overrides[key] = override;
            } else {
              delete overrides[key];
            }
            return { ...prev, dateOverrides: overrides };
          });
        });
      });
    },
    [withQuotaGuard, startTransition],
  );

  const handleEditCycle = useCallback(
    (cycleId: string, inputs: ProgramInputs, cycleName: string, updatedProfile: UserProfile) => {
      withQuotaGuard(() => {
        saveProfile(updatedProfile);
        setProfile(updatedProfile);

        if (cycleData != null && cycleData.id === cycleId) {
          setCycleData({ ...cycleData, name: cycleName, inputs });
        } else {
          updateCycleInHistory(cycleId, { name: cycleName, inputs });
          setHistory(loadHistory());
        }
        navigate("/history");
      });
    },
    [withQuotaGuard, navigate, cycleData],
  );

  const handleBackToHistory = useCallback(() => {
    setViewingArchive(null);
    navigate("/history");
  }, [navigate]);

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
              navigate("/history");
            }}
          >
            Go to History to free up space
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/history" replace />} />

      <Route
        path="/setup"
        element={
          <SetupForm
            defaultCycleName={defaultCycleName}
            initialProfile={profile}
            onSubmit={handleSetup}
            onCancel={() => navigate("/history")}
          />
        }
      />

      <Route
        path="/edit/:cycleId"
        element={
          <EditCycleRoute
            cycleData={cycleData}
            history={history}
            profile={profile}
            onSubmit={handleEditCycle}
            onCancel={() => navigate("/history")}
          />
        }
      />

      <Route
        path="/overview"
        element={
          program != null && activeCycle != null ? (
            <ProgramOverview
              program={program}
              cycleData={activeCycle}
              bodyWeight={profile.bodyWeight}
              sex={profile.sex}
              onSelectWorkout={(wi, di) => navigate(`/workout/${wi}/${di}`)}
              onMarkWeekComplete={markWeekComplete}
              onNewCycle={() => navigate("/setup")}
              onBack={handleBackToHistory}
              isReadOnly={isReadOnly}
              onUpdate1RMs={!isReadOnly ? handleUpdate1RMs : undefined}
            />
          ) : (
            <Navigate to="/history" replace />
          )
        }
      />

      <Route
        path="/workout/:weekIndex/:dayIndex"
        element={
          program != null && activeCycle != null ? (
            <WorkoutRoute
              program={program}
              activeCycle={activeCycle}
              profile={profile}
              updateLog={updateLog}
              updateDateOverride={handleUpdateDateOverride}
              navigate={navigate}
            />
          ) : (
            <Navigate to="/history" replace />
          )
        }
      />

      <Route
        path="/active/:weekIndex/:dayIndex"
        element={
          program != null && activeCycle != null ? (
            <ActiveWorkoutRoute
              program={program}
              activeCycle={activeCycle}
              updateLog={updateLog}
              navigate={navigate}
            />
          ) : (
            <Navigate to="/history" replace />
          )
        }
      />

      <Route
        path="/history"
        element={
          <CycleHistory
            currentCycle={cycleData}
            history={history}
            onNewCycle={() => navigate("/setup")}
            onViewCycle={handleViewCycle}
            onEditCycle={(cycle) => navigate(`/edit/${cycle.id}`)}
            onRenameCurrent={handleRenameCurrent}
            onRenameArchived={handleRenameArchived}
            onDeleteArchived={handleDeleteArchived}
            onDeleteCurrent={handleDeleteCurrent}
            onSetAsCurrent={handleSetAsCurrent}
          />
        }
      />

      {/* Catch-all: redirect unknown routes */}
      <Route path="*" element={<Navigate to="/history" replace />} />
    </Routes>
  );
}

export default App;
