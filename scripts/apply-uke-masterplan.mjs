/**
 * Genererer patch for masterplan fra analyse-rapport.
 * Kjør: node scripts/apply-uke-masterplan.mjs 2
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DAG_NUM } from "./lib/masterplanUkeImport.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const uke = Number(process.argv[2] ?? 1);
if (!(uke >= 1 && uke <= 4)) {
  console.error("Uke må være 1–4. Eksempel: node scripts/apply-uke-masterplan.mjs 2");
  process.exit(1);
}

const rapportPath = path.join(ROOT, `lib/imported/uke${uke}-analyse-rapport.json`);
const outPath = path.join(ROOT, `lib/imported/uke${uke}-masterplan-patch.json`);

if (!fs.existsSync(rapportPath)) {
  console.error(`Mangler analyse-rapport. Kjør først: node scripts/analyser-uke-masterplan.mjs ${uke}`);
  process.exit(1);
}

const rapport = JSON.parse(fs.readFileSync(rapportPath, "utf8"));
const slotUpdates = [];

for (const m of rapport.matcht ?? []) {
  const dag = DAG_NUM[m.dag];
  if (!dag) continue;
  slotUpdates.push({
    dag,
    skift: m.skift,
    rutekode: m.rutekode,
    startTid: m.startTid ?? undefined,
    standardSjåførAnsattId: m.ansattId,
    standardBilId: m.fastBilId ?? undefined,
    standardHengerId: m.fastHengerId ?? undefined,
  });
}

for (const h of rapport.hoppOver ?? []) {
  const dag = DAG_NUM[h.dag];
  if (!dag) continue;
  slotUpdates.push({
    dag,
    skift: h.skift,
    rutekode: h.rutekode,
    startTid: h.startTid ?? undefined,
    clearSjåfør: true,
  });
}

const patch = {
  meta: {
    generert: new Date().toISOString(),
    kilde: rapport.kilde,
    uke,
    antallOppdateringer: slotUpdates.length,
    medSjåfør: slotUpdates.filter((s) => s.standardSjåførAnsattId).length,
    utenSjåfør: slotUpdates.filter((s) => s.clearSjåfør).length,
  },
  uke,
  slotUpdates,
};

fs.writeFileSync(outPath, JSON.stringify(patch, null, 2), "utf8");
console.log("Skrev patch:", outPath);
console.log("Oppdateringer:", slotUpdates.length);
console.log("  Med sjåfør:", patch.meta.medSjåfør);
console.log("  Uten sjåfør (Bring/TF/GDF):", patch.meta.utenSjåfør);
