import { useState, useMemo, useCallback, useTransition, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import type {
  ProgramInputs,
  CycleData,
  WorkoutLog,
  Program,
  UserProfile,
  DateOverride,
  AppData,
  MainLiftNameMap,
} from "./types";
import { generateProgram } from "./programEngine";
import {
  loadCycle,
  clearCycle,
  archiveCycle,
  loadHistory,
  renameCycleInHistory,
  updateCycleInHistory,
  deleteCycleFromHistory,
  loadProfile,
  saveProfile,
  loadAppData,
  saveAppData,
  StorageQuotaError,
} from "./storage";
import { AuthProvider, useAuth } from "./auth";
import { loadCloudData, saveCloudData, subscribeCloudData } from "./cloudStorage";
import { mergeAppData } from "./mergeAppData";
import { SetupForm } from "./components/SetupForm";
import { ProgramOverview } from "./components/ProgramOverview";
import { WorkoutView } from "./components/WorkoutView";
import { ActiveWorkout } from "./components/ActiveWorkout";
import { CycleHistory } from "./components/CycleHistory";
import { LoginPage } from "./components/LoginPage";
import { AccountPage } from "./components/AccountPage";
import { BottomTabs } from "./components/BottomTabs";
import { Loader2 } from "lucide-react";

function WorkoutRoute({
  program,
  activeCycle,
  profile,
  isReadOnly,
  updateLog,
  updateDateOverride,
  navigate,
}: {
  program: Program;
  activeCycle: CycleData;
  profile: UserProfile;
  isReadOnly: boolean;
  updateLog: (cycleId: string, weekIndex: number, dayIndex: number, log: WorkoutLog) => void;
  updateDateOverride: (cycleId: string, weekIndex: number, dayIndex: number, override: DateOverride | null) => void;
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
      onStartWorkout={!isReadOnly ? () => navigate(`/active/${weekIndex}/${dayIndex}`) : undefined}
      onBack={() => navigate("/overview")}
      onMarkComplete={!isReadOnly ? (newLog) => {
        updateLog(activeCycle.id, weekIndex, dayIndex, newLog);
        navigate("/overview");
      } : undefined}
      onUpdateLog={!isReadOnly ? (newLog) => {
        updateLog(activeCycle.id, weekIndex, dayIndex, newLog);
      } : undefined}
      onUpdateDateOverride={!isReadOnly ? (override) => {
        updateDateOverride(activeCycle.id, weekIndex, dayIndex, override);
      } : undefined}
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
  updateLog: (cycleId: string, weekIndex: number, dayIndex: number, log: WorkoutLog) => void;
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
        updateLog(activeCycle.id, weekIndex, dayIndex, newLog);
        navigate(`/workout/${weekIndex}/${dayIndex}`);
      }}
      onSavePartial={(partialLog) => {
        updateLog(activeCycle.id, weekIndex, dayIndex, partialLog);
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
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user == null) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [cycleData, setCycleData] = useState<CycleData | null>(() =>
    loadCycle(),
  );
  const [history, setHistory] = useState<CycleData[]>(() => loadHistory());
  const [viewingArchive, setViewingArchive] = useState<CycleData | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [cloudSavesEnabled, setCloudSavesEnabled] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile());
  const cloudSaveInFlight = useRef(false);
  const pendingCloudSave = useRef<AppData | null>(null);
  const [, startTransition] = useTransition();

  const activeCycle = viewingArchive ?? cycleData;
  const isReadOnly = viewingArchive != null;
  const showBottomTabs = ["/history", "/overview", "/account"].includes(
    location.pathname,
  );

  const inputs = activeCycle?.inputs;
  const program = useMemo(
    () => (inputs != null ? generateProgram(inputs) : null),
    [inputs],
  );

  const appData = useMemo<AppData>(
    () => ({ currentCycle: cycleData, history, profile }),
    [cycleData, history, profile],
  );

  const applyAppData = useCallback((next: AppData) => {
    setCycleData(next.currentCycle);
    setHistory(next.history);
    setProfile(next.profile);
    setViewingArchive((prev) => {
      if (prev == null) return null;
      const archived = next.history.find((cycle) => cycle.id === prev.id);
      if (archived != null) return archived;
      if (next.currentCycle?.id === prev.id) return null;
      return null;
    });
  }, []);

  useEffect(() => {
    try {
      saveAppData(appData);
    } catch (e: unknown) {
      if (e instanceof StorageQuotaError) {
        setStorageError(e.message);
      } else {
        throw e;
      }
    }
  }, [appData]);

  const flushCloudSave = useCallback((uid: string, dataToSave: AppData) => {
    cloudSaveInFlight.current = true;
    setCloudSyncing(true);
    saveCloudData(uid, dataToSave)
      .then(() => setCloudError(null))
      .catch((err: unknown) => {
        console.error("[cloud-sync] save failed:", err);
        setCloudError("Cloud sync failed. Your local data is still saved on this device.");
      })
      .finally(() => {
        const queued = pendingCloudSave.current;
        pendingCloudSave.current = null;
        if (queued != null) {
          flushCloudSave(uid, queued);
        } else {
          cloudSaveInFlight.current = false;
          setCloudSyncing(false);
        }
      });
  }, []);

  const queueCloudSave = useCallback(
    (dataToSave: AppData) => {
    if (user == null) return;
    if (!cloudSavesEnabled) {
      setCloudError("Cloud sync is paused because the initial cloud merge did not finish. Refresh and sign in again before forcing sync.");
      return;
    }
    if (cloudSaveInFlight.current) {
      pendingCloudSave.current = dataToSave;
    } else {
        flushCloudSave(user.uid, dataToSave);
      }
    },
    [user, cloudSavesEnabled, flushCloudSave],
  );

  useEffect(() => {
    if (user == null) return;

    let cancelled = false;
    setCloudSynced(false);
    setCloudSavesEnabled(false);
    setCloudSyncing(true);
    setCloudError(null);

    loadCloudData(user.uid)
      .then(async (cloudData) => {
        if (cancelled) return;
        const local = loadAppData();
        const merged = cloudData != null
          ? mergeAppData(local, cloudData, "cloud")
          : local;
        saveAppData(merged);
        applyAppData(merged);
        await saveCloudData(user.uid, merged);
        if (!cancelled) {
          setCloudSavesEnabled(true);
          setCloudSynced(true);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[cloud-sync] initial sync failed:", err);
        setCloudError("Could not load cloud data. Local data is still available on this device.");
        setCloudSavesEnabled(false);
        setCloudSynced(true);
      })
      .finally(() => {
        if (!cancelled) {
          setCloudSyncing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, applyAppData]);

  useEffect(() => {
    if (user == null || !cloudSynced) return;

    let applyingCloudUpdate = false;
    const unsubscribe = subscribeCloudData(
      user.uid,
      (cloudData) => {
        if (cloudData == null || applyingCloudUpdate) return;

        const local = loadAppData();
        const merged = mergeAppData(local, cloudData, "cloud");
        const localJson = JSON.stringify(local);
        const mergedJson = JSON.stringify(merged);
        if (localJson === mergedJson) return;

        applyingCloudUpdate = true;
        try {
          saveAppData(merged);
          applyAppData(merged);
        } finally {
          applyingCloudUpdate = false;
        }

        if (cloudSavesEnabled) {
          queueCloudSave(merged);
        }
      },
      (err: unknown) => {
        console.error("[cloud-sync] realtime sync failed:", err);
        setCloudError("Realtime cloud sync failed. Refresh to retry.");
      },
    );

    return unsubscribe;
  }, [user, cloudSynced, cloudSavesEnabled, queueCloudSave, applyAppData]);

  useEffect(() => {
    if (user == null || !cloudSynced || !cloudSavesEnabled) return;
    queueCloudSave(appData);
  }, [user, cloudSynced, cloudSavesEnabled, appData, queueCloudSave]);

  const forceCloudSync = useCallback(() => {
    queueCloudSave(appData);
  }, [appData, queueCloudSave]);

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

  const defaultCycleName = `Cycle ${history.length + (cycleData != null ? 1 : 0) + 1}`;

  const handleNewCycle = useCallback(() => {
    setViewingArchive(null);
    navigate("/setup");
  }, [navigate]);

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
        setViewingArchive(null);
        setHistory(loadHistory());
        navigate("/overview");
      });
    },
    [withQuotaGuard, navigate, cycleData],
  );

  const updateLog = useCallback(
    (cycleId: string, weekIndex: number, dayIndex: number, log: WorkoutLog) => {
      withQuotaGuard(() => {
        const updatedAt = new Date().toISOString();
        startTransition(() => {
          setCycleData((prev) => {
            if (prev == null || prev.id !== cycleId) return prev;
            const key = `w${weekIndex}-d${dayIndex}`;
            return {
              ...prev,
              workoutLogs: {
                ...prev.workoutLogs,
                [key]: { ...log, updatedAt },
              },
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
        const updatedAt = new Date().toISOString();
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
                  updatedAt,
                };
              } else if (!updatedLogs[key].completed) {
                updatedLogs[key] = {
                  ...updatedLogs[key],
                  completed: true,
                  completedAt: new Date().toISOString(),
                  updatedAt,
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
        setViewingArchive(null);
        setHistory(loadHistory());
      });
    },
    [cycleData, withQuotaGuard],
  );

  const handleUpdateTrainingInputs = useCallback(
    (
      bench: number,
      squat: number,
      deadlift: number,
      mainLiftNames: MainLiftNameMap,
    ) => {
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
                mainLiftNames,
              },
            };
          });
        });
      });
    },
    [withQuotaGuard, startTransition],
  );

  const handleUpdateDateOverride = useCallback(
    (cycleId: string, weekIndex: number, dayIndex: number, override: DateOverride | null) => {
      withQuotaGuard(() => {
        startTransition(() => {
          setCycleData((prev) => {
            if (prev == null || prev.id !== cycleId) return prev;
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
        setViewingArchive(null);
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

  if (!cloudSynced) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Syncing your training data</p>
          <p className="text-xs text-muted-foreground">
            Local and cloud data are being merged before the app opens.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
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
                onNewCycle={handleNewCycle}
                onBack={handleBackToHistory}
                isReadOnly={isReadOnly}
                onUpdateTrainingInputs={!isReadOnly ? handleUpdateTrainingInputs : undefined}
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
                isReadOnly={isReadOnly}
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
            program != null && activeCycle != null && !isReadOnly ? (
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
          path="/account"
          element={
            <AccountPage
              cloudSyncing={cloudSyncing}
              onForceSync={forceCloudSync}
            />
          }
        />

        <Route
          path="/history"
          element={
            <CycleHistory
              currentCycle={cycleData}
              history={history}
              onNewCycle={handleNewCycle}
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

      {cloudError != null && (
        <div className="fixed left-0 right-0 top-0 z-50 bg-destructive p-3 text-center text-sm text-destructive-foreground">
          {cloudError}
          <button
            className="ml-2 underline"
            onClick={() => setCloudError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {showBottomTabs && <BottomTabs hasProgram={activeCycle != null} />}
    </>
  );
}

export default App;
