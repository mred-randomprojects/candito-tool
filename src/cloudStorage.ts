import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AppData } from "./types";
import { mergeAppData } from "./mergeAppData";
import { ensureExerciseData } from "./exerciseCatalog";
import {
  filterDeletedAppEntitiesFromAppData,
  mergeDeletedCycles,
  mergeDeletedDateOverrides,
  mergeDeletedFreeTrainingDays,
} from "./deletedAppEntities";

function stripUndefined(obj: unknown): unknown {
  if (obj == null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = stripUndefined(value);
    }
  }
  return clean;
}

function userDocRef(uid: string) {
  return doc(db, "users", uid, "data", "appData");
}

function appDataFromRaw(raw: Record<string, unknown>): AppData {
  return filterDeletedAppEntitiesFromAppData(
    ensureExerciseData({
      currentCycle: raw.currentCycle ?? null,
      history: raw.history ?? [],
      profile: raw.profile ?? {},
      exercises: raw.exercises ?? {},
      exerciseMaxes: raw.exerciseMaxes ?? [],
      freeTrainingDays: raw.freeTrainingDays ?? [],
      deletedCycles: raw.deletedCycles ?? [],
      deletedFreeTrainingDays: raw.deletedFreeTrainingDays ?? [],
      deletedDateOverrides: raw.deletedDateOverrides ?? [],
    } as Partial<AppData>),
  );
}

function payloadFromAppData(data: AppData): Record<string, unknown> {
  return stripUndefined({
    currentCycle: data.currentCycle,
    history: data.history,
    profile: data.profile,
    exercises: data.exercises,
    exerciseMaxes: data.exerciseMaxes,
    freeTrainingDays: data.freeTrainingDays,
    deletedCycles: data.deletedCycles,
    deletedFreeTrainingDays: data.deletedFreeTrainingDays,
    deletedDateOverrides: data.deletedDateOverrides,
    updatedAt: serverTimestamp(),
  }) as Record<string, unknown>;
}

export async function loadCloudData(uid: string): Promise<AppData | null> {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  const raw = snap.data();
  if (raw == null) return null;
  return appDataFromRaw(raw);
}

export async function saveCloudData(uid: string, data: AppData): Promise<AppData> {
  const ref = userDocRef(uid);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const cloudData = snap.exists() ? appDataFromRaw(snap.data()) : null;
    const deletedCycles = mergeDeletedCycles(
      data.deletedCycles ?? [],
      cloudData?.deletedCycles ?? [],
    );
    const deletedFreeTrainingDays = mergeDeletedFreeTrainingDays(
      data.deletedFreeTrainingDays ?? [],
      cloudData?.deletedFreeTrainingDays ?? [],
    );
    const deletedDateOverrides = mergeDeletedDateOverrides(
      data.deletedDateOverrides ?? [],
      cloudData?.deletedDateOverrides ?? [],
    );
    const localData = filterDeletedAppEntitiesFromAppData(
      ensureExerciseData({
        ...data,
        deletedCycles,
        deletedFreeTrainingDays,
        deletedDateOverrides,
      }),
    );
    const cloudDataWithMergedDeletes =
      cloudData == null
        ? null
        : filterDeletedAppEntitiesFromAppData(
            ensureExerciseData({
              ...cloudData,
              deletedCycles,
              deletedFreeTrainingDays,
              deletedDateOverrides,
            }),
          );
    const filteredData =
      cloudDataWithMergedDeletes == null
        ? localData
        : filterDeletedAppEntitiesFromAppData(
            ensureExerciseData(
              mergeAppData(localData, cloudDataWithMergedDeletes, "local"),
            ),
          );

    transaction.set(ref, payloadFromAppData(filteredData));
    return filteredData;
  });
}

export function subscribeCloudData(
  uid: string,
  onData: (data: AppData | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(appDataFromRaw(snap.data()));
    },
    onError,
  );
}
