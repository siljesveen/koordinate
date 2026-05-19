import { APP_DATA_KEYS, merkSyncedTilSupabase } from "@/lib/data/storageKeys";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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

/** Les data: Supabase når konfigurert og innlogget, ellers localStorage. */
export async function loadAppData(key: string): Promise<unknown | null> {
  if (!isSupabaseConfigured()) {
    return lesLocal(key);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return lesLocal(key);
  }

  const { data, error } = await supabase
    .from("app_data")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.warn("[app_data] load feilet:", key, error.message);
    return lesLocal(key);
  }

  if (data?.value !== undefined && data?.value !== null) {
    return data.value;
  }

  return lesLocal(key);
}

/** Lagre data: alltid local cache + Supabase når innlogget og kan redigere. */
export async function saveAppData(
  key: string,
  value: unknown,
  canEdit: boolean,
): Promise<void> {
  skrivLocal(key, value);

  if (!isSupabaseConfigured() || !canEdit) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("app_data").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (error) {
    console.warn("[app_data] save feilet:", key, error.message);
  }
}

/**
 * Første gang etter innlogging: last opp localStorage til Supabase
 * hvis skyen ikke har data for nøkkelen ennå.
 */
export async function migrateLocalStorageToSupabase(userId: string): Promise<void> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return;

  const supabase = createClient();

  await Promise.allSettled(
    APP_DATA_KEYS.map(async (key) => {
      const local = lesLocal(key);
      if (local === null) return;

      const { data: existing } = await supabase
        .from("app_data")
        .select("key")
        .eq("key", key)
        .maybeSingle();

      if (existing) return;

      const { error } = await supabase.from("app_data").upsert({
        key,
        value: local,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      });

      if (error) {
        console.warn("[app_data] migrering feilet:", key, error.message);
      }
    }),
  );

  merkSyncedTilSupabase();
}
