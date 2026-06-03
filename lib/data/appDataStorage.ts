import { reportSkySave } from "@/lib/data/skySaveNotify";
import { isKeyDirty, markKeyClean } from "@/lib/data/dirtyKeys";
import {
  forklaringBlokkering,
  grunnTilUploadBlokkering,
  type SkyRowSnapshot,
  type UploadBlockReason,
} from "@/lib/data/skyUploadGuard";
import { reportSkySyncNotice } from "@/lib/data/skySyncNotify";
import { getKeyMeta, mergeSyncMeta, setKeyMeta } from "@/lib/data/syncMeta";
import {
  fetchAllAppDataFromSkyAction,
  importAppDataBatchAction,
  loadAppDataFromSkyAction,
  saveAppDataToSkyAction,
} from "@/app/actions/skyData";
import { APP_DATA_KEYS, type AppDataKey } from "@/lib/data/storageKeys";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type SaveAppDataResult = {
  savedToSky: boolean;
  error?: string;
  conflict?: boolean;
};

function feilmelding(error: string): string {
  if (error === "not_authenticated") return "Ikke innlogget";
  if (error === "forbidden") return "Mangler rettigheter (admin/planlegger)";
  return error;
}

export type SkySyncResult = {
  updated: number;
  missing: string[];
  ansatteCount?: number;
  error?: string;
  uploaded?: boolean;
  skippedDirty?: string[];
};

export type SkySyncOptions = {
  /** Overskriv også nøkler med ulagrede lokale endringer (krever eksplisitt bekreftelse). */
  force?: boolean;
  removeMissing?: boolean;
};

export type UploadToSkyResult = {
  imported: number;
  skipped: string[];
  blocked: { key: string; reason: UploadBlockReason }[];
  error?: string;
};

function lesLocal(key: string): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function skrivLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / privat modus
  }
}

function erAppDataKey(key: string): key is AppDataKey {
  return (APP_DATA_KEYS as readonly string[]).includes(key);
}

function dispatchDataSynced(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("koordinate:dataSynced"));
}

/** Hent alt fra sky og oppdater localStorage + sync-meta. Respekterer ulagrede lokale endringer. */
export async function syncLocalCacheFromSky(
  options: SkySyncOptions = {},
): Promise<SkySyncResult> {
  const { force = false, removeMissing = false } = options;

  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { updated: 0, missing: [...APP_DATA_KEYS] };
  }

  const { rows, error } = await fetchAllAppDataFromSkyAction();
  if (error) {
    return { updated: 0, missing: [...APP_DATA_KEYS], error };
  }

  const rowMap = new Map(rows.map((row) => [row.key, row] as const));
  let updated = 0;
  const missing: string[] = [];
  const skippedDirty: string[] = [];
  const metaBatch: Record<string, string> = {};

  for (const key of APP_DATA_KEYS) {
    if (!force && isKeyDirty(key)) {
      skippedDirty.push(key);
      continue;
    }

    const row = rowMap.get(key);
    if (row) {
      skrivLocal(key, row.value);
      metaBatch[key] = row.updatedAt;
      markKeyClean(key);
      updated++;
    } else if (removeMissing) {
      window.localStorage.removeItem(key);
      missing.push(key);
    } else {
      missing.push(key);
    }
  }

  mergeSyncMeta(metaBatch);

  if (skippedDirty.length > 0) {
    reportSkySyncNotice({ type: "skipped_dirty", keys: skippedDirty });
  }

  let ansatteCount: number | undefined;
  const ansatte = rowMap.get("bemanning.ansatte.v2")?.value;
  if (Array.isArray(ansatte)) {
    ansatteCount = ansatte.length;
  }

  return { updated, missing, ansatteCount, skippedDirty };
}

/**
 * Hent endringer fra sky siden sist synk.
 * Hopper over nøkler med ulagrede lokale endringer (dirty).
 */
export async function pullRemoteChanges(): Promise<SkySyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { updated: 0, missing: [...APP_DATA_KEYS] };
  }

  const { rows, error } = await fetchAllAppDataFromSkyAction();
  if (error) {
    return { updated: 0, missing: [...APP_DATA_KEYS], error };
  }

  let updated = 0;
  const skippedDirty: string[] = [];
  const applied: string[] = [];

  for (const row of rows) {
    if (!erAppDataKey(row.key)) continue;

    const localAt = getKeyMeta(row.key);
    if (localAt && localAt >= row.updatedAt) continue;

    if (isKeyDirty(row.key)) {
      skippedDirty.push(row.key);
      continue;
    }

    skrivLocal(row.key, row.value);
    setKeyMeta(row.key, row.updatedAt);
    updated++;
    applied.push(row.key);
  }

  if (updated > 0) {
    reportSkySyncNotice({ type: "applied", keys: applied });
    dispatchDataSynced();
  }
  if (skippedDirty.length > 0) {
    reportSkySyncNotice({ type: "skipped_dirty", keys: skippedDirty });
  }

  return { updated, missing: [], skippedDirty };
}

/**
 * Les data etter innlogging: cache er fylt fra sky via syncOnLogin.
 * Uten innlogging: kun localStorage.
 */
export async function loadAppData(key: string, innlogget = false): Promise<unknown | null> {
  if (!innlogget || !isSupabaseConfigured()) {
    return lesLocal(key);
  }

  const cached = lesLocal(key);
  if (cached !== null) {
    return cached;
  }

  const { data, updatedAt, error } = await loadAppDataFromSkyAction(key);

  if (error === "not_authenticated") {
    return null;
  }

  if (error) {
    console.warn("[app_data] load feilet:", key, error);
    return null;
  }

  if (data !== undefined && data !== null) {
    skrivLocal(key, data);
    if (updatedAt) setKeyMeta(key, updatedAt);
    return data;
  }

  return null;
}

/** Lagre data: sky først ved redigering, deretter lokal cache + sync-meta. */
export async function saveAppData(
  key: string,
  value: unknown,
  canEdit: boolean,
): Promise<SaveAppDataResult> {
  if (canEdit && isSupabaseConfigured()) {
    const villeTømme =
      (Array.isArray(value) && value.length === 0) ||
      (value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "slots" in value &&
        Array.isArray((value as { slots?: unknown }).slots) &&
        (value as { slots: unknown[] }).slots.length === 0);
    if (villeTømme) {
      const { data: sky, updatedAt } = await loadAppDataFromSkyAction(key);
      const skyHarInnhold =
        (Array.isArray(sky) && sky.length > 0) ||
        (sky &&
          typeof sky === "object" &&
          "slots" in sky &&
          Array.isArray((sky as { slots?: unknown }).slots) &&
          (sky as { slots: unknown[] }).slots.length > 0);
      if (skyHarInnhold) {
        console.warn("[app_data] Blokkerte lagring av tom data over sky-innhold:", key);
        if (updatedAt) setKeyMeta(key, updatedAt);
        return { savedToSky: false, error: "Tom data ble ikke lagret (sky har innhold)" };
      }
    }
  }

  if (!isSupabaseConfigured()) {
    skrivLocal(key, value);
    const result = { savedToSky: false, error: "Supabase er ikke konfigurert" };
    reportSkySave({ key, ...result });
    return result;
  }

  if (!canEdit) {
    return { savedToSky: false };
  }

  skrivLocal(key, value);

  const expectedUpdatedAt = getKeyMeta(key) ?? null;
  const { error, updatedAt, conflict } = await saveAppDataToSkyAction(key, value, {
    expectedUpdatedAt,
  });

  if (error) {
    const msg = feilmelding(error);
    console.error("[app_data] save feilet:", key, msg);
    const result = { savedToSky: false, error: msg, conflict };
    reportSkySave({ key, ...result });
    if (conflict) {
      reportSkySyncNotice({ type: "conflict", key });
    }
    return result;
  }

  if (updatedAt) setKeyMeta(key, updatedAt);
  markKeyClean(key);

  const result = { savedToSky: true };
  reportSkySave({ key, ...result });
  return result;
}

function lesLocalPayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of APP_DATA_KEYS) {
    const local = lesLocal(key);
    if (local !== null) payload[key] = local;
  }
  return payload;
}

/** Last opp localStorage til Supabase — hopper over nøkler som ville overskrive nyere sky-data. */
export async function uploadLocalStorageToSky(): Promise<UploadToSkyResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { imported: 0, skipped: [], blocked: [], error: "Supabase er ikke konfigurert" };
  }

  const { rows, error } = await fetchAllAppDataFromSkyAction();
  if (error) {
    return { imported: 0, skipped: [], blocked: [], error };
  }

  const remoteByKey = new Map<string, SkyRowSnapshot>(
    rows.map((row) => [row.key, { key: row.key, value: row.value, updatedAt: row.updatedAt }]),
  );

  const payload: Record<string, unknown> = {};
  const blocked: { key: string; reason: UploadBlockReason }[] = [];
  const skipped: string[] = [];

  for (const key of APP_DATA_KEYS) {
    const local = lesLocal(key);
    if (local === null) continue;

    if (isKeyDirty(key)) {
      blocked.push({ key, reason: "ulagrede_lokale_endringer" });
      continue;
    }

    const remote = remoteByKey.get(key);
    const blockReason = grunnTilUploadBlokkering(key, local, remote, getKeyMeta(key));
    if (blockReason) {
      blocked.push({ key, reason: blockReason });
      continue;
    }

    payload[key] = local;
  }

  if (Object.keys(payload).length === 0) {
    const forklaring =
      blocked.length > 0
        ? blocked
            .map((b) => `${b.key.replace("bemanning.", "")} (${forklaringBlokkering(b.reason)})`)
            .join(", ")
        : "ingen data";
    return {
      imported: 0,
      skipped,
      blocked,
      error: `Ingen nøkler trygt å laste opp: ${forklaring}`,
    };
  }

  const result = await importAppDataBatchAction(payload);
  if (result.skipped) {
    for (const key of result.skipped) {
      if (!blocked.some((b) => b.key === key)) {
        skipped.push(key);
      }
    }
  }

  if (!result.error) {
    await syncLocalCacheFromSky({ force: false });
    dispatchDataSynced();
  }

  return {
    imported: result.imported,
    skipped,
    blocked,
    error: result.error,
  };
}

/**
 * Etter innlogging: Supabase er master. Sky-data overskriver lokal cache.
 * Tom sky auto-lastes IKKE opp fra nettleser (unngår feil master-kilde).
 */
export async function syncOnLogin(): Promise<SkySyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { updated: 0, missing: [...APP_DATA_KEYS] };
  }

  const { rows, error } = await fetchAllAppDataFromSkyAction();
  if (error && error !== "not_authenticated") {
    return { updated: 0, missing: [...APP_DATA_KEYS], error };
  }

  if (rows.length > 0) {
    return syncLocalCacheFromSky({ force: false });
  }

  return { updated: 0, missing: [...APP_DATA_KEYS] };
}
