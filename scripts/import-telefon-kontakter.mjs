/**
 * Importerer telefon fra Google Contacts CSV til ansatte-bemanning-2026.ts
 *
 * Kun Mobile-nummer. Norske mobilnummer (8 siffer, starter på 4 eller 9),
 * også med +47. Svenske mobilnummer med +46 (9 siffer, starter på 7).
 * Avviser sammenslåtte prefikser som +47104289….
 * Kun entydig navnetreff mot ansattlisten.
 *
 *   node scripts/import-telefon-kontakter.mjs --diff [csv-sti]
 *   node scripts/import-telefon-kontakter.mjs --write [csv-sti]
 */
import fs from "fs";
import path from "path";

const DEFAULT_CSV =
  "C:\\Users\\sisvee7\\Downloads\\contacts (1).csv";
const OUT_PATH = path.join(
  process.cwd(),
  "lib/imported/ansatte-bemanning-2026.ts",
);

const SKIP_LAST = new Set([
  "bring",
  "gdf",
  "bama",
  "asko",
  "frys",
  "dv",
  "tf",
  "cc",
  "hed",
  "vakt",
  "assistanse",
  "kveld",
  "utland",
  "line",
  "3",
  "2",
  "1",
  "arbeidstlf",
  "sjåfør",
  "transportkontor",
  "lilhammer",
  "prøv",
]);

const SKIP_FIRST = /^(bama|biogass|dekkmann|etterplukk|frys|kiwi|kundeservice|mesna|miljøstasjon|mjøsgrønt|nød|permanor|politiet|sammenstiller|sammenstilling|scania|sentralbord|telenor|varemottak|vakttelefon|hvebergsmoen|støtte|ukeplaner)$/i;

function parseArgs(argv) {
  const flags = new Set();
  let csvPath = null;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--diff") flags.add("diff");
    else if (arg === "--write") flags.add("write");
    else if (!arg.startsWith("--")) csvPath = arg;
  }
  if (!flags.has("diff") && !flags.has("write")) flags.add("diff");
  return { flags, csvPath: csvPath ?? DEFAULT_CSV };
}

function normalizeNavn(raw) {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Ǿø]/gi, "o")
    .replace(/[åä]/gi, "a")
    .replace(/[æ]/gi, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse enkel CSV-rad med anførselstegn. */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function tryParseMobilPart(raw) {
  if (!raw || typeof raw !== "string") return null;
  const first = raw.trim();
  if (!first) return null;
  if (first.includes("*")) return null;
  if (/[a-zA-ZæøåÆØÅ]/.test(first)) return null;

  if (!first.includes("+")) {
    const digits = first.replace(/\D/g, "");
    if (digits.length === 8 && /^[49]\d{7}$/.test(digits)) {
      return { type: "no", digits };
    }
    return null;
  }

  const compact = first.replace(/[\s().-]/g, "");

  const noMatch = compact.match(/^\+47(\d{8})$/);
  if (noMatch && /^[49]/.test(noMatch[1])) {
    return { type: "no", digits: noMatch[1] };
  }

  const seMatch = compact.match(/^\+46(\d{9})$/);
  if (seMatch && /^7/.test(seMatch[1])) {
    return { type: "se", digits: seMatch[1] };
  }

  return null;
}

function parseValidMobil(raw, label) {
  if (!label || label.trim().toLowerCase() !== "mobile") return null;
  if (!raw || typeof raw !== "string") return null;

  for (const part of raw.split(":::")) {
    const parsed = tryParseMobilPart(part);
    if (parsed) return parsed;
  }
  return null;
}

function kontaktNavnNøkler(first, middle, last) {
  const f = String(first ?? "").trim();
  const m = String(middle ?? "").trim();
  const l = String(last ?? "").trim();
  if (!f || !l) return [];

  const keys = new Set();
  if (m) {
    keys.add(normalizeNavn(`${f} ${m} ${l}`));
    keys.add(normalizeNavn(`${l}, ${f} ${m}`));
    keys.add(normalizeNavn(`${f} ${m}`));
  }
  keys.add(normalizeNavn(`${f} ${l}`));
  keys.add(normalizeNavn(`${l}, ${f}`));
  keys.add(normalizeNavn(`${l} ${f}`));
  return [...keys];
}

function ansattNavnNøkler(a) {
  const keys = new Set();
  keys.add(normalizeNavn(`${a.fornavn} ${a.etternavn}`));
  keys.add(normalizeNavn(`${a.etternavn}, ${a.fornavn}`));
  keys.add(normalizeNavn(`${a.etternavn} ${a.fornavn}`));
  return [...keys];
}

function erPersonKontakt(row) {
  const first = String(row[0] ?? "").trim();
  const last = String(row[2] ?? "").trim();
  if (!first || !last) return false;
  if (SKIP_FIRST.test(first)) return false;
  if (SKIP_LAST.has(normalizeNavn(last))) return false;
  if (/^\d+$/.test(last)) return false;
  if (last.length < 2) return false;
  return true;
}

function lesKontakter(csvPath) {
  const text = fs.readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = parseCsvLine(lines[0]);
  const iFirst = header.indexOf("First Name");
  const iMiddle = header.indexOf("Middle Name");
  const iLast = header.indexOf("Last Name");

  const phoneFields = [];
  for (let n = 1; n <= 10; n++) {
    const iLabel = header.indexOf(`Phone ${n} - Label`);
    const iValue = header.indexOf(`Phone ${n} - Value`);
    if (iLabel >= 0 && iValue >= 0) phoneFields.push({ iLabel, iValue });
  }

  const kontakter = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (!erPersonKontakt(row)) continue;

    let mobil = null;
    for (const { iLabel, iValue } of phoneFields) {
      mobil = parseValidMobil(row[iValue], row[iLabel]);
      if (mobil) break;
    }
    if (!mobil) continue;

    kontakter.push({
      first: row[iFirst],
      middle: row[iMiddle],
      last: row[iLast],
      mobil,
      visning: `${row[iFirst]} ${row[iMiddle] ? row[iMiddle] + " " : ""}${row[iLast]}`.trim(),
    });
  }
  return kontakter;
}

function lesAnsatte() {
  const raw = fs.readFileSync(OUT_PATH, "utf8");
  const m = raw.match(
    /export const IMPORTERTE_ANSATTE_BEMANNING_2026[^=]*=\s*(\[[\s\S]*?\]);/,
  );
  if (!m) throw new Error("Fant ikke ansattliste i " + OUT_PATH);
  return JSON.parse(m[1]);
}

function byggAnsattIndex(ansatte) {
  const index = new Map();
  for (const a of ansatte) {
    for (const key of ansattNavnNøkler(a)) {
      if (!key) continue;
      const list = index.get(key) ?? [];
      list.push(a);
      index.set(key, list);
    }
  }
  return index;
}

function matchAnsatt(kontakt, index) {
  const keys = kontaktNavnNøkler(kontakt.first, kontakt.middle, kontakt.last);
  const treff = new Map();
  for (const key of keys) {
    for (const a of index.get(key) ?? []) {
      treff.set(a.id, a);
    }
  }
  if (treff.size !== 1) return null;
  return [...treff.values()][0];
}

function formatTelefon(parsed) {
  if (parsed.type === "se") {
    const d = parsed.digits;
    return `+46 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
  }
  const d = parsed.digits;
  return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5)}`;
}

function main() {
  const { flags, csvPath } = parseArgs(process.argv);
  if (!fs.existsSync(csvPath)) {
    console.error("Fant ikke CSV:", csvPath);
    process.exit(1);
  }

  const kontakter = lesKontakter(csvPath);
  const ansatte = lesAnsatte();
  const index = byggAnsattIndex(ansatte);

  const oppdatert = [];
  const utenTreff = [];
  const flereTreff = [];
  const uendret = [];

  for (const k of kontakter) {
    const keys = kontaktNavnNøkler(k.first, k.middle, k.last);
    const treff = new Map();
    for (const key of keys) {
      for (const a of index.get(key) ?? []) treff.set(a.id, a);
    }

    if (treff.size === 0) {
      utenTreff.push(k);
      continue;
    }
    if (treff.size > 1) {
      flereTreff.push({
        kontakt: k.visning,
        ansatte: [...treff.values()].map((a) => `${a.fornavn} ${a.etternavn}`),
      });
      continue;
    }

    const ansatt = [...treff.values()][0];
    const ny = formatTelefon(k.mobil);
    if (ansatt.telefon === ny) {
      uendret.push({ ansatt, telefon: ny });
      continue;
    }
    oppdatert.push({
      ansatt,
      gammel: ansatt.telefon || "(tom)",
      ny,
      kontakt: k.visning,
    });
  }

  console.log(`CSV: ${csvPath}`);
  console.log(`Gyldige Mobile-kontakter: ${kontakter.length}`);
  console.log(`Oppdateres: ${oppdatert.length}`);
  console.log(`Uendret (allerede riktig): ${uendret.length}`);
  console.log(`Uten treff: ${utenTreff.length}`);
  console.log(`Flere treff (hoppet over): ${flereTreff.length}`);

  if (oppdatert.length) {
    console.log("\n--- Oppdateringer ---");
    for (const u of oppdatert.sort((a, b) =>
      `${a.ansatt.etternavn} ${a.ansatt.fornavn}`.localeCompare(
        `${b.ansatt.etternavn} ${b.ansatt.fornavn}`,
        "nb",
      ),
    )) {
      console.log(
        `${u.ansatt.fornavn} ${u.ansatt.etternavn}: ${u.gammel} → ${u.ny}`,
      );
    }
  }

  if (utenTreff.length && flags.has("diff")) {
    console.log("\n--- Uten treff (utdrag) ---");
    for (const k of utenTreff.slice(0, 25)) {
      const nr =
        typeof k.mobil === "string"
          ? k.mobil
          : k.mobil.type === "se"
            ? `+46${k.mobil.digits}`
            : k.mobil.digits;
      console.log(`  ${k.visning} (${nr})`);
    }
    if (utenTreff.length > 25) console.log(`  … +${utenTreff.length - 25} til`);
  }

  if (flereTreff.length) {
    console.log("\n--- Flere treff ---");
    for (const f of flereTreff) {
      console.log(`  ${f.kontakt} → ${f.ansatte.join(" / ")}`);
    }
  }

  if (!flags.has("write")) return;

  const oppdatertIds = new Map(oppdatert.map((u) => [u.ansatt.id, u.ny]));
  const nyAnsatte = ansatte.map((a) => {
    const tel = oppdatertIds.get(a.id);
    if (!tel) return a;
    return { ...a, telefon: tel };
  });

  const tsContent = `import type { Ansatt } from "@/lib/domain";

/** Ansatte importert fra Bemanning 2026.xlsx (113 personer). */
export const IMPORTERTE_ANSATTE_BEMANNING_2026: Ansatt[] = ${JSON.stringify(nyAnsatte, null, 2)};
`;

  fs.writeFileSync(OUT_PATH, tsContent, "utf8");
  console.log(`\nSkrev ${oppdatert.length} telefonnumre til ${OUT_PATH}`);
}

main();
