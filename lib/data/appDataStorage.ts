import { reportSkySave } from "@/lib/data/skySaveNotify";
import {
  fetchAllAppDataFromSkyAction,
  importAppDataBatchAction,
  loadAppDataFromSkyAction,
  saveAppDataToSkyAction,
} from "@/app/actions/skyData";
import { APP_DATA_KEYS } from "@/lib/data/storageKeys";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type SaveAppDataResult = {
  savedToSky: boolean;
  error?: string;
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

/** Hent alt fra sky og oppdater localStorage. Sletter aldri lokale nøkler som mangler i sky. */
export async function syncLocalCacheFromSky(removeMissing = false): Promise<SkySyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { updated: 0, missing: [...APP_DATA_KEYS] };
  }

  const { rows, error } = await fetchAllAppDataFromSkyAction();
  if (error) {
    return { updated: 0, missing: [...APP_DATA_KEYS], error };
  }

  const rowMap = new Map(rows.map((row) => [row.key, row.value]));
  let updated = 0;
  const missing: string[] = [];

  for (const key of APP_DATA_KEYS) {
    if (rowMap.has(key)) {
      skrivLocal(key, rowMap.get(key));
      updated++;
    } else if (removeMissing) {
      window.localStorage.removeItem(key);
      missing.push(key);
    } else {
      missing.push(key);
    }
  }

  let ansatteCount: number | undefined;
  const ansatte = rowMap.get("bemanning.ansatte.v2");
  if (Array.isArray(ansatte)) {
    ansatteCount = ansatte.length;
  }

  return { updated, missing, ansatteCount };
}

/**
 * Les data: localStorage-cachen først (raskt etter batch-synk), sky som fallback
 * når nøkkelen mangler lokalt (ny nettleser, treg synk, race ved oppstart).
 */
export async function loadAppData(key: string, innlogget = false): Promise<unknown | null> {
  const cached = lesLocal(key);
  if (cached !== null) {
    return cached;
  }

  if (!isSupabaseConfigured() || !innlogget) {
    return null;
  }

  const { data, error } = await loadAppDataFromSkyAction(key);

  if (error === "not_authenticated") {
    return null;
  }

  if (error) {
    console.warn("[app_data] load feilet:", key, error);
    return null;
  }

  if (data !== undefined && data !== null) {
    skrivLocal(key, data);
    return data;
  }

  return null;
}

/** Lagre data: local cache + Supabase når innlogget og kan redigere. */
export async function saveAppData(
  key: string,
  value: unknown,
  canEdit: boolean,
): Promise<SaveAppDataResult> {
  // Hindre at tomme lister/objekter overskriver eksisterende sky-data ved feil lasting.
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
      const { data: sky } = await loadAppDataFromSkyAction(key);
      const skyHarInnhold =
        (Array.isArray(sky) && sky.length > 0) ||
        (sky &&
          typeof sky === "object" &&
          "slots" in sky &&
          Array.isArray((sky as { slots?: unknown }).slots) &&
          (sky as { slots: unknown[] }).slots.length > 0);
      if (skyHarInnhold) {
        console.warn("[app_data] Blokkerte lagring av tom data over sky-innhold:", key);
        return { savedToSky: false, error: "Tom data ble ikke lagret (sky har innhold)" };
      }
    }
  }

  skrivLocal(key, value);

  if (!isSupabaseConfigured()) {
    const result = { savedToSky: false, error: "Supabase er ikke konfigurert" };
    reportSkySave({ key, ...result });
    return result;
  }

  if (!canEdit) {
    const result = { savedToSky: false, error: "forbidden" };
    reportSkySave({ key, ...result, error: feilmelding("forbidden") });
    return result;
  }

  const { error } = await saveAppDataToSkyAction(key, value);

  if (error) {
    const msg = feilmelding(error);
    console.error("[app_data] save feilet:", key, msg);
    const result = { savedToSky: false, error: msg };
    reportSkySave({ key, ...result });
    return result;
  }

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
  return importAppDataBatchAction(payload);
}

/**
 * Etter innlogging: sky er sannheten. Hvis sky er tom men nettleser har data,
 * lastes det opp automatisk (redning av Vercel-data som aldri nådde sky).
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

  const payload = lesLocalPayload();
  if (Object.keys(payload).length === 0) {
    return { updated: 0, missing: [...APP_DATA_KEYS] };
  }

  const upload = await importAppDataBatchAction(payload);
  if (upload.error) {
    return { updated: 0, missing: [...APP_DATA_KEYS], error: upload.error };
  }

  let ansatteCount: number | undefined;
  const ansatte = payload["bemanning.ansatte.v2"];
  if (Array.isArray(ansatte)) {
    ansatteCount = ansatte.length;
  }

  return {
    updated: upload.imported,
    missing: APP_DATA_KEYS.filter((k) => !(k in payload)),
    ansatteCount,
    uploaded: true,
  };
}
