/**
 * Full simulering av fravær-import (gruppering + ansattmatching).
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const excelPath = process.argv[2] ?? "C:/Users/sisvee7/Downloads/Bemanning 2026.xlsx";
const ansattePath = path.join(process.cwd(), "lib/imported/ansatte-bemanning-2026.ts");
const ansatte = JSON.parse(fs.readFileSync(ansattePath, "utf8").match(/=\s*(\[[\s\S]*?\]);/)[1]);

const RUTE = "R";
function erFraværKode(code) {
  const c = code.trim().toUpperCase();
  if (!c || c === RUTE || /^\d+$/.test(c)) return false;
  return /^[A-ZÆØÅ]{1,3}$/.test(c);
}
function mapType(kode) {
  switch (kode.trim().toUpperCase()) {
    case "S": return "Syk";
    case "F": return "Ferie";
    case "A": return "Avspasering";
    default: return "Annet";
  }
}
function parseDriverNavn(raw) {
  const t = raw.trim();
  if (t.includes(",")) {
    const [etternavn, ...rest] = t.split(",").map((s) => s.trim());
    const fornavn = rest.join(" ").trim();
    if (etternavn && fornavn) return { fornavn, etternavn };
    return null;
  }
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { etternavn: parts.at(-1), fornavn: parts.slice(0, -1).join(" ") };
}
function normalizeNavn(raw) {
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function matchAnsatt(planNavn, ansatte) {
  const parsed = parseDriverNavn(planNavn);
  if (!parsed) return null;
  const nøkkel = normalizeNavn(`${parsed.etternavn}, ${parsed.fornavn}`);
  const index = new Map();
  for (const a of ansatte) {
    index.set(normalizeNavn(`${a.etternavn}, ${a.fornavn}`), a.id);
  }
  return index.get(nøkkel) ?? null;
}
function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function erHelg(iso) {
  const u = new Date(`${iso}T12:00:00`).getDay();
  return u === 0 || u === 6;
}
function kanFortsettePeriode(sisteTil, nesteFra) {
  if (addDays(sisteTil, 1) === nesteFra) return true;
  let d = addDays(sisteTil, 1);
  while (d < nesteFra) {
    if (!erHelg(d)) return false;
    d = addDays(d, 1);
  }
  return d === nesteFra;
}
function grupper(dager) {
  const perioder = [];
  for (const dag of dager) {
    const siste = perioder.at(-1);
    if (siste && siste.type === dag.type && siste.excelKode === dag.excelKode && kanFortsettePeriode(siste.tilDato, dag.dato)) {
      siste.tilDato = dag.dato;
    } else {
      perioder.push({ ...dag, fraDato: dag.dato, tilDato: dag.dato });
    }
  }
  return perioder;
}

// Parse excel like parseBemanningsplanExcel
const wb = XLSX.read(fs.readFileSync(excelPath), { type: "buffer", cellComments: true });
const sheet = wb.Sheets[wb.SheetNames.find((s) => /bemanning plan/i.test(s)) ?? wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
const monthRow = rows[0] ?? [];
const datoRow = rows[5] ?? [];
const year = 2026;
let currentMonth = null;
let prevDay = null;
const colDates = [];
for (let c = 1; c < datoRow.length; c++) {
  const mCell = String(monthRow[c] ?? "").trim().toLowerCase();
  for (const [navn, nr] of [
    ["januar", 1], ["februar", 2], ["mars", 3], ["april", 4], ["mai", 5], ["juni", 6],
    ["juli", 7], ["august", 8], ["september", 9], ["oktober", 10], ["november", 11], ["desember", 12],
  ]) {
    if (mCell.startsWith(navn)) { currentMonth = nr; prevDay = null; }
  }
  const day = Number(datoRow[c]);
  if (!day || !currentMonth) continue;
  if (prevDay != null && day < prevDay && !mCell) currentMonth += 1;
  prevDay = day;
  colDates[c] = `${year}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const planCodeCounts = {};
const imported = [];
const unmatched = [];

for (let r = 12; r < rows.length; r++) {
  const name = String(rows[r]?.[0] ?? "").trim();
  if (!name || name.length < 3 || !parseDriverNavn(name)) continue;
  const ansattId = matchAnsatt(name, ansatte);
  if (!ansattId) { unmatched.push(name); continue; }

  const dager = [];
  for (let c = 1; c < (rows[r]?.length ?? 0); c++) {
    const dato = colDates[c];
    if (!dato?.startsWith("2026")) continue;
    const code = String(rows[r][c] ?? "").trim().toUpperCase();
    if (!erFraværKode(code)) continue;
    planCodeCounts[code] = (planCodeCounts[code] ?? 0) + 1;
    dager.push({ dato, type: mapType(code), excelKode: code });
  }
  dager.sort((a, b) => a.dato.localeCompare(b.dato));
  for (const p of grupper(dager)) {
    imported.push({ ansattId, ...p });
  }
}

const byType = {};
const byExcel = {};
for (const f of imported) {
  byType[f.type] = (byType[f.type] ?? 0) + 1;
  byExcel[f.excelKode] = (byExcel[f.excelKode] ?? 0) + 1;
}

console.log("Plan dag-koder:", planCodeCounts);
console.log("Importerte perioder:", imported.length);
console.log("Perioder per type:", byType);
console.log("Perioder per excel (ikke dager!):", byExcel);
console.log("Unmatched:", unmatched.length, unmatched);
