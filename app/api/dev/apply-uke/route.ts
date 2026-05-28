/**
 * Dev/CI: legg inn uke-patch med service role.
 * POST /api/dev/apply-uke?uke=2
 */
import { applyUkeToMasterplan, UKE1_MASTERPLAN_PATCH, UKE2_MASTERPLAN_PATCH } from "@/lib/imported/applyUkeMasterplan";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const MASTERPLAN_KEY = "bemanning.masterplan.v1";

const PATCHES = {
  1: UKE1_MASTERPLAN_PATCH,
  2: UKE2_MASTERPLAN_PATCH,
} as const;

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY mangler i .env.local" },
      { status: 503 },
    );
  }

  const ukeParam = new URL(request.url).searchParams.get("uke");
  const uke = Number(ukeParam ?? 1) as 1 | 2;
  const patch = PATCHES[uke];
  if (!patch) {
    return NextResponse.json({ error: "Uke må være 1 eller 2" }, { status: 400 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: row, error: loadError }, { data: ansattRow, error: ansattError }] =
    await Promise.all([
      supabase.from("app_data").select("value").eq("key", MASTERPLAN_KEY).maybeSingle(),
      supabase.from("app_data").select("value").eq("key", "bemanning.ansatte.v2").maybeSingle(),
    ]);

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }
  if (ansattError) {
    return NextResponse.json({ error: ansattError.message }, { status: 500 });
  }

  const ansattListe = Array.isArray(ansattRow?.value) ? ansattRow.value : [];
  const ansattById = new Map(ansattListe.map((a) => [a.id, a]));

  const { plan, updated } = applyUkeToMasterplan(row?.value ?? null, patch, ansattById);

  const { error: saveError } = await supabase.from("app_data").upsert({
    key: MASTERPLAN_KEY,
    value: plan,
    updated_at: new Date().toISOString(),
    updated_by: null,
  });

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, uke, updated });
}
