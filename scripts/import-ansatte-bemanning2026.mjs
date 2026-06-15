/**
 * Importerer ansatte fra «Bemanning 2026.xlsx» (kolonne A, alle ark).
 *
 * Kjøring:
 *   node scripts/import-ansatte-bemanning2026.mjs --diff [excel-sti]
 *   node scripts/import-ansatte-bemanning2026.mjs --merge --add-new=nøkkel1,nøkkel2 [excel-sti]
 *   node scripts/import-ansatte-bemanning2026.mjs --write [excel-sti]
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const DEFAULT_EXCEL = "C:\\Users\\sisvee7\\Downloads\\Bemanning 2026.xlsx";
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

function parseArgs(argv) {
  const flags = new Set();
  let addNew = [];
  let excelPath = null;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--diff") flags.add("diff");
    else if (arg === "--merge") flags.add("merge");
    else if (arg === "--write") flags.add("write");
    else if (arg === "--with-all-new") flags.add("withAllNew");
    else if (arg.startsWith("--add-new=")) {
      addNew = arg
        .slice("--add-new=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (!arg.startsWith("--")) {
      excelPath = arg;
    }
  }

  if (!flags.has("diff") && !flags.has("merge") && !flags.has("write")) {
    flags.add("write");
  }

  return {
    flags,
    addNew,
    excelPath: excelPath ?? DEFAULT_EXCEL,
  };
}

function normalizeStr(v) {
  return String(v ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
        byKey.set(key, { key, fornavn, etternavn, selskap, kommentar, raw });
      } else {
        const existing = byKey.get(key);
        if (kommentar && existing.kommentar && !existing.kommentar.includes(kommentar)) {
          existing.kommentar = `${existing.kommentar}; ${kommentar}`;
        }
      }
    }
  }

  return byKey;
}

function buildExcelKommentar(p) {
  const kommentarParts = ["Importert fra Bemanning 2026.xlsx"];
  if (p.kommentar) kommentarParts.push(p.kommentar);
  if (
    p.raw !== `${p.etternavn}, ${p.fornavn}` &&
    p.raw !== `${p.fornavn} ${p.etternavn}`.trim()
  ) {
    kommentarParts.push(`Excel: ${p.raw}`);
  }
  return kommentarParts.join(" · ");
}

function personToAnsatt(p, usedIds) {
  return {
    id: slugId(p.fornavn, p.etternavn, usedIds),
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
    kommentar: buildExcelKommentar(p),
  };
}

function loadExistingAnsatte() {
  if (!fs.existsSync(OUT_PATH)) return [];
  const ts = fs.readFileSync(OUT_PATH, "utf8");
  const m = ts.match(
    /export const IMPORTERTE_ANSATTE_BEMANNING_2026[^=]*=\s*(\[[\s\S]*?\]);/,
  );
  if (!m) throw new Error("Kunne ikke lese eksisterende ansattliste fra TS-fil");
  return JSON.parse(m[1]);
}

function indexByKey(ansatte) {
  const map = new Map();
  for (const a of ansatte) {
    map.set(dedupKey(a.fornavn, a.etternavn), a);
  }
  return map;
}

function normNavn(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function firstName(fornavn) {
  return normNavn(fornavn).split(/\s+/).filter(Boolean)[0] ?? "";
}

/** Samme etternavn + likt førstenavn → sannsynlig duplikat (f.eks. «Roger Skogheim» vs «Roger Haug Skogheim»). */
function findMuligDuplikat(excel, existing) {
  const en = normNavn(excel.etternavn);
  const fn = firstName(excel.fornavn);
  if (!en || !fn) return null;

  for (const a of existing) {
    if (normNavn(a.etternavn) !== en) continue;
    if (firstName(a.fornavn) !== fn) continue;
    if (dedupKey(a.fornavn, a.etternavn) === dedupKey(excel.fornavn, excel.etternavn)) continue;
    return a;
  }
  return null;
}

function compareDiff(existing, excelByKey) {
  const existingByKey = indexByKey(existing);
  const nye = [];
  const muligeDuplikater = [];
  const fjernet = [];
  const endringer = [];

  for (const [key, excel] of excelByKey) {
    const prev = existingByKey.get(key);
    if (!prev) {
      const duplikat = findMuligDuplikat(excel, existing);
      if (duplikat) {
        muligeDuplikater.push({
          key,
          navn: `${excel.fornavn} ${excel.etternavn}`.trim(),
          selskap: excel.selskap,
          raw: excel.raw,
          eksisterendeId: duplikat.id,
          eksisterendeNavn: `${duplikat.fornavn} ${duplikat.etternavn}`.trim(),
        });
      } else {
        nye.push({
          key,
          navn: `${excel.fornavn} ${excel.etternavn}`.trim(),
          selskap: excel.selskap,
          raw: excel.raw,
        });
      }
      continue;
    }

    const felt = [];
    if (prev.selskap !== excel.selskap) {
      felt.push({ felt: "selskap", fra: prev.selskap ?? "Asko", til: excel.selskap });
    }
    if (prev.fornavn !== excel.fornavn) {
      felt.push({ felt: "fornavn", fra: prev.fornavn, til: excel.fornavn });
    }
    if (prev.etternavn !== excel.etternavn) {
      felt.push({ felt: "etternavn", fra: prev.etternavn, til: excel.etternavn });
    }

    if (felt.length) {
      endringer.push({
        key,
        id: prev.id,
        navn: `${prev.fornavn} ${prev.etternavn}`.trim(),
        felt,
        excelRaw: excel.raw,
      });
    }
  }

  for (const [key, prev] of existingByKey) {
    if (!excelByKey.has(key)) {
      fjernet.push({
        key,
        id: prev.id,
        navn: `${prev.fornavn} ${prev.etternavn}`.trim(),
        selskap: prev.selskap,
      });
    }
  }

  nye.sort((a, b) => a.navn.localeCompare(b.navn, "nb"));
  muligeDuplikater.sort((a, b) => a.navn.localeCompare(b.navn, "nb"));
  fjernet.sort((a, b) => a.navn.localeCompare(b.navn, "nb"));
  endringer.sort((a, b) => a.navn.localeCompare(b.navn, "nb"));

  return { nye, muligeDuplikater, fjernet, endringer };
}

function printDiffReport(diff, excelCount, existingCount) {
  console.log("=== Diff: Bemanning 2026.xlsx vs ansatte-bemanning-2026.ts ===");
  console.log(`Excel: ${excelCount} personer · Eksisterende: ${existingCount} personer`);
  console.log("");

  if (diff.muligeDuplikater?.length) {
    console.log(
      `MULIGE DUPLIKATER (${diff.muligeDuplikater.length}) — importeres ikke automatisk:`,
    );
    for (const p of diff.muligeDuplikater) {
      console.log(`  ≈ [${p.key}] ${p.navn} → ${p.eksisterendeNavn} (${p.eksisterendeId})`);
      if (p.raw) console.log(`      Excel: ${p.raw}`);
    }
    console.log("");
  } else {
    console.log("MULIGE DUPLIKATER: ingen");
    console.log("");
  }

  if (diff.nye.length) {
    console.log(`NYE (${diff.nye.length}) — spør bruker før import:`);
    for (const p of diff.nye) {
      console.log(`  + [${p.key}] ${p.navn} (${p.selskap})`);
      if (p.raw) console.log(`      Excel: ${p.raw}`);
    }
    console.log("");
  } else {
    console.log("NYE: ingen");
    console.log("");
  }

  if (diff.endringer.length) {
    console.log(`ENDRINGER (${diff.endringer.length}):`);
    for (const e of diff.endringer) {
      console.log(`  ~ [${e.key}] ${e.navn} (${e.id})`);
      for (const f of e.felt) {
        console.log(`      ${f.felt}: ${f.fra ?? "(tom)"} → ${f.til ?? "(tom)"}`);
      }
    }
    console.log("");
  } else {
    console.log("ENDRINGER: ingen");
    console.log("");
  }

  if (diff.fjernet.length) {
    console.log(`FJERNET FRA EXCEL (${diff.fjernet.length}) — beholdes i appen til godkjenning:`);
    for (const p of diff.fjernet) {
      console.log(`  - [${p.key}] ${p.navn} (${p.id})`);
    }
    console.log("");
  } else {
    console.log("FJERNET FRA EXCEL: ingen");
    console.log("");
  }

  console.log("--- JSON ---");
  console.log(JSON.stringify(diff, null, 2));
}

function mergeAnsatte(existing, excelByKey, addNewKeys) {
  const usedIds = new Set(existing.map((a) => a.id));
  const addSet = new Set(addNewKeys);
  const merged = existing.map((a) => {
    const key = dedupKey(a.fornavn, a.etternavn);
    const excel = excelByKey.get(key);
    if (!excel) return a;

    return {
      ...a,
      fornavn: excel.fornavn,
      etternavn: excel.etternavn,
      selskap: excel.selskap,
      kommentar: buildExcelKommentar(excel),
    };
  });

  for (const key of addSet) {
    const excel = excelByKey.get(key);
    if (!excel) continue;
    if (merged.some((a) => dedupKey(a.fornavn, a.etternavn) === key)) continue;
    merged.push(personToAnsatt(excel, usedIds));
  }

  return merged.sort((a, b) =>
    `${a.etternavn} ${a.fornavn}`.localeCompare(`${b.etternavn} ${b.fornavn}`, "nb"),
  );
}

function buildFromExcel(excelByKey) {
  const usedIds = new Set();
  return [...excelByKey.values()]
    .sort((a, b) =>
      `${a.etternavn} ${a.fornavn}`.localeCompare(`${b.etternavn} ${b.fornavn}`, "nb"),
    )
    .map((p) => personToAnsatt(p, usedIds));
}

function writeAnsatteFile(ansatte) {
  const out = `import type { Ansatt } from "@/lib/domain";

/** Ansatte importert fra Bemanning 2026.xlsx (${ansatte.length} personer). */
export const IMPORTERTE_ANSATTE_BEMANNING_2026: Ansatt[] = ${JSON.stringify(ansatte, null, 2)};
`;

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, out, "utf8");
  console.log("Skrev:", OUT_PATH);
  console.log("Antall ansatte:", ansatte.length);
}

const { flags, addNew, excelPath } = parseArgs(process.argv);

if (!fs.existsSync(excelPath)) {
  console.error("Finner ikke fil:", excelPath);
  process.exit(1);
}

const wb = XLSX.read(fs.readFileSync(excelPath), { type: "buffer" });
const excelByKey = extractNames(wb);
const existing = loadExistingAnsatte();
const diff = compareDiff(existing, excelByKey);

if (flags.has("diff")) {
  printDiffReport(diff, excelByKey.size, existing.length);
  process.exit(0);
}

if (flags.has("merge")) {
  const keysToAdd = flags.has("withAllNew")
    ? diff.nye.map((p) => p.key)
    : addNew;

  if (diff.nye.length && !keysToAdd.length) {
    console.error(
      "Det finnes nye ansatte i Excel. Kjør --diff først og bruk --add-new=nøkkel1,nøkkel2 (eller --with-all-new).",
    );
    printDiffReport(diff, excelByKey.size, existing.length);
    process.exit(1);
  }

  const merged = mergeAnsatte(existing, excelByKey, keysToAdd);
  writeAnsatteFile(merged);
  if (keysToAdd.length) {
    console.log("Nye ansatte lagt til:", keysToAdd.join(", "));
  }
  process.exit(0);
}

if (flags.has("write")) {
  const ansatte = buildFromExcel(excelByKey);
  writeAnsatteFile(ansatte);
  process.exit(0);
}
