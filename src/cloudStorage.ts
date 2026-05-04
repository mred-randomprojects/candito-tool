import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AppData } from "./types";
import { ensureExerciseData } from "./exerciseCatalog";

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
  return ensureExerciseData({
    currentCycle: raw.currentCycle ?? null,
    history: raw.history ?? [],
    profile: raw.profile ?? {},
    exercises: raw.exercises ?? {},
    exerciseMaxes: raw.exerciseMaxes ?? [],
  } as Partial<AppData>);
}

export async function loadCloudData(uid: string): Promise<AppData | null> {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  const raw = snap.data();
  if (raw == null) return null;
  return appDataFromRaw(raw);
}

export async function saveCloudData(uid: string, data: AppData): Promise<void> {
  const payload = stripUndefined({
    currentCycle: data.currentCycle,
    history: data.history,
    profile: data.profile,
    exercises: data.exercises,
    exerciseMaxes: data.exerciseMaxes,
    updatedAt: serverTimestamp(),
  }) as Record<string, unknown>;
  await setDoc(userDocRef(uid), payload, { merge: true });
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
