/** Tidspunkt per app_data-nøkkel sist synket fra Supabase (ISO-streng). */
const META_KEY = "bemanning._syncMeta.v1";

export type SyncMeta = Record<string, string>;

export function getSyncMeta(): SyncMeta {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as SyncMeta;
  } catch {
    return {};
  }
}

export function getKeyMeta(key: string): string | undefined {
  return getSyncMeta()[key];
}

export function setKeyMeta(key: string, updatedAt: string): void {
  if (typeof window === "undefined") return;
  const meta = getSyncMeta();
  meta[key] = updatedAt;
  window.localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function setSyncMeta(entries: SyncMeta): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(META_KEY, JSON.stringify(entries));
}

export function mergeSyncMeta(entries: SyncMeta): void {
  if (typeof window === "undefined") return;
  setSyncMeta({ ...getSyncMeta(), ...entries });
}
