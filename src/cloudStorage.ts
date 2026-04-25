import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { AppData } from "./types";

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

export async function loadCloudData(uid: string): Promise<AppData | null> {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  const raw = snap.data();
  if (raw == null) return null;
  return {
    currentCycle: raw.currentCycle ?? null,
    history: raw.history ?? [],
    profile: raw.profile ?? {},
  };
}

export async function saveCloudData(uid: string, data: AppData): Promise<void> {
  const payload = stripUndefined({
    currentCycle: data.currentCycle,
    history: data.history,
    profile: data.profile,
    updatedAt: serverTimestamp(),
  }) as Record<string, unknown>;
  await setDoc(userDocRef(uid), payload, { merge: true });
}
