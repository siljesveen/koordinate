/**
 * Legg inn uke 1 i Supabase masterplan (krever SUPABASE_SERVICE_ROLE_KEY i .env.local).
 * Kjør: node scripts/legg-inn-uke1-masterplan.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MASTERPLAN_KEY = "bemanning.masterplan.v1";

const RINGNES_CYCLE = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib/imported/ringnes-cycle.json"), "utf8"),
);
const PATCH = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib/imported/uke1-masterplan-patch.json"), "utf8"),
);

function masterSlotId(uke, dag, skift, rutekode) {
  return `ms-${uke}-${dag}-${skift}-${encodeURIComponent(rutekode)}`;
}

function baselineMasterplan() {
  const slotMap = new Map();
  for (const [ukeStr, dager] of Object.entries(RINGNES_CYCLE.cycle)) {
    const uke = Number(ukeStr);
    if (uke < 1 || uke > 4) continue;
    for (const [dagStr, skiftMap] of Object.entries(dager)) {
      const dag = Number(dagStr);
      if (dag < 1 || dag > 7) continue;
      for (const [skiftStr, skiftPlan] of Object.entries(skiftMap)) {
        if (skiftStr !== "Dag" && skiftStr !== "Kveld") continue;
        if (!skiftPlan?.ruter) continue;
        for (const rute of skiftPlan.ruter) {
          const rutekode = rute.rute.trim();
          if (!rutekode) continue;
          const id = masterSlotId(uke, dag, skiftStr, rutekode);
          if (slotMap.has(id)) continue;
          slotMap.set(id, {
            id,
            uke,
            dag,
            skift: skiftStr,
            rutekode,
            rutenavn: rute.rutenavn?.trim() || undefined,
          });
        }
      }
    }
  }
  return { syklusLengde: 4, slots: [...slotMap.values()] };
}

function normalizeMasterplan(data) {
  if (!data || typeof data !== "object") return null;
  if (!Array.isArray(data.slots) || data.slots.length === 0) return null;
  return {
    syklusLengde: typeof data.syklusLengde === "number" ? data.syklusLengde : 4,
    slots: data.slots,
    koblingsgrupper: data.koblingsgrupper,
  };
}

function mergeUke1(plan) {
  const updateMap = new Map(
    PATCH.slotUpdates.map((u) => [`${u.dag}|${u.skift}|${u.rutekode}`, u]),
  );
  let updated = 0;
  const slots = plan.slots.map((slot) => {
    if (slot.uke !== 1) return slot;
    const upd = updateMap.get(`${slot.dag}|${slot.skift}|${slot.rutekode}`);
    if (!upd) return slot;
    updated++;
    if (upd.clearSjåfør) {
      return {
        ...slot,
        startTid: upd.startTid ?? slot.startTid,
        standardSjåførAnsattId: undefined,
        standardBilId: undefined,
        standardHengerId: undefined,
      };
    }
    return {
      ...slot,
      startTid: upd.startTid ?? slot.startTid,
      standardSjåførAnsattId: upd.standardSjåførAnsattId,
      standardBilId: upd.standardBilId,
      standardHengerId: upd.standardHengerId,
    };
  });
  return { plan: { ...plan, slots }, updated };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
      "Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local",
    );
    console.error(
      "Alternativ: åpne /masterplan som admin og klikk «Legg inn uke 1 fra plan».",
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row, error: loadError } = await supabase
    .from("app_data")
    .select("value")
    .eq("key", MASTERPLAN_KEY)
    .maybeSingle();

  if (loadError) {
    console.error("Kunne ikke lese masterplan:", loadError.message);
    process.exit(1);
  }

  const base = normalizeMasterplan(row?.value) ?? baselineMasterplan();
  const { plan, updated } = mergeUke1(base);

  const { error: saveError } = await supabase.from("app_data").upsert({
    key: MASTERPLAN_KEY,
    value: plan,
    updated_at: new Date().toISOString(),
    updated_by: null,
  });

  if (saveError) {
    console.error("Kunne ikke lagre masterplan:", saveError.message);
    process.exit(1);
  }

  const u1 = plan.slots.filter((s) => s.uke === 1);
  console.log("Uke 1 lagt inn i Supabase.");
  console.log("Oppdaterte slots:", updated);
  console.log("Uke 1 med sjåfør:", u1.filter((s) => s.standardSjåførAnsattId).length);
  console.log("Uke 1 med starttid:", u1.filter((s) => s.startTid).length);
  console.log("Koblingsgrupper beholdt:", Object.keys(plan.koblingsgrupper ?? {}).length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
