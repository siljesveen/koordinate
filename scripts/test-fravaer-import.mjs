/**
 * Verifiser fravær-import fra Excel (engangstest).
 * node scripts/test-fravaer-import.mjs [excel-sti]
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const excelPath = process.argv[2] ?? "C:/Users/sisvee7/Downloads/Bemanning 2026.xlsx";
const ansattePath = path.join(process.cwd(), "lib/imported/ansatte-bemanning-2026.ts");
const ansatteRaw = fs.readFileSync(ansattePath, "utf8");
const ansatte = JSON.parse(ansatteRaw.match(/=\s*(\[[\s\S]*?\]);/)[1]);

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
  }
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { etternavn: parts.at(-1), fornavn: parts.slice(0, -1).join(" ") };
}
function normalizeNavn(raw) {
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function matchAnsatt(planNavn, ansatte) {
  const eksplisitt = ansatte.filter((a) => a.planExcelNavn === planNavn);
  if (eksplisitt.length === 1) return eksplisitt[0].id;
  const parsed = parseDriverNavn(planNavn);
  if (!parsed) return null;
  const nøkkel = normalizeNavn(`${parsed.etternavn}, ${parsed.fornavn}`);
  const index = new Map();
  for (const a of ansatte) {
    index.set(normalizeNavn(`${a.etternavn}, ${a.fornavn}`), a.id);
  }
  return index.get(nøkkel) ?? null;
}

const wb = XLSX.read(fs.readFileSync(excelPath), { type: "buffer", cellComments: true });
const sheetName = wb.SheetNames.find((s) => /bemanning plan/i.test(s)) ?? wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
const year = 2026;

const codeCounts = {};
const typeCounts = {};
let matchedDays = 0;
let unmatchedDrivers = [];

for (let r = 12; r < rows.length; r++) {
  const name = String(rows[r]?.[0] ?? "").trim();
  if (!name || name.length < 3) continue;
  const ansattId = matchAnsatt(name, ansatte);
  if (!ansattId) {
    unmatchedDrivers.push(name);
    continue;
  }
  for (let c = 1; c < (rows[r]?.length ?? 0); c++) {
    const code = String(rows[r][c] ?? "").trim().toUpperCase();
    if (!erFraværKode(code)) continue;
    codeCounts[code] = (codeCounts[code] ?? 0) + 1;
    const type = mapType(code);
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    matchedDays++;
  }
}

console.log("Excel codes:", codeCounts);
console.log("Matched days by type:", typeCounts);
console.log("Matched days total:", matchedDays);
console.log("Unmatched drivers:", unmatchedDrivers.length, unmatchedDrivers.slice(0, 8));
