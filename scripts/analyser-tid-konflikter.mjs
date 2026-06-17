/**
 * Sammenligner skiftplan (turnus), ruteplan (masterplan) og bemanningsplan-data.
 * Kjør: node scripts/analyser-tid-konflikter.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SYKLUS_ANKER = new Date(2026, 4, 11); // mandag uke 1

function pad2(n) {
  return String(n).padStart(2, "0");
}

function datoFraSyklus(uke, dag) {
  const d = new Date(SYKLUS_ANKER);
  d.setDate(d.getDate() + (uke - 1) * 7 + (dag - 1));
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseLocalDato(datoStr) {
  const [y, m, d] = datoStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoUkenummer(input) {
  const d = input instanceof Date ? input : parseLocalDato(input);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const årsStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - årsStart.getTime()) / 86400000 + 1) / 7);
}

function aktivTurnusUke(turnus, datoStr) {
  if (!turnus.uke2) return turnus.uke1;
  const d = parseLocalDato(datoStr);
  const ref = parseLocalDato(turnus.referanseDato);
  const diffUker =
    (isoUkenummer(d) - isoUkenummer(ref) + (d.getFullYear() - ref.getFullYear()) * 52) % 2;
  const erSammeParitet = ((diffUker % 2) + 2) % 2 === 0;
  return erSammeParitet
    ? turnus.aktivUkeVedReferanse === 1
      ? turnus.uke1
      : turnus.uke2
    : turnus.aktivUkeVedReferanse === 1
      ? turnus.uke2
      : turnus.uke1;
}

function ukedagNummer(datoStr) {
  const dag = parseLocalDato(datoStr).getDay();
  return (dag === 0 ? 7 : dag).toString();
}

function sjekkArbeidstidKonflikt(turnus, datoStr, ruteStartTid) {
  const dagNr = ukedagNummer(datoStr);
  const uke = aktivTurnusUke(turnus, datoStr);
  const dagInfo = uke.dager[dagNr];
  if (!dagInfo) {
    const navn = ["", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"][
      Number(dagNr)
    ];
    return { type: "ingen_arbeidstid", msg: `Ingen arbeidstid på ${navn}` };
  }
  if (ruteStartTid < dagInfo.startTid) {
    return {
      type: "for_tidlig",
      msg: `Rute ${ruteStartTid} · turnus fra ${dagInfo.startTid}`,
    };
  }
  if (ruteStartTid >= dagInfo.sluttTid) {
    return {
      type: "for_sent",
      msg: `Rute ${ruteStartTid} · turnus til ${dagInfo.sluttTid}`,
    };
  }
  return null;
}

function loadTurnus() {
  const raw = fs.readFileSync(path.join(ROOT, "lib/imported/turnus-januar-2026.ts"), "utf8");
  const marker = "TURNUS_JANUAR_2026";
  const eq = raw.indexOf("=", raw.indexOf(marker));
  const start = raw.indexOf("{", eq);
  const end = raw.lastIndexOf("};");
  if (start < 0 || end < 0) throw new Error("Kunne ikke lese turnus");
  return Function(`"use strict"; return (${raw.slice(start, end + 1)});`)();
}

function loadAnsatteMedTurnus(turnusMap) {
  const raw = fs.readFileSync(path.join(ROOT, "lib/imported/ansatte-bemanning-2026.ts"), "utf8");
  const m = raw.match(/const ANSATTE_GRUNNDATA = (\[[\s\S]*?\])\s*\.map/);
  if (!m) throw new Error("Kunne ikke lese ansatte");
  const ansatte = JSON.parse(m[1]);
  return ansatte.map((a) => {
    const planExcelNavn =
      a.planExcelNavn ??
      (turnusMap[`${a.etternavn}, ${a.fornavn}`]
        ? `${a.etternavn}, ${a.fornavn}`
        : turnusMap[`${a.fornavn} ${a.etternavn}`.trim()]
          ? `${a.fornavn} ${a.etternavn}`.trim()
          : undefined);
    const turnus = planExcelNavn ? turnusMap[planExcelNavn] : undefined;
    return { ...a, planExcelNavn, turnus };
  });
}

function masterSlotId(uke, dag, skift, rutekode) {
  return `ms-${uke}-${dag}-${skift}-${encodeURIComponent(rutekode)}`;
}

function baselineMasterplan(cycle) {
  const slotMap = new Map();
  for (const [ukeStr, dager] of Object.entries(cycle.cycle)) {
    const uke = Number(ukeStr);
    for (const [dagStr, skiftMap] of Object.entries(dager)) {
      const dag = Number(dagStr);
      for (const [skiftStr, skiftPlan] of Object.entries(skiftMap)) {
        if (skiftStr !== "Dag" && skiftStr !== "Kveld") continue;
        for (const rute of skiftPlan?.ruter ?? []) {
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
            rutenavn: rute.rutenavn?.trim(),
          });
        }
      }
    }
  }
  return [...slotMap.values()];
}

function mergePatches(slots, patch) {
  const uke = patch.uke;
  const updateMap = new Map(
    patch.slotUpdates.map((u) => [`${u.dag}|${u.skift}|${u.rutekode}`, u]),
  );
  return slots.map((slot) => {
    if (slot.uke !== uke) return slot;
    const upd = updateMap.get(`${slot.dag}|${slot.skift}|${slot.rutekode}`);
    if (!upd) return slot;
    if (upd.clearSjåfør) {
      return {
        ...slot,
        startTid: upd.startTid ?? slot.startTid,
        standardSjåførAnsattId: undefined,
      };
    }
    return {
      ...slot,
      startTid: upd.startTid ?? slot.startTid,
      standardSjåførAnsattId: upd.standardSjåførAnsattId,
    };
  });
}

const DAG_NAVN = ["", "Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

const turnusMap = loadTurnus();
const ansatte = loadAnsatteMedTurnus(turnusMap);
const ansattById = new Map(ansatte.map((a) => [a.id, a]));

const cycle = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib/imported/ringnes-cycle.json"), "utf8"),
);
let slots = baselineMasterplan(cycle);
for (const uke of [1, 2, 3, 4]) {
  const patch = JSON.parse(
    fs.readFileSync(path.join(ROOT, `lib/imported/uke${uke}-masterplan-patch.json`), "utf8"),
  );
  slots = mergePatches(slots, patch);
}

const konflikter = {
  arbeidstid: [],
  skift: [],
  ingen_turnus: [],
  mangler_starttid: [],
  dobbel_rute: [],
};

const tildelingerPerSjåfør = new Map();

for (const slot of slots) {
  const sjåførId = slot.standardSjåførAnsattId;
  if (!sjåførId) continue;

  const ansatt = ansattById.get(sjåførId);
  const navn = ansatt ? `${ansatt.fornavn} ${ansatt.etternavn}` : sjåførId;
  const dato = datoFraSyklus(slot.uke, slot.dag);
  const nøkkel = `${sjåførId}|${slot.uke}|${slot.dag}|${slot.skift}`;

  if (!tildelingerPerSjåfør.has(nøkkel)) tildelingerPerSjåfør.set(nøkkel, []);
  tildelingerPerSjåfør.get(nøkkel).push(slot);

  if (!ansatt?.turnus) {
    konflikter.ingen_turnus.push({
      uke: slot.uke,
      dag: DAG_NAVN[slot.dag],
      skift: slot.skift,
      rutekode: slot.rutekode,
      navn,
    });
    continue;
  }

  const aktivUke = aktivTurnusUke(ansatt.turnus, dato);
  if (aktivUke.skift !== slot.skift) {
    konflikter.skift.push({
      uke: slot.uke,
      dag: DAG_NAVN[slot.dag],
      rutekode: slot.rutekode,
      ruteSkift: slot.skift,
      turnusSkift: aktivUke.skift,
      navn,
      startTid: slot.startTid,
    });
  }

  if (!slot.startTid) {
    konflikter.mangler_starttid.push({
      uke: slot.uke,
      dag: DAG_NAVN[slot.dag],
      skift: slot.skift,
      rutekode: slot.rutekode,
      navn,
    });
    continue;
  }

  const tidKonflikt = sjekkArbeidstidKonflikt(ansatt.turnus, dato, slot.startTid);
  if (tidKonflikt) {
    const dagNr = ukedagNummer(dato);
    const dagInfo = aktivUke.dager[dagNr];
    konflikter.arbeidstid.push({
      type: tidKonflikt.type,
      uke: slot.uke,
      dag: DAG_NAVN[slot.dag],
      skift: slot.skift,
      rutekode: slot.rutekode,
      startTid: slot.startTid,
      turnus: dagInfo ? `${dagInfo.startTid}–${dagInfo.sluttTid}` : "—",
      navn,
      msg: tidKonflikt.msg,
    });
  }
}

for (const [nøkkel, ruter] of tildelingerPerSjåfør) {
  if (ruter.length < 2) continue;
  const [sjåførId, uke, dag, skift] = nøkkel.split("|");
  const ansatt = ansattById.get(sjåførId);
  konflikter.dobbel_rute.push({
    uke: Number(uke),
    dag: DAG_NAVN[Number(dag)],
    skift,
    navn: ansatt ? `${ansatt.fornavn} ${ansatt.etternavn}` : sjåførId,
    ruter: ruter.map((r) => `${r.rutekode}${r.startTid ? `@${r.startTid}` : ""}`).sort(),
  });
}

const medSjåfør = slots.filter((s) => s.standardSjåførAnsattId).length;
const medTurnus = slots.filter((s) => {
  const a = ansattById.get(s.standardSjåførAnsattId ?? "");
  return a?.turnus;
}).length;

console.log("=== TIDSKONFLIKT-ANALYSE ===\n");
console.log(`Masterplan-slots totalt: ${slots.length}`);
console.log(`Med fast sjåfør: ${medSjåfør}`);
console.log(`Der sjåfør har turnus: ${medTurnus}`);
console.log(`Turnus-profiler i import: ${Object.keys(turnusMap).length}`);
console.log(`Ansatte totalt: ${ansatte.length}`);
console.log(`Ansatte med turnus: ${ansatte.filter((a) => a.turnus).length}`);

console.log("\n--- BEMANNINGSPLAN (fravær) ---");
console.log(
  "Fravær fra bemanningsplan-Excel er ikke lagret som statisk import i repo.",
);
console.log(
  "Kun ansattliste + turnus (januar 2026) kan sjekkes mot ruteplan her.",
);

console.log("\n--- KONFLIKTER: ARBEIDSTID (rute vs turnus) ---");
console.log(`Totalt: ${konflikter.arbeidstid.length}`);
const perType = {};
for (const k of konflikter.arbeidstid) {
  perType[k.type] = (perType[k.type] ?? 0) + 1;
}
console.log("Fordeling:", perType);

const unikeArbeidstid = new Map();
for (const k of konflikter.arbeidstid) {
  const key = `${k.navn}|${k.type}|${k.msg}`;
  if (!unikeArbeidstid.has(key)) unikeArbeidstid.set(key, { ...k, antall: 0 });
  unikeArbeidstid.get(key).antall++;
}
const toppArbeidstid = [...unikeArbeidstid.values()].sort((a, b) => b.antall - a.antall);
for (const k of toppArbeidstid.slice(0, 25)) {
  console.log(
    `  ${k.navn}: ${k.msg} (${k.antall} ruter, f.eks. U${k.uke} ${k.dag} ${k.rutekode})`,
  );
}
if (toppArbeidstid.length > 25) {
  console.log(`  ... og ${toppArbeidstid.length - 25} unike mønstre til`);
}

console.log("\n--- KONFLIKTER: SKIFT (Dag/Kveld turnus vs rute) ---");
console.log(`Totalt: ${konflikter.skift.length}`);
const unikeSkift = new Map();
for (const k of konflikter.skift) {
  const key = `${k.navn}|${k.ruteSkift}|${k.turnusSkift}`;
  if (!unikeSkift.has(key)) unikeSkift.set(key, { ...k, antall: 0 });
  unikeSkift.get(key).antall++;
}
for (const k of [...unikeSkift.values()].sort((a, b) => b.antall - a.antall).slice(0, 20)) {
  console.log(
    `  ${k.navn}: rute ${k.ruteSkift} · turnus ${k.turnusSkift} (${k.antall} ruter)`,
  );
}

console.log("\n--- DOBBELT TILDELING (samme sjåfør, dag, skift) ---");
console.log(`Totalt: ${konflikter.dobbel_rute.length}`);
for (const k of konflikter.dobbel_rute.slice(0, 15)) {
  console.log(`  U${k.uke} ${k.dag} ${k.skift} ${k.navn}: ${k.ruter.join(", ")}`);
}
if (konflikter.dobbel_rute.length > 15) {
  console.log(`  ... og ${konflikter.dobbel_rute.length - 15} til`);
}

console.log("\n--- MANGLER DATA ---");
console.log(`Sjåfør uten turnus (tildelt rute): ${konflikter.ingen_turnus.length}`);
console.log(`Ruter uten startTid: ${konflikter.mangler_starttid.length}`);

const outPath = path.join(ROOT, "lib/imported/tid-konflikt-rapport.json");
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      generert: new Date().toISOString(),
      oppsummering: {
        slots: slots.length,
        medSjåfør,
        medTurnus,
        arbeidstidKonflikter: konflikter.arbeidstid.length,
        skiftKonflikter: konflikter.skift.length,
        dobbelRute: konflikter.dobbel_rute.length,
        utenTurnus: konflikter.ingen_turnus.length,
        utenStartTid: konflikter.mangler_starttid.length,
      },
      konflikter,
    },
    null,
    2,
  ),
);
console.log(`\nFull rapport: ${outPath}`);
