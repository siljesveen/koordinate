"use server";

import { canEditData, type AppRole, type UserProfile } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

async function hentProfil(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string | null,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      id: userId,
      email,
      display_name: null,
      role: "visning",
    };
  }

  return {
    id: data.id,
    email: data.email,
    display_name: data.display_name,
    role: data.role as AppRole,
  };
}

export async function testSkyTilkoblingAction(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase er ikke konfigurert" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Ikke innlogget" };
  }

  const { error } = await supabase.from("app_data").select("key").limit(1);
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function fetchProfileAction(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return hentProfil(supabase, user.id, user.email ?? null);
}

export async function loadAppDataFromSkyAction(
  key: string,
): Promise<{ data: unknown | null; updatedAt?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { data: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "not_authenticated" };
  }

  const { data, error } = await supabase
    .from("app_data")
    .select("value, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data?.value ?? null, updatedAt: data?.updated_at ?? undefined };
}

export async function saveAppDataToSkyAction(
  key: string,
  value: unknown,
  options?: { expectedUpdatedAt?: string | null },
): Promise<{ error?: string; updatedAt?: string; conflict?: boolean }> {
  if (!isSupabaseConfigured()) {
    return {};
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "not_authenticated" };
  }

  const profile = await hentProfil(supabase, user.id, user.email ?? null);
  if (!canEditData(profile.role)) {
    return { error: "forbidden" };
  }

  if (options?.expectedUpdatedAt) {
    const { data: current } = await supabase
      .from("app_data")
      .select("updated_at")
      .eq("key", key)
      .maybeSingle();

    if (
      current?.updated_at &&
      current.updated_at !== options.expectedUpdatedAt
    ) {
      return {
        error: "Noen andre har lagret nyere data. Hent siste versjon fra sky.",
        conflict: true,
      };
    }
  }

  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from("app_data").upsert({
    key,
    value,
    updated_at: updatedAt,
    updated_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  return { updatedAt };
}

/** @deprecated Bruk loadAppDataFromSkyAction i stedet. */
export async function fetchAppDataRowAction(
  key: string,
): Promise<{ value: unknown | null; error?: string }> {
  console.warn(
    "[skyData] fetchAppDataRowAction er deprecated — bruk loadAppDataFromSkyAction",
  );
  if (!isSupabaseConfigured()) {
    return { value: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { value: null, error: "not_authenticated" };
  }

  const { data, error } = await supabase
    .from("app_data")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    return { value: null, error: error.message };
  }

  return { value: data?.value ?? null };
}

/** @deprecated Bruk saveAppDataToSkyAction i stedet. */
export async function upsertAppDataRowAction(
  key: string,
  value: unknown,
): Promise<{ error?: string }> {
  console.warn(
    "[skyData] upsertAppDataRowAction er deprecated — bruk saveAppDataToSkyAction",
  );
  if (!isSupabaseConfigured()) {
    return {};
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "not_authenticated" };
  }

  const profile = await hentProfil(supabase, user.id, user.email ?? null);
  if (!canEditData(profile.role)) {
    return { error: "forbidden" };
  }

  const { error } = await supabase.from("app_data").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function fetchSkyOverviewAction(): Promise<{
  rows: { key: string; summary: string }[];
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { rows: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { rows: [], error: "not_authenticated" };
  }

  const { data, error } = await supabase.from("app_data").select("key, value");

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows = (data ?? []).map((row) => {
    const value = row.value;
    let summary: string = typeof value;
    if (Array.isArray(value)) {
      summary = `${value.length} elementer`;
    } else if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (Array.isArray(obj.slots)) {
        summary = `${obj.slots.length} ruter/slots`;
      } else {
        summary = `${Object.keys(obj).length} felter`;
      }
    }
    return { key: row.key, summary };
  });

  return { rows };
}

export async function importAppDataBatchAction(
  payload: Record<string, unknown>,
): Promise<{ imported: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { imported: 0, error: "Supabase er ikke konfigurert" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { imported: 0, error: "not_authenticated" };
  }

  const profile = await hentProfil(supabase, user.id, user.email ?? null);
  if (!canEditData(profile.role)) {
    return { imported: 0, error: "Mangler rettigheter (trenger admin/planlegger)" };
  }

  let imported = 0;
  for (const [key, value] of Object.entries(payload)) {
    if (!key.startsWith("bemanning.")) continue;
    const { error } = await supabase.from("app_data").upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });
    if (!error) imported++;
  }

  return { imported };
}

export async function verifySkySaveAction(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase er ikke konfigurert" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Ikke innlogget" };
  }

  const profile = await hentProfil(supabase, user.id, user.email ?? null);
  if (!canEditData(profile.role)) {
    return { ok: false, error: "Mangler rettigheter (admin/planlegger)" };
  }

  const testKey = "bemanning._skySaveTest.v1";
  const testValue = { testedAt: new Date().toISOString(), ok: true };

  const { error: writeError } = await supabase.from("app_data").upsert({
    key: testKey,
    value: testValue,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (writeError) {
    return { ok: false, error: `Skriving feilet: ${writeError.message}` };
  }

  const { data, error: readError } = await supabase
    .from("app_data")
    .select("value")
    .eq("key", testKey)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: `Lesing feilet: ${readError.message}` };
  }

  if (!data?.value || typeof data.value !== "object") {
    return { ok: false, error: "Kunne ikke lese tilbake testdata fra Supabase" };
  }

  return { ok: true };
}

export async function fetchAllAppDataFromSkyAction(): Promise<{
  rows: { key: string; value: unknown; updatedAt: string }[];
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { rows: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { rows: [], error: "not_authenticated" };
  }

  const { data, error } = await supabase
    .from("app_data")
    .select("key, value, updated_at");

  if (error) {
    return { rows: [], error: error.message };
  }

  return {
    rows: (data ?? []).map((row) => ({
      key: row.key,
      value: row.value,
      updatedAt: row.updated_at as string,
    })),
  };
}

export async function applyUke1MasterplanAction(): Promise<{
  updated: number;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { updated: 0, error: "Supabase er ikke konfigurert" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { updated: 0, error: "Ikke innlogget" };
  }

  const profile = await hentProfil(supabase, user.id, user.email ?? null);
  if (!canEditData(profile.role)) {
    return { updated: 0, error: "Mangler rettigheter (admin/planlegger)" };
  }

  const { applyUke1ToMasterplan } = await import("@/lib/imported/applyUke1Masterplan");
  type Ansatt = import("@/lib/domain").Ansatt;

  const [{ data: row, error: loadError }, { data: ansattRow, error: ansattError }] =
    await Promise.all([
      supabase.from("app_data").select("value").eq("key", "bemanning.masterplan.v1").maybeSingle(),
      supabase.from("app_data").select("value").eq("key", "bemanning.ansatte.v2").maybeSingle(),
    ]);

  if (loadError) {
    return { updated: 0, error: loadError.message };
  }
  if (ansattError) {
    return { updated: 0, error: ansattError.message };
  }

  const ansattListe = Array.isArray(ansattRow?.value) ? (ansattRow.value as Ansatt[]) : [];
  const ansattById = new Map(ansattListe.map((a) => [a.id, a]));

  const { plan, updated } = applyUke1ToMasterplan(row?.value ?? null, ansattById);

  const { error: saveError } = await supabase.from("app_data").upsert({
    key: "bemanning.masterplan.v1",
    value: plan,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (saveError) {
    return { updated: 0, error: saveError.message };
  }

  return { updated };
}

export async function applyUke2MasterplanAction(): Promise<{
  updated: number;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { updated: 0, error: "Supabase er ikke konfigurert" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { updated: 0, error: "Ikke innlogget" };
  }

  const profile = await hentProfil(supabase, user.id, user.email ?? null);
  if (!canEditData(profile.role)) {
    return { updated: 0, error: "Mangler rettigheter (admin/planlegger)" };
  }

  const { applyUke2ToMasterplan } = await import("@/lib/imported/applyUkeMasterplan");
  type Ansatt = import("@/lib/domain").Ansatt;

  const [{ data: row, error: loadError }, { data: ansattRow, error: ansattError }] =
    await Promise.all([
      supabase.from("app_data").select("value").eq("key", "bemanning.masterplan.v1").maybeSingle(),
      supabase.from("app_data").select("value").eq("key", "bemanning.ansatte.v2").maybeSingle(),
    ]);

  if (loadError) {
    return { updated: 0, error: loadError.message };
  }
  if (ansattError) {
    return { updated: 0, error: ansattError.message };
  }

  const ansattListe = Array.isArray(ansattRow?.value) ? (ansattRow.value as Ansatt[]) : [];
  const ansattById = new Map(ansattListe.map((a) => [a.id, a]));

  const { plan, updated } = applyUke2ToMasterplan(row?.value ?? null, ansattById);

  const { error: saveError } = await supabase.from("app_data").upsert({
    key: "bemanning.masterplan.v1",
    value: plan,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (saveError) {
    return { updated: 0, error: saveError.message };
  }

  return { updated };
}
