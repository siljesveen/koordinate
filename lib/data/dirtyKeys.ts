import type { AppDataKey } from "@/lib/data/storageKeys";

const dirty = new Set<string>();

export function markKeyDirty(key: AppDataKey | string): void {
  dirty.add(key);
}

export function markKeyClean(key: AppDataKey | string): void {
  dirty.delete(key);
}

export function isKeyDirty(key: AppDataKey | string): boolean {
  return dirty.has(key);
}

export function listDirtyKeys(): string[] {
  return [...dirty];
}

export function clearAllDirtyKeys(): void {
  dirty.clear();
}
