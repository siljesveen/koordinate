import type { AppDataKey } from "@/lib/data/storageKeys";

const SESSION_KEY = "koordinate.dirtyKeys.v1";
const dirty = new Set<string>();

function persistDirty(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify([...dirty]));
  } catch {
    // ignorer
  }
}

function loadPersistedDirty(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const key of parsed) {
      if (typeof key === "string") dirty.add(key);
    }
  } catch {
    // ignorer
  }
}

if (typeof window !== "undefined") {
  loadPersistedDirty();
}

export function markKeyDirty(key: AppDataKey | string): void {
  dirty.add(key);
  persistDirty();
}

export function markKeyClean(key: AppDataKey | string): void {
  dirty.delete(key);
  persistDirty();
}

export function isKeyDirty(key: AppDataKey | string): boolean {
  return dirty.has(key);
}

export function listDirtyKeys(): string[] {
  return [...dirty];
}

export function clearAllDirtyKeys(): void {
  dirty.clear();
  persistDirty();
}
