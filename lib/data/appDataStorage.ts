import { reportSkySave } from "@/lib/data/skySaveNotify";
import {
  fetchAllAppDataFromSkyAction,
  importAppDataBatchAction,
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

/** Hent alt fra sky og oppdater localStorage. */
export async function syncLocalCacheFromSky(removeMissing = true): Promise<SkySyncResult> {
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
 * Les data fra localStorage-cachen.
 *
 * Skyen leses i bulk én gang ved innlogging/last (`syncOnLogin` →
 * `syncLocalCacheFromSky`) og speiles til localStorage før `dataReady` settes.
 * Per-nøkkel-lesing går derfor mot cachen, slik at vi slipper et eget sky-kall
 * per store ved oppstart (det ga tidligere en treg, seriell kjede av ~12
 * server actions – hver med en egen `auth.getUser()`-validering).
 */
export async function loadAppData(key: string, innlogget = false): Promise<unknown | null> {
  // Cachen er fersk for både innlogget (speilet fra sky) og uinnlogget (kun
  // localStorage / Supabase ikke konfigurert), så lesing er likt i alle tilfeller.
  void innlogget;
  return lesLocal(key);
}

/** Lagre data: local cache + Supabase når innlogget og kan redigere. */
export async function saveAppData(
  key: string,
  value: unknown,
  canEdit: boolean,
): Promise<SaveAppDataResult> {
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
