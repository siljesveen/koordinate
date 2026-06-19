import { APP_DATA_KEYS, type AppDataKey } from "./storageKeys";

export const BACKUP_FORMAT_VERSION = 1;

export type KoordinateBackupMeta = {
  version: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  app: "koordinate";
};

export type KoordinateBackupFile = {
  meta: KoordinateBackupMeta;
  data: Record<string, unknown>;
};

export type ParsedBackupFile = {
  data: Record<string, unknown>;
  keys: AppDataKey[];
  format: "envelope" | "legacy";
};

export type BackupEntryStats = {
  nøkler: number;
  poster: number;
};

function erAppDataKey(key: string): key is AppDataKey {
  return (APP_DATA_KEYS as readonly string[]).includes(key);
}

function filtrerKjenteNøkler(data: Record<string, unknown>): AppDataKey[] {
  return Object.keys(data).filter(erAppDataKey);
}

/** Les alle app-data-nøkler fra localStorage (eller injisert getter i tester). */
export function exportAppDataFromLocalStorage(
  getItem: (key: string) => string | null = (key) =>
    typeof window !== "undefined" ? window.localStorage.getItem(key) : null,
): KoordinateBackupFile {
  const data: Record<string, unknown> = {};

  for (const key of APP_DATA_KEYS) {
    const raw = getItem(key);
    if (!raw) continue;
    try {
      data[key] = JSON.parse(raw) as unknown;
    } catch {
      data[key] = raw;
    }
  }

  return {
    meta: {
      version: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      app: "koordinate",
    },
    data,
  };
}

export function backupDownloadFilename(dato = new Date()): string {
  return `koordinate-backup-${dato.toISOString().slice(0, 10)}.json`;
}

export function serializeBackupForDownload(backup: KoordinateBackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Støtter både ny konvolutt ({ meta, data }) og eldre flate JSON-filer. */
export function parseBackupFile(parsed: unknown): ParsedBackupFile | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.meta && obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    const meta = obj.meta as Record<string, unknown>;
    if (meta.app !== undefined && meta.app !== "koordinate") {
      return null;
    }
    const data = obj.data as Record<string, unknown>;
    const keys = filtrerKjenteNøkler(data);
    if (keys.length === 0) return null;
    return { data, keys, format: "envelope" };
  }

  const keys = filtrerKjenteNøkler(obj);
  if (keys.length === 0) return null;

  const data: Record<string, unknown> = {};
  for (const key of keys) {
    data[key] = obj[key];
  }
  return { data, keys, format: "legacy" };
}

export function tellBackupPoster(data: Record<string, unknown>): BackupEntryStats {
  let poster = 0;
  for (const val of Object.values(data)) {
    if (Array.isArray(val)) poster += val.length;
    else if (val && typeof val === "object") poster += 1;
  }
  return { nøkler: Object.keys(data).length, poster };
}

export function triggerBackupDownload(backup: KoordinateBackupFile): void {
  const json = serializeBackupForDownload(backup);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupDownloadFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
