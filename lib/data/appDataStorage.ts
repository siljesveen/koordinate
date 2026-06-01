import { reportSkySave } from "@/lib/data/skySaveNotify";
import { isKeyDirty, markKeyClean } from "@/lib/data/dirtyKeys";
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

/** Hent alt fra sky og oppdater localStorage + sync-meta. */
export async function syncLocalCacheFromSky(removeMissing = false): Promise<SkySyncResult> {
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
  const metaBatch: Record<string, string> = {};

  for (const key of APP_DATA_KEYS) {
    const row = rowMap.get(key);
    if (row) {
      skrivLocal(key, row.value);
      metaBatch[key] = row.updatedAt;
      updated++;
    } else if (removeMissing) {
      window.localStorage.removeItem(key);
      missing.push(key);
    } else {
      missing.push(key);
    }
  }

  mergeSyncMeta(metaBatch);

  let ansatteCount: number | undefined;
  const ansatte = rowMap.get("bemanning.ansatte.v2")?.value;
  if (Array.isArray(ansatte)) {
    ansatteCount = ansatte.length;
  }

  return { updated, missing, ansatteCount };
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
    skrivLocal(key, value);
    const result = { savedToSky: false, error: "forbidden" };
    reportSkySave({ key, ...result, error: feilmelding("forbidden") });
    return result;
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

/** Last opp all localStorage til Supabase (nød-/synk-knapp). */
export async function uploadLocalStorageToSky(): Promise<{ imported: number; error?: string }> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { imported: 0, error: "Supabase er ikke konfigurert" };
  }
  const payload = lesLocalPayload();
  if (Object.keys(payload).length === 0) {
    return { imported: 0, error: "Ingen data i nettleseren å laste opp" };
  }
  const result = await importAppDataBatchAction(payload);
  if (!result.error) {
    await syncLocalCacheFromSky(false);
    dispatchDataSynced();
  }
  return result;
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
    return syncLocalCacheFromSky(false);
  }

  return { updated: 0, missing: [...APP_DATA_KEYS] };
}
