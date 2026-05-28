/**
 * Analyse: Ringnes uke-plan vs ansattliste vs masterplan-slots.
 * Kjør: node scripts/analyser-uke-masterplan.mjs 2
 *       node scripts/analyser-uke-masterplan.mjs 2 "C:\path\fil.xlsx"
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  DEFAULT_XLSX,
  analyserUkePlan,
  loadAnsatte,
  rapportTilJson,
} from "./lib/masterplanUkeImport.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const uke = Number(process.argv[2] ?? 1);
if (!(uke >= 1 && uke <= 4)) {
  console.error("Uke må være 1–4. Eksempel: node scripts/analyser-uke-masterplan.mjs 2");
  process.exit(1);
}

const XLSX_PATH = process.argv[3] ?? DEFAULT_XLSX[uke];
if (!XLSX_PATH) {
  console.error(`Mangler standard Excel-sti for uke ${uke}. Oppgi filsti som argument 3.`);
  process.exit(1);
}

const ansatte = loadAnsatte(path.join(ROOT, "lib/imported/ansatte-bemanning-2026.ts"));
const RINGNES_CYCLE = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib/imported/ringnes-cycle.json"), "utf8"),
);

const resultat = analyserUkePlan({ uke, xlsxPath: XLSX_PATH, ansatte, ringnesCycle: RINGNES_CYCLE });

console.log(`=== UKE ${uke} MASTERPLAN — ANALYSE (KUN RAPPORT) ===\n`);
console.log(`Kilde: ${XLSX_PATH}`);
console.log(`Plan-rader (Excel uke ${uke}): ${resultat.planRader.length}`);
console.log(`Masterplan-slots uke ${uke}: ${resultat.masterSlots.length}`);
console.log(`Matchede sjåfører: ${resultat.matcht.length}`);
console.log(`Hoppet over (Bring/TF/GDF/tom): ${resultat.hoppOver.length}`);
console.log(`Ukjente navn: ${resultat.ukjente.length}`);
console.log(`Tvetydige navn: ${resultat.tvetydige.length}`);
console.log(`Avvik vs baseline sjåførtekst: ${resultat.avvikSjåfør.length}`);
console.log(`Ruter uten slot i baseline: ${resultat.manglerSlot.length}`);

if (resultat.ukjente.length) {
  console.log("\n--- UKJENTE NAVN ---");
  const unike = [...new Set(resultat.ukjente.map((u) => u.pdfSjåfør))].sort();
  for (const n of unike) {
    const ant = resultat.ukjente.filter((u) => u.pdfSjåfør === n).length;
    console.log(`  ${n} (${ant} ruter)`);
  }
}

if (resultat.tvetydige.length) {
  console.log("\n--- TVETYDIGE (trenger din bekreftelse) ---");
  const seen = new Set();
  for (const t of resultat.tvetydige) {
    if (seen.has(t.pdfNavn)) continue;
    seen.add(t.pdfNavn);
    console.log(`  "${t.pdfNavn}" → ${t.kandidater.map((k) => k.navn).join(" | ")}`);
  }
}

if (resultat.avvikSjåfør.length) {
  console.log("\n--- AVVIK MOT BASELINE (første 15) ---");
  for (const a of resultat.avvikSjåfør.slice(0, 15)) {
    console.log(
      `  ${a.dag} ${a.skift} ${a.rutekode}: baseline «${a.planSjåfør}» → plan «${a.pdfSjåfør}» (${a.foreslåttAnsatt})`,
    );
  }
  if (resultat.avvikSjåfør.length > 15) {
    console.log(`  ... og ${resultat.avvikSjåfør.length - 15} til`);
  }
}

const outPath = path.join(ROOT, `lib/imported/uke${uke}-analyse-rapport.json`);
fs.writeFileSync(
  outPath,
  JSON.stringify(rapportTilJson({ uke, xlsxPath: XLSX_PATH, resultat }), null, 2),
);
console.log(`\nDetaljrapport skrevet: ${outPath}`);
