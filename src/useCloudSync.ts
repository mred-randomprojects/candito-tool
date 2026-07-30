import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { User } from "firebase/auth";
import type { AppData } from "./types";
import { loadCloudData, saveCloudData, subscribeCloudData } from "./cloudStorage";
import { mergeAppData } from "./mergeAppData";

interface UseCloudSyncArgs {
  user: User | null;
  /** The current app data; changes to it are queued for cloud saves. */
  appData: AppData;
  /** Always-fresh reference to the latest app data, for async callbacks. */
  appDataRef: MutableRefObject<AppData>;
  /** Persists and applies merged data locally; false when storage is full. */
  saveAndApplyAppData: (next: AppData) => boolean;
}

export interface CloudSync {
  cloudError: string | null;
  dismissCloudError: () => void;
  cloudSyncing: boolean;
  forceCloudSync: () => void;
}

/**
 * The cloud sync engine: initial load-and-merge on sign-in, realtime
 * subscription merging, and debounced-by-in-flight uploads of local changes.
 * Saves stay disabled until the initial merge lands so a half-synced device
 * can never overwrite the cloud with less data than it holds.
 */
export function useCloudSync({
  user,
  appData,
  appDataRef,
  saveAndApplyAppData,
}: UseCloudSyncArgs): CloudSync {
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [cloudSavesEnabled, setCloudSavesEnabled] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const cloudSaveInFlight = useRef(false);
  const pendingCloudSave = useRef<AppData | null>(null);

  const flushCloudSave = useCallback((uid: string, dataToSave: AppData) => {
    cloudSaveInFlight.current = true;
    setCloudSyncing(true);
    saveCloudData(uid, dataToSave)
      .then((savedData) => {
        setCloudError(null);
        if (pendingCloudSave.current != null) return;
        if (JSON.stringify(appDataRef.current) !== JSON.stringify(savedData)) {
          saveAndApplyAppData(savedData);
        }
      })
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
  }, [appDataRef, saveAndApplyAppData]);

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
    const syncStartJson = JSON.stringify(appDataRef.current);
    setCloudSynced(false);
    setCloudSavesEnabled(false);
    setCloudSyncing(true);
    setCloudError(null);

    loadCloudData(user.uid)
      .then((cloudData) => {
        if (cancelled) return;
        const local = appDataRef.current;
        const localChangedDuringSync =
          JSON.stringify(local) !== syncStartJson;
        const merged = cloudData != null
          ? mergeAppData(
              local,
              cloudData,
              localChangedDuringSync ? "local" : "cloud",
            )
          : local;
        if (JSON.stringify(local) !== JSON.stringify(merged)) {
          const saved = saveAndApplyAppData(merged);
          if (!saved) {
            setCloudSavesEnabled(false);
            setCloudSynced(true);
            return;
          }
        }
        if (!cancelled) {
          setCloudSavesEnabled(true);
          setCloudSynced(true);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[cloud-sync] initial sync failed:", err);
        setCloudError("Could not load cloud data. Showing local data only; cloud sync is paused until refresh.");
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
  }, [user, appDataRef, saveAndApplyAppData]);

  useEffect(() => {
    if (user == null || !cloudSynced) return;

    let applyingCloudUpdate = false;
    const unsubscribe = subscribeCloudData(
      user.uid,
      (cloudData) => {
        if (cloudData == null || applyingCloudUpdate) return;

        const local = appDataRef.current;
        const merged = mergeAppData(local, cloudData, "cloud");
        const localJson = JSON.stringify(local);
        const mergedJson = JSON.stringify(merged);
        if (localJson === mergedJson) return;

        applyingCloudUpdate = true;
        try {
          saveAndApplyAppData(merged);
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
  }, [user, cloudSynced, cloudSavesEnabled, queueCloudSave, saveAndApplyAppData, appDataRef]);

  useEffect(() => {
    if (user == null || !cloudSynced || !cloudSavesEnabled) return;
    queueCloudSave(appData);
  }, [user, cloudSynced, cloudSavesEnabled, appData, queueCloudSave]);

  const forceCloudSync = useCallback(() => {
    queueCloudSave(appData);
  }, [appData, queueCloudSave]);

  const dismissCloudError = useCallback(() => {
    setCloudError(null);
  }, []);

  return { cloudError, dismissCloudError, cloudSyncing, forceCloudSync };
}
