import fs from "fs";
import path from "path";
import XLSX from "xlsx";

/**
 * Leser Ringnes uke 1-4 Excel og genererer ansatte basert på unike navn i:
 * - SJÅFØR-kolonnen i rutetabellene
 * - Avspasering-listen (kolonne 11 og nedover)
 *
 * Output: lib/imported/ansatte-from-excel.ts
 *
 * Kjøring:
 *   node scripts/generate-ansatte-from-ringnes.mjs --base "C:\\Users\\sisvee7\\Downloads" --out "lib/imported/ansatte-from-excel.ts"
 */

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  const v = process.argv[i + 1];
  if (k?.startsWith("--") && v && !v.startsWith("--")) {
    args.set(k, v);
    i++;
  } else if (k?.startsWith("--")) {
    args.set(k, true);
  }
}

const baseDir = String(args.get("--base") ?? "C:\\Users\\sisvee7\\Downloads");
const outPath = String(args.get("--out") ?? "lib/imported/ansatte-from-excel.ts");

const files = [
  "Uke 1 fra 19.02.26 Ringnes.xlsx",
  "Uke 2 fra  19.02.26 Ringnes.xlsx",
  "Uke 3 fra 19.2.26 Ringnes.xlsx",
  "Uke 4 fra 19.2.26 Ringnes.xlsx",
];

const SHEETS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];

function normalizeStr(v) {
  return String(v ?? "").replace(/\r?\n/g, " ").trim();
}

function looksLikeRouteId(s) {
  const t = normalizeStr(s);
  if (!t) return false;
  return /^[0-9][0-9][0-9][0-9](?:-[0-9]+)?$/.test(t);
}

function isHeaderRow(row) {
  const a = normalizeStr(row[0]).toUpperCase();
  const b = normalizeStr(row[1]).toUpperCase();
  const c = normalizeStr(row[2]).toUpperCase();
  return a === "RUTE" && b.includes("RUTENAVN") && c.includes("SJÅFØR");
}

function slugId(name) {
  const s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `imp-${s || "ukjent"}`;
}

function isProbablyPersonName(name) {
  const t = normalizeStr(name);
  if (!t) return false;
  if (looksLikeRouteId(t)) return false;
  if (t.startsWith("(") || t.includes("(sesong") || t.toLowerCase().includes("sesong")) return false;
  // Filtrer åpenbare kjørekoder: TF2, GDF1, M3, BRING 3, Bring 1, osv.
  if (/^(tf|gdf|m)\s*\d+$/i.test(t)) return false;
  if (/^bring\b/i.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  // Må inneholde minst én bokstav
  if (!/[a-zæøå]/i.test(t)) return false;
  return true;
}

function splitName(name) {
  const t = normalizeStr(name).replace(/\s+/g, " ");
  const parts = t.split(" ").filter(Boolean);
  if (parts.length === 1) return { fornavn: parts[0], etternavn: "" };
  return { fornavn: parts[0], etternavn: parts.slice(1).join(" ") };
}

function readSheetRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

function extractFromRows(rows, names) {
  // Finn header og SJÅFØR-kolonne
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (isHeaderRow(rows[i] ?? [])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx >= 0) {
    const header = rows[headerIdx].map(normalizeStr);
    const colDriver = header.findIndex((h) => h.toUpperCase().includes("SJÅFØR"));
    const colRoute = header.findIndex((h) => h.toUpperCase() === "RUTE");
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const routeId = normalizeStr(row[colRoute]);
      const driver = normalizeStr(row[colDriver]);
      if (routeId && !looksLikeRouteId(routeId)) continue;
      if (driver && isProbablyPersonName(driver)) names.add(driver);
    }
  }

  // Avspasering: fast kolonne 11, nedover til 2 tomme rader
  const AVSP_COL_IDX = 10;
  let labelRow = -1;
  for (let r = 0; r < rows.length; r++) {
    const v = normalizeStr((rows[r] ?? [])[AVSP_COL_IDX]).toLowerCase();
    if (v.startsWith("avspasering")) {
      labelRow = r;
      break;
    }
  }
  if (labelRow >= 0) {
    let emptyStreak = 0;
    for (let r = labelRow + 1; r < rows.length; r++) {
      const cell = normalizeStr((rows[r] ?? [])[AVSP_COL_IDX]);
      const a = normalizeStr((rows[r] ?? [])[0]).toUpperCase();
      if (a === "SØNDAG" || a === "LØRDAG" || isHeaderRow(rows[r] ?? [])) break;
      if (!cell) {
        emptyStreak++;
        if (emptyStreak >= 2) break;
        continue;
      }
      emptyStreak = 0;
      if (isProbablyPersonName(cell)) names.add(cell);
    }
  }
}

const names = new Set();

for (const file of files) {
  const fp = path.join(baseDir, file);
  if (!fs.existsSync(fp)) {
    console.error("Mangler fil:", fp);
    process.exitCode = 1;
    continue;
  }
  const wb = XLSX.read(fs.readFileSync(fp), { type: "buffer" });
  for (const s of SHEETS) {
    const rows = readSheetRows(wb, s);
    extractFromRows(rows, names);
  }
}

const sortedNames = Array.from(names).sort((a, b) => a.localeCompare(b, "nb"));

const ansatte = sortedNames.map((n) => {
  const { fornavn, etternavn } = splitName(n);
  const id = slugId(`${fornavn}-${etternavn}`.trim());
  return {
    id,
    fornavn,
    etternavn,
    telefon: "",
    epost: "",
    rolle: "Sjåfør",
    avdeling: "",
    stillingsprosent: 100,
    kompetanse: [],
    førerkort: [],
    ruteIds: undefined,
    aktiv: true,
    kommentar: "Importert fra Excel",
  };
});

const out = `import type { Ansatt } from \"@/lib/domain\";\n\nexport const IMPORTERTE_ANSATTE: Ansatt[] = ${JSON.stringify(ansatte, null, 2)};\n`;

const fullOut = path.isAbsolute(outPath)
  ? outPath
  : path.join(process.cwd(), outPath.replaceAll("/", path.sep));
fs.mkdirSync(path.dirname(fullOut), { recursive: true });
fs.writeFileSync(fullOut, out, "utf8");

console.log("Skrev:", fullOut);
console.log("Ansatte:", ansatte.length);

