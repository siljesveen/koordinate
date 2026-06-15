/**
 * Verifiserer kobling mellom ansattliste og bemanning_masterdata.json (fravær-import).
 * Kjør: node scripts/verifiser-fravaer-kobling.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadAnsatte() {
  const ts = fs.readFileSync(
    path.join(ROOT, "lib/imported/ansatte-bemanning-2026.ts"),
    "utf8",
  );
  const m = ts.match(/=\s*(\[[\s\S]*?\]);/);
  const base = JSON.parse(m[1]);

  const tillegg = [
    { id: "a-jan-morten", fornavn: "Jan", etternavn: "Morten", aktiv: true, selskap: "TF" },
    { id: "a-linus-hagen", fornavn: "Linus", etternavn: "Hagen", aktiv: true, selskap: "Asko" },
    { id: "a-jama-mohammed", fornavn: "Jama", etternavn: "Mohammed", aktiv: true, selskap: "Asko" },
  ];

  const byId = new Map(base.map((a) => [a.id, a]));
  for (const t of tillegg) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return [...byId.values()];
}

function normalizeNavn(raw) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Ǿø]/gi, "o")
    .replace(/[åä]/gi, "a")
    .replace(/[æ]/gi, "ae")
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseExcelNavn(raw) {
  const trimmed = raw.trim();
  if (!trimmed.includes(",")) return null;
  const [etternavn, ...rest] = trimmed.split(",").map((s) => s.trim());
  const fornavn = rest.join(" ").trim();
  if (!etternavn || !fornavn) return null;
  return { fornavn, etternavn };
}

function parseFrittNavn(raw) {
  const parts = raw
    .trim()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (parts.length < 2) return null;
  return { etternavn: parts[parts.length - 1], fornavn: parts.slice(0, -1).join(" ") };
}

function parseDriverNavn(raw) {
  return parseExcelNavn(raw) ?? parseFrittNavn(raw);
}

function ansattNavnNøkkel(fornavn, etternavn) {
  return normalizeNavn(`${etternavn}, ${fornavn}`);
}

function buildAnsattNavnIndex(ansatte) {
  const index = new Map();
  const navn = new Map();
  const kollisjoner = [];
  for (const ansatt of ansatte) {
    const nøkkel = ansattNavnNøkkel(ansatt.fornavn, ansatt.etternavn);
    const visning = `${ansatt.fornavn} ${ansatt.etternavn}`.trim();
    if (index.has(nøkkel)) {
      kollisjoner.push({
        nøkkel,
        id1: index.get(nøkkel),
        id2: ansatt.id,
        navn1: navn.get(nøkkel),
        navn2: visning,
      });
    }
    index.set(nøkkel, ansatt.id);
    navn.set(nøkkel, visning);
  }
  return { index, kollisjoner };
}

function matchAnsattIdForDriverNavn(raw, ansatte) {
  const parsed = parseDriverNavn(raw);
  if (!parsed) return null;
  const { index } = buildAnsattNavnIndex(ansatte);
  const eksakt = index.get(ansattNavnNøkkel(parsed.fornavn, parsed.etternavn));
  if (eksakt) return eksakt;

  const etternavnNøkkel = normalizeNavn(parsed.etternavn);
  const fornavnNøkkel = normalizeNavn(parsed.fornavn);
  const kandidater = ansatte.filter((a) => {
    if (normalizeNavn(a.etternavn) !== etternavnNøkkel) return false;
    const ansattFornavn = normalizeNavn(a.fornavn);
    return (
      ansattFornavn.startsWith(fornavnNøkkel) ||
      fornavnNøkkel.startsWith(ansattFornavn.split(" ")[0] ?? "")
    );
  });
  if (kandidater.length === 1) return kandidater[0].id;
  return null;
}

function driverTilAnsattNavn(driverRaw, ansatt) {
  return ansattNavnNøkkel(ansatt.fornavn, ansatt.etternavn);
}

const ansatte = loadAnsatte();
const aktive = ansatte.filter((a) => a.aktiv !== false);
const masterdata = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/bemanning_masterdata.json"), "utf8"),
);
const drivers = Object.values(masterdata.drivers ?? {});

const { kollisjoner } = buildAnsattNavnIndex(ansatte);

// Plan → ansatt (import-retning)
const planUtenTreff = [];
const planMedTreff = [];
const planFeilKobling = [];

for (const driver of drivers) {
  const id = matchAnsattIdForDriverNavn(driver.name, ansatte);
  const absenceCount = Object.keys(driver.absence ?? {}).length;
  if (!id) {
    planUtenTreff.push({ planNavn: driver.name, absenceCount });
    continue;
  }
  const ansatt = ansatte.find((a) => a.id === id);
  planMedTreff.push({
    planNavn: driver.name,
    ansattId: id,
    ansattNavn: `${ansatt.fornavn} ${ansatt.etternavn}`,
    absenceCount,
  });
}

// Ansatt → plan (finnes det en plan-rad som matcher?)
const ansattUtenPlanRad = [];
const ansattMedPlanRad = [];

for (const ansatt of aktive) {
  const matchendeDrivere = drivers.filter(
    (d) => matchAnsattIdForDriverNavn(d.name, ansatte) === ansatt.id,
  );
  if (matchendeDrivere.length === 0) {
    ansattUtenPlanRad.push({
      id: ansatt.id,
      navn: `${ansatt.fornavn} ${ansatt.etternavn}`,
      selskap: ansatt.selskap ?? "Asko",
    });
  } else {
    ansattMedPlanRad.push({
      id: ansatt.id,
      navn: `${ansatt.fornavn} ${ansatt.etternavn}`,
      planNavn: matchendeDrivere.map((d) => d.name),
      absenceCount: matchendeDrivere.reduce(
        (s, d) => s + Object.keys(d.absence ?? {}).length,
        0,
      ),
    });
  }
}

// Flere plan-rader → samme ansatt?
const flerePlanRader = ansattMedPlanRad.filter((a) => a.planNavn.length > 1);

console.log("=== Fravær-kobling: ansattliste vs bemanning_masterdata.json ===\n");
console.log(`Generert: ${masterdata.generated ?? "ukjent"}`);
console.log(`Ansatte totalt: ${ansatte.length} (aktive: ${aktive.length})`);
console.log(`Plan-rader (drivers): ${drivers.length}`);
console.log(`Navneduplikater i ansattliste: ${kollisjoner.length}`);
console.log("");

console.log(`Plan → ansatt: ${planMedTreff.length} treff, ${planUtenTreff.length} uten treff`);
console.log(`Ansatt → plan: ${ansattMedPlanRad.length} med rad, ${ansattUtenPlanRad.length} uten rad`);
console.log("");

if (kollisjoner.length) {
  console.log("⚠ NAVNEDUPLIKATER I ANSATTELISTE:");
  for (const k of kollisjoner) {
    console.log(`  ${k.navn1} (${k.id1}) vs ${k.navn2} (${k.id2})`);
  }
  console.log("");
}

if (planUtenTreff.length) {
  console.log(`⚠ PLAN-RADER UTEN ANSATT-TREFF (${planUtenTreff.length}):`);
  for (const p of planUtenTreff.sort((a, b) => a.planNavn.localeCompare(b.planNavn, "nb"))) {
    console.log(`  ${p.planNavn} (${p.absenceCount} fraværsdager i plan)`);
  }
  console.log("");
}

if (flerePlanRader.length) {
  console.log(`⚠ FLERE PLAN-RADER KOBLET TIL SAMME ANSATT (${flerePlanRader.length}):`);
  for (const a of flerePlanRader) {
    console.log(`  ${a.navn} (${a.id}): ${a.planNavn.join(" | ")}`);
  }
  console.log("");
}

if (ansattUtenPlanRad.length) {
  console.log(`ANSATTE UTEN PLAN-RAD (${ansattUtenPlanRad.length}) — manuelt fravær OK, import fra plan får ingenting:`);
  for (const a of ansattUtenPlanRad.sort((x, y) => x.navn.localeCompare(y.navn, "nb"))) {
    console.log(`  ${a.navn} (${a.id}, ${a.selskap})`);
  }
  console.log("");
}

const medFraværData = planMedTreff.filter((p) => p.absenceCount > 0);
console.log(`Plan-rader med fraværdata: ${medFraværData.length}`);
console.log(`Plan-rader med fraværdata OG ansatt-treff: ${medFraværData.length}`);

const kanIkkeImporteres = planUtenTreff.filter((p) => p.absenceCount > 0);
if (kanIkkeImporteres.length) {
  console.log(`\n❌ FRAVÆR SOM IKKE KAN IMPORTERES (plan har data, men ingen ansatt-treff): ${kanIkkeImporteres.length}`);
  for (const p of kanIkkeImporteres) {
    console.log(`  ${p.planNavn} (${p.absenceCount} dager)`);
  }
}

const ok = planUtenTreff.filter((p) => p.absenceCount === 0).length;
const bekreftet = ansattUtenPlanRad.length === 0 && planUtenTreff.length === 0 && kollisjoner.length === 0;

console.log("\n--- OPPSUMMERING ---");
if (bekreftet) {
  console.log("✅ Alle ansatte har plan-rad og alle plan-rader matcher ansatt.");
} else {
  console.log("❌ Full kobling er IKKE bekreftet.");
  console.log(`   ${ansattUtenPlanRad.length} ansatte uten plan-rad`);
  console.log(`   ${planUtenTreff.length} plan-rader uten ansatt (${kanIkkeImporteres.length} med fraværdata)`);
  console.log(`   ${kollisjoner.length} navneduplikater`);
}
