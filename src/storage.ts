import type { AppData, CycleData, UserProfile } from "./types";

const STORAGE_KEY = "candito-cycle";
const HISTORY_KEY = "candito-history";
const PROFILE_KEY = "candito-profile";

export class StorageQuotaError extends Error {
  constructor() {
    super(
      "localStorage is full — no space left to save your data. Consider exporting and deleting old cycles from History.",
    );
    this.name = "StorageQuotaError";
  }
}

/**
 * Wraps localStorage.setItem and throws a clear StorageQuotaError
 * when the browser's quota is exceeded.
 */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e: unknown) {
    if (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      throw new StorageQuotaError();
    }
    throw e;
  }
}

/**
 * Backfills the `name` field for cycles saved before the history feature existed.
 */
function migrateCycle(cycle: CycleData, fallbackIndex: number): CycleData {
  if (cycle.name == null || cycle.name.length === 0) {
    return { ...cycle, name: `Cycle ${fallbackIndex}` };
  }
  return cycle;
}

// --- Current cycle ---

export function loadCycle(): CycleData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const cycle = JSON.parse(raw) as CycleData;
    const history = loadHistory();
    return migrateCycle(cycle, history.length + 1);
  } catch {
    return null;
  }
}

export function saveCycle(cycle: CycleData): void {
  safeSetItem(STORAGE_KEY, JSON.stringify(cycle));
}

export function clearCycle(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// --- History ---

export function loadHistory(): CycleData[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw == null) return [];
    const history = JSON.parse(raw) as CycleData[];
    return history.map((c, i) => migrateCycle(c, i + 1));
  } catch {
    return [];
  }
}

function saveHistory(history: CycleData[]): void {
  safeSetItem(HISTORY_KEY, JSON.stringify(history));
}

export function archiveCycle(cycle: CycleData): void {
  const history = loadHistory();
  history.push(cycle);
  saveHistory(history);
}

export function renameCycleInHistory(cycleId: string, newName: string): void {
  const history = loadHistory();
  const updated = history.map((c) =>
    c.id === cycleId ? { ...c, name: newName } : c,
  );
  saveHistory(updated);
}

export function updateCycleInHistory(
  cycleId: string,
  updates: Pick<CycleData, "name" | "inputs">,
): void {
  const history = loadHistory();
  const updated = history.map((c) =>
    c.id === cycleId ? { ...c, ...updates } : c,
  );
  saveHistory(updated);
}

export function deleteCycleFromHistory(cycleId: string): void {
  const history = loadHistory();
  saveHistory(history.filter((c) => c.id !== cycleId));
}

// --- Storage usage ---

/**
 * Returns how many bytes the app is using in localStorage
 * and the estimated total quota (~5 MB in most browsers).
 */
export function getStorageUsage(): { usedBytes: number; quotaBytes: number } {
  let usedBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key == null) continue;
    // Each char in JS is 2 bytes (UTF-16), localStorage stores strings
    usedBytes += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2;
  }
  // Most browsers give ~5 MB per origin
  const quotaBytes = 5 * 1024 * 1024;
  return { usedBytes, quotaBytes };
}

// --- User profile ---

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw == null) return {};
    return JSON.parse(raw) as UserProfile;
  } catch {
    return {};
  }
}

export function saveProfile(profile: UserProfile): void {
  safeSetItem(PROFILE_KEY, JSON.stringify(profile));
}

// --- Whole-app data ---

export function loadAppData(): AppData {
  return {
    currentCycle: loadCycle(),
    history: loadHistory(),
    profile: loadProfile(),
  };
}

export function saveAppData(data: AppData): void {
  if (data.currentCycle != null) {
    saveCycle(data.currentCycle);
  } else {
    clearCycle();
  }
  saveHistory(data.history);
  saveProfile(data.profile);
}

// --- Migration helper ---

/**
 * Returns the next default cycle name based on how many cycles exist.
 */
export function nextCycleName(): string {
  const history = loadHistory();
  const current = loadCycle();
  const total = history.length + (current != null ? 1 : 0);
  return `Cycle ${total + 1}`;
}
