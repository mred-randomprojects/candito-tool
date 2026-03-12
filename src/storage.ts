import type { CycleData } from "./types";

const STORAGE_KEY = "candito-cycle";
const HISTORY_KEY = "candito-history";

export function loadCycle(): CycleData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    return JSON.parse(raw) as CycleData;
  } catch {
    return null;
  }
}

export function saveCycle(cycle: CycleData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cycle));
}

export function clearCycle(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function archiveCycle(cycle: CycleData): void {
  const history = loadHistory();
  history.push(cycle);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function loadHistory(): CycleData[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw == null) return [];
    return JSON.parse(raw) as CycleData[];
  } catch {
    return [];
  }
}
