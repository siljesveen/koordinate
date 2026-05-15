/**
 * Importerer ansatte fra «Bemanning 2026.xlsx» (kolonne A, alle ark).
 * Kjøring: node scripts/import-ansatte-bemanning2026.mjs
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const EXCEL_PATH =
  process.argv[2] ??
  "C:\\Users\\sisvee7\\Downloads\\Bemanning 2026.xlsx";
const OUT_PATH = path.join(
  process.cwd(),
  "lib/imported/ansatte-bemanning-2026.ts",
);

const SKIP_EXACT = new Set([
  "Dag",
  "Dato",
  "Fri",
  "Avspas innarb.",
  "Syke",
  "Tilgjengelige",
  "Tilgjenglige",
  "Behov",
  "Dif",
  "Uke",
  "Lærlinger",
  "Vikarer",
  "UKEPLANER",
  "Støtte",
  "Løkkebakke",
  "",
]);

const SKIP_PREFIX = /^(Januar|Februar|Mars|April|Mai |Juni|Juli|August|September|Oktober|November|Desember)/i;

function normalizeStr(v) {
  return String(v ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fjern notater i parentes og etter ferie-/flytte-tekst. */
function cleanRawName(raw) {
  let t = normalizeStr(raw);
  const paren = t.match(/\(([^)]*)\)/);
  const parenNote = paren ? paren[1].trim() : "";
  t = t.replace(/\([^)]*\)/g, "").trim();
  t = t.replace(/\s+\d+\s+DAGER.*$/i, "").trim();
  t = t.replace(/\s+FLYTTES.*$/i, "").trim();
  t = t.replace(/\s+FERIE.*$/i, "").trim();
  return { name: t, parenNote };
}

function parseName(raw) {
  const { name, parenNote } = cleanRawName(raw);
  let fornavn = "";
  let etternavn = "";
  const kommentarParts = [];
  if (parenNote) kommentarParts.push(parenNote);

  if (name.includes(",")) {
    const [last, ...rest] = name.split(",").map((s) => s.trim());
    etternavn = last;
    fornavn = rest.join(" ").trim();
  } else {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 1) {
      fornavn = parts[0];
    } else if (parts.length === 2) {
      fornavn = parts[0];
      etternavn = parts[1];
    } else {
      etternavn = parts[parts.length - 1];
      fornavn = parts.slice(0, -1).join(" ");
    }
  }

  return {
    fornavn: fornavn || etternavn || "Ukjent",
    etternavn: fornavn && etternavn ? etternavn : "",
    kommentar: kommentarParts.length ? kommentarParts.join("; ") : undefined,
  };
}

function dedupKey(fornavn, etternavn) {
  const parts = `${fornavn} ${etternavn}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort();
  return parts.join(" ");
}

function detectSelskap(raw) {
  const t = raw.toLowerCase();
  if (/\bbring\b/.test(t) || /^bring\s*\d/i.test(t)) return "Bring";
  if (/\btf\s*\d/i.test(t) || /\btf\b/.test(t)) return "TF";
  if (/\bgdf\s*\d/i.test(t) || /\bgdf\b/.test(t)) return "GDF";
  return "Asko";
}

function slugId(fornavn, etternavn, used) {
  const base = `${fornavn}-${etternavn}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let id = `a-${base || "ukjent"}`;
  let n = 2;
  while (used.has(id)) {
    id = `a-${base}-${n}`;
    n++;
  }
  used.add(id);
  return id;
}

function isPersonRow(cell) {
  const t = normalizeStr(cell);
  if (!t || t.length < 3) return false;
  if (SKIP_EXACT.has(t)) return false;
  if (SKIP_PREFIX.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (!/[a-zæøå]/i.test(t)) return false;
  return true;
}

function extractNames(wb) {
  const byKey = new Map();

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    });
    for (const row of rows) {
      const cell = row?.[0];
      if (!isPersonRow(cell)) continue;
      const raw = normalizeStr(cell);
      const { fornavn, etternavn, kommentar } = parseName(raw);
      const key = dedupKey(fornavn, etternavn);
      const selskap = detectSelskap(raw);

      if (!byKey.has(key)) {
        byKey.set(key, { fornavn, etternavn, selskap, kommentar, raw });
      } else {
        const existing = byKey.get(key);
        if (kommentar && existing.kommentar && !existing.kommentar.includes(kommentar)) {
          existing.kommentar = `${existing.kommentar}; ${kommentar}`;
        }
      }
    }
  }

  return [...byKey.values()];
}

if (!fs.existsSync(EXCEL_PATH)) {
  console.error("Finner ikke fil:", EXCEL_PATH);
  process.exit(1);
}

const wb = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: "buffer" });
const people = extractNames(wb);
const usedIds = new Set();

const ansatte = people
  .sort((a, b) =>
    `${a.etternavn} ${a.fornavn}`.localeCompare(`${b.etternavn} ${b.fornavn}`, "nb"),
  )
  .map((p) => {
    const id = slugId(p.fornavn, p.etternavn, usedIds);
    const kommentarParts = ["Importert fra Bemanning 2026.xlsx"];
    if (p.kommentar) kommentarParts.push(p.kommentar);
    if (p.raw !== `${p.etternavn}, ${p.fornavn}` && p.raw !== `${p.fornavn} ${p.etternavn}`.trim()) {
      kommentarParts.push(`Excel: ${p.raw}`);
    }
    return {
      id,
      fornavn: p.fornavn,
      etternavn: p.etternavn,
      telefon: "",
      epost: "",
      rolle: "Sjåfør",
      avdeling: "",
      selskap: p.selskap,
      stillingsprosent: 100,
      kompetanse: [],
      førerkort: [],
      aktiv: true,
      kommentar: kommentarParts.join(" · "),
    };
  });

const out = `import type { Ansatt } from "@/lib/domain";

/** Ansatte importert fra Bemanning 2026.xlsx (${ansatte.length} personer). */
export const IMPORTERTE_ANSATTE_BEMANNING_2026: Ansatt[] = ${JSON.stringify(ansatte, null, 2)};
`;

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, out, "utf8");
console.log("Skrev:", OUT_PATH);
console.log("Antall ansatte:", ansatte.length);
