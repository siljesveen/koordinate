import { applyUke1ToMasterplan } from "@/lib/imported/applyUke1Masterplan";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const MASTERPLAN_KEY = "bemanning.masterplan.v1";

/** Dev/CI: legg inn uke 1 med service role (ingen nettleser-innlogging). */
export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY mangler i .env.local" },
      { status: 503 },
    );
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

  const { plan, updated } = applyUke1ToMasterplan(row?.value ?? null, ansattById);

  const { error: saveError } = await supabase.from("app_data").upsert({
    key: MASTERPLAN_KEY,
    value: plan,
    updated_at: new Date().toISOString(),
    updated_by: null,
  });

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated });
}
