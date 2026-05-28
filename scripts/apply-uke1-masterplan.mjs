/**
 * Genererer patch for uke 1 masterplan fra analyse-rapport.
 * Kjør: node scripts/apply-uke1-masterplan.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const DAG_NUM = { Man: 1, Tir: 2, Ons: 3, Tor: 4, Fre: 5, Lør: 6, Søn: 7 };

const rapportPath = path.join(ROOT, "lib/imported/uke1-analyse-rapport.json");
const outPath = path.join(ROOT, "lib/imported/uke1-masterplan-patch.json");

if (!fs.existsSync(rapportPath)) {
  console.error("Mangler analyse-rapport. Kjør først: node scripts/analyser-uke1-masterplan.mjs");
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
    uke: 1,
    antallOppdateringer: slotUpdates.length,
    medSjåfør: slotUpdates.filter((s) => s.standardSjåførAnsattId).length,
    utenSjåfør: slotUpdates.filter((s) => s.clearSjåfør).length,
  },
  uke: 1,
  slotUpdates,
};

fs.writeFileSync(outPath, JSON.stringify(patch, null, 2), "utf8");
console.log("Skrev patch:", outPath);
console.log("Oppdateringer:", slotUpdates.length);
console.log("  Med sjåfør:", patch.meta.medSjåfør);
console.log("  Uten sjåfør (Bring/TF/GDF):", patch.meta.utenSjåfør);
