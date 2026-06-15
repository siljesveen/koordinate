/**
 * Analyse: Uke 1 plan vs ansattliste vs ringnes masterplan-slots.
 * Kjør: node scripts/analyser-uke1-masterplan.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const XLSX_PATH =
  process.argv[2] ??
  "C:\\Users\\sisvee7\\Downloads\\Uke 1 fra 19.02.26 Ringnes.xlsx";

const ansatte = loadAnsatte();
const RINGNES_CYCLE = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib/imported/ringnes-cycle.json"), "utf8"),
);

function loadAnsatte() {
  const ts = fs.readFileSync(
    path.join(ROOT, "lib/imported/ansatte-bemanning-2026.ts"),
    "utf8",
  );
  const m = ts.match(
    /export const IMPORTERTE_ANSATTE_BEMANNING_2026[^=]*=\s*(\[[\s\S]*?\]);/,
  );
  if (!m) throw new Error("Kunne ikke lese ansattliste fra TS-fil");
  return JSON.parse(m[1]);
}

function normaliser(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae")
    .trim();
}

function fullNavn(a) {
  return `${a.fornavn} ${a.etternavn}`.trim();
}

const IKKE_PERSON = new Set([
  "",
  "avspasering:",
  "tilgjengelig:",
  "bring 1",
  "bring 2",
  "bring 3",
  "gdf",
  "gdf 1",
  "gdf 2",
  "gdf 3",
  "gdf1",
  "gdf2",
  "gdf3",
  "tf1",
  "tf2",
  "tf3",
  "vd rute",
  "vd/sesong",
  "sesong",
  "ledig kveld",
  "(sesong)",
]);

function erIkkePerson(navn) {
  const n = normaliser(navn).replace(/\.$/, "");
  if (IKKE_PERSON.has(n)) return true;
  if (/^bring\s*\d/i.test(navn)) return true;
  if (/^gdf\s*\d/i.test(navn)) return true;
  if (/^tf\d/i.test(navn)) return true;
  if (/rute$/i.test(String(navn).trim())) return true;
  if (/^sesong/i.test(navn)) return true;
  if (/^\(sesong\)$/i.test(String(navn).trim())) return true;
  return false;
}

function routeDayAndShift(routeId) {
  const t = String(routeId ?? "").trim();
  const m = t.match(/^(\d)(\d)/);
  if (!m) return null;
  const day = Number(m[1]);
  const shiftDigit = Number(m[2]);
  if (!(day >= 1 && day <= 7)) return null;
  const skift =
    shiftDigit === 1 || shiftDigit === 5
      ? "Dag"
      : shiftDigit === 2 || shiftDigit === 7 || shiftDigit === 8
        ? "Kveld"
        : null;
  return { day, skift: skift ?? "Ukjent" };
}

function parseTid(raw) {
  if (raw === null || raw === undefined || raw === "") return null;

  const somExcelDøgnbrøk = (n) => {
    if (!Number.isFinite(n) || n < 0 || n >= 1) return null;
    const totalMinutes = Math.round(n * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  if (typeof raw === "number") {
    return somExcelDøgnbrøk(raw);
  }

  const str = String(raw).trim();
  const asNum = Number(str.replace(",", "."));
  if (str !== "" && Number.isFinite(asNum)) {
    const fraBrøk = somExcelDøgnbrøk(asNum);
    if (fraBrøk) return fraBrøk;
  }

  if (/^\d{3,4}$/.test(str)) {
    const s = str.padStart(4, "0");
    return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
  }

  const t = str.replace(".", ":");
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

const DAG_NAVN = {
  1: "Man",
  2: "Tir",
  3: "Ons",
  4: "Tor",
  5: "Fre",
  6: "Lør",
  7: "Søn",
};

/** Bekreftet av bruker — plan-navn → ansatt-id */
const BEKREFTET_ALIAS = {
  josse: "a-john-arne-johnsen",
  rufad: "a-ferad-mehmed-rufad",
  bakshi: "a-mohammad-bakhshi",
  oivind: "a-yvind-hagen",
  arturs: "a-arturs-dambrovskis",
  "ivan j": "a-ivan-morgan-johansen",
  "roger m": "a-roger-moseng",
  "roger s": "a-roger-haug-skogheim",
  "john o": "a-john-olav-lundstad",
  pelle: "a-per-ola-ake-lundgren",
  frode: "a-frode-degardstuen",
  "andre o": "a-andre-stli",
  "thomas o": "a-thomas-yen",
  "frode o": "a-frode-degardstuen",
  "morten b": "a-morten-bakken",
  "trond h": "a-trond-hagen",
  "rune b": "a-rune-berntsen",
};

const ansattById = new Map(ansatte.map((a) => [a.id, a]));

function aliasNøkkel(navn) {
  return normaliser(navn).replace(/\s+/g, " ").trim();
}

function matchAnsatt(pdfNavn) {
  if (erIkkePerson(pdfNavn)) {
    return { type: "hopp_over", grunn: "ikke_person" };
  }

  const rå = String(pdfNavn).trim();
  const aliasId = BEKREFTET_ALIAS[aliasNøkkel(rå)];
  if (aliasId) {
    const ansatt = ansattById.get(aliasId);
    if (ansatt) {
      return { type: "match", ansatt, pdfNavn: rå, via: "bekreftet_alias" };
    }
  }
  const deler = rå.split(/\s+/);
  const fornavnDel = deler[0];
  const initial = deler[1]?.replace(/\.$/, "");

  const kandidater = ansatte.filter((a) => {
    const fn = normaliser(a.fornavn);
    const en = normaliser(a.etternavn);
    const hele = normaliser(fullNavn(a));
    const pdfFn = normaliser(fornavnDel);

    const fornavnOrd = fn.split(/\s+/);
    if (fornavnOrd[0] === pdfFn || fn.startsWith(pdfFn + " ")) {
      if (initial) {
        return (
          en.startsWith(normaliser(initial)) ||
          hele.includes(normaliser(initial)) ||
          fn.includes(normaliser(initial))
        );
      }
      return true;
    }

    if (pdfFn === "chien" && fn.includes("cien")) return true;
    if (pdfFn === "pelle" && fn.startsWith("per ola")) return true;
    if (pdfFn === "juri" && fn.startsWith("jurij")) return true;
    if (pdfFn === "dawid" && fn.startsWith("david")) return true;
    if (pdfFn === "hakon" && fn.startsWith("hakon")) return true;
    if (pdfFn === "morten" && initial === "B" && en.startsWith("bak")) return true;
    if (pdfFn === "roger" && initial === "M" && en === "moseng") return true;
    if (pdfFn === "roger" && initial === "S" && en === "skogheim" && !fn.includes("haug"))
      return true;
    if (pdfFn === "thomas" && (initial === "O" || initial === "Ø") && en.startsWith("oy"))
      return true;
    if (pdfFn === "andre" && (initial === "O" || initial === "Ø") && en.startsWith("ost"))
      return true;
    if (pdfFn === "frode" && (initial === "O" || initial === "Ø") && en.includes("deg"))
      return true;
    if (pdfFn === "john" && initial === "O" && fn.includes("olav") && en === "lundstad")
      return true;
    if (pdfFn === "john" && initial === "J" && fn.includes("morgan")) return true;
    if (pdfFn === "morten" && initial === "S" && en.startsWith("stein")) return true;
    if ((pdfFn === "jorn" || pdfFn === "jorn") && initial === "S" && en.startsWith("sanak"))
      return true;
    if (pdfFn === "rune" && initial?.toLowerCase().startsWith("b") && en.startsWith("ber"))
      return true;
    if (pdfFn === "trond" && initial === "H" && en.startsWith("hag")) return true;
    if (pdfFn === "arnt" && deler[1]?.toLowerCase() === "georg") {
      return fn.includes("arnt") && en.includes("georg");
    }
    if (pdfFn === "ronny" && en === "ronny") return true;
    if (pdfFn === "stein" && initial === "A" && fn.includes("arve")) return true;
    if (pdfFn === "stein" && normaliser(deler.slice(1).join(" ")).includes("arve"))
      return fn.includes("arve");
    if (pdfFn === "rune" && initial === "B" && en.startsWith("bje")) return true;
    if (pdfFn === "amund" && fn.startsWith("amund")) return true;
    if (pdfFn === "jack" && fn === "jack") return true;
    if (pdfFn === "josse") return a.id === "a-john-arne-johnsen";
    if (pdfFn === "rufad") return a.id === "a-ferad-mehmed-rufad";
    if (pdfFn === "bakshi") return a.id === "a-mohammad-bakhshi";
    if (pdfFn === "oivind") return a.id === "a-yvind-hagen";

    return false;
  });

  if (kandidater.length === 0) {
    return { type: "ukjent", pdfNavn: rå };
  }
  if (kandidater.length === 1) {
    return { type: "match", ansatt: kandidater[0], pdfNavn: rå };
  }
  return {
    type: "tvetydig",
    pdfNavn: rå,
    kandidater: kandidater.map((a) => ({ id: a.id, navn: fullNavn(a) })),
  };
}

function normalizeStr(v) {
  return String(v ?? "").replace(/\r?\n/g, " ").trim();
}

function isHeaderRow(row) {
  const a = normalizeStr(row[0]).toUpperCase();
  const b = normalizeStr(row[1]).toUpperCase();
  const c = normalizeStr(row[2]).toUpperCase();
  return a === "RUTE" && b.includes("RUTENAVN") && c.includes("SJÅFØR");
}

function looksLikeRouteId(s) {
  const t = normalizeStr(s);
  if (!t) return false;
  return /^[0-9][0-9][0-9][0-9](?:-[0-9]+)?$/.test(t);
}

function parseTableBlock(rows, startRowIdx, sheetDay) {
  let headerIdx = -1;
  for (let i = startRowIdx; i < rows.length; i++) {
    if (isHeaderRow(rows[i] ?? [])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const header = rows[headerIdx].map(normalizeStr);
  const colRoute = header.findIndex((h) => h.toUpperCase() === "RUTE");
  const colName = header.findIndex((h) => h.toUpperCase().includes("RUTENAVN"));
  const colDriver = header.findIndex((h) => h.toUpperCase().includes("SJÅFØR"));
  const colAvgang = header.findIndex((h) => h.toUpperCase().includes("AVGANG"));

  const items = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const routeId = normalizeStr(row[colRoute]);
    const routeName = normalizeStr(row[colName]);
    const driver = normalizeStr(row[colDriver]);
    const avgang = parseTid(normalizeStr(row[colAvgang]));

    if (!routeId && !routeName && !driver) continue;
    if (!looksLikeRouteId(routeId)) {
      const anyText = row.some((cell) => normalizeStr(cell));
      if (!anyText) continue;
      continue;
    }

    const ds = routeDayAndShift(routeId);
    if (!ds || ds.skift === "Ukjent") continue;

    items.push({
      dag: ds.day || sheetDay,
      skift: ds.skift,
      rutekode: routeId,
      rutenavn: routeName,
      sjåfør: driver || "",
      startTid: avgang,
    });
  }

  return items;
}

function findSundayBlockStart(rows) {
  for (let i = 0; i < rows.length; i++) {
    const a = normalizeStr(rows[i]?.[0]).toUpperCase();
    if (a === "SØNDAG" || a.startsWith("SØNDAG ")) return i;
  }
  return -1;
}

function parseUke1Xlsx(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Mangler fil: ${filePath}`);
  }

  const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
  const daySheets = [
    { day: 1, key: "Mandag" },
    { day: 2, key: "Tirsdag" },
    { day: 3, key: "Onsdag" },
    { day: 4, key: "Torsdag" },
    { day: 5, key: "Fredag" },
    { day: 6, key: "Lørdag" },
  ];

  const rader = [];

  for (const d of daySheets) {
    const ws = wb.Sheets[d.key];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    rader.push(...parseTableBlock(rows, 0, d.day));

    if (d.day === 6) {
      const sundayStart = findSundayBlockStart(rows);
      if (sundayStart >= 0) {
        rader.push(...parseTableBlock(rows, sundayStart, 7));
      }
    }
  }

  return rader;
}

function byggMasterSlotsUke1() {
  const slots = [];
  const uke1 = RINGNES_CYCLE.cycle?.["1"] ?? {};
  for (const [dagStr, skiftMap] of Object.entries(uke1)) {
    for (const [skiftStr, skiftPlan] of Object.entries(skiftMap)) {
      for (const rute of skiftPlan.ruter ?? []) {
        slots.push({
          uke: 1,
          dag: Number(dagStr),
          skift: skiftStr,
          rutekode: rute.rute.trim(),
          rutenavn: rute.rutenavn,
          sjåførTekst: rute.sjåfør,
        });
      }
    }
  }
  return slots;
}

function slotKey(s) {
  return `${s.dag}|${s.skift}|${s.rutekode}`;
}

function ansattNavnMatcherBaseline(ansatt, baselineTekst) {
  if (!baselineTekst) return false;
  const b = normaliser(baselineTekst);
  const fn = normaliser(ansatt.fornavn);
  const en = normaliser(ansatt.etternavn);
  const hele = normaliser(fullNavn(ansatt));
  if (b === hele || b === fn) return true;
  if (hele.startsWith(b + " ") || fn.startsWith(b)) return true;
  if (b.startsWith(fn.split(" ")[0])) return true;
  return false;
}

function main() {
  const planRader = parseUke1Xlsx(XLSX_PATH);
  const masterSlots = byggMasterSlotsUke1();
  const masterByKey = new Map(masterSlots.map((s) => [slotKey(s), s]));

  const matcht = [];
  const ukjente = [];
  const tvetydige = [];
  const hoppOver = [];
  const avvikSjåfør = [];
  const utenSjåførIPlan = [];
  const manglerSlot = [];

  for (const rad of planRader) {
    const key = slotKey(rad);
    const baseline = masterByKey.get(key);
    const m = matchAnsatt(rad.sjåfør);

    if (!baseline) {
      manglerSlot.push(rad);
    }

    if (m.type === "hopp_over") {
      hoppOver.push({ ...rad, grunn: rad.sjåfør || "tom" });
      if (baseline?.sjåførTekst && !erIkkePerson(baseline.sjåførTekst)) {
        utenSjåførIPlan.push({
          ...rad,
          merknad: `Plan har «${baseline.sjåførTekst}», PDF/Excel har kode/tom`,
        });
      }
      continue;
    }

    if (m.type === "ukjent") {
      ukjente.push({ ...rad, pdfSjåfør: rad.sjåfør });
      continue;
    }

    if (m.type === "tvetydig") {
      tvetydige.push({ ...rad, ...m });
      continue;
    }

    const ansattNavn = fullNavn(m.ansatt);
    const entry = {
      ...rad,
      ansatt: m.ansatt,
      ansattNavn,
      baselineSjåfør: baseline?.sjåførTekst ?? null,
    };
    matcht.push(entry);

    if (baseline?.sjåførTekst && !ansattNavnMatcherBaseline(m.ansatt, baseline.sjåførTekst)) {
      avvikSjåfør.push({
        dag: DAG_NAVN[rad.dag],
        skift: rad.skift,
        rutekode: rad.rutekode,
        planSjåfør: baseline.sjåførTekst,
        pdfSjåfør: rad.sjåfør,
        foreslåttAnsatt: ansattNavn,
        startTid: rad.startTid,
      });
    }
  }

  // Slots i baseline uten match i plan (sjelden)
  const planKeys = new Set(planRader.map(slotKey));
  const baselineUtenPlan = masterSlots.filter((s) => !planKeys.has(slotKey(s)));

  console.log("=== UKE 1 MASTERPLAN — ANALYSE (KUN RAPPORT) ===\n");
  console.log(`Kilde: ${XLSX_PATH}`);
  console.log(`Plan-rader (Excel uke 1): ${planRader.length}`);
  console.log(`Masterplan-slots uke 1 (ringnes baseline): ${masterSlots.length}`);
  console.log(`Matchede sjåfører: ${matcht.length}`);
  console.log(`Hoppet over (Bring/TF/GDF/tom): ${hoppOver.length}`);
  console.log(`Ukjente navn: ${ukjente.length}`);
  console.log(`Tvetydige navn: ${tvetydige.length}`);
  console.log(`Avvik vs baseline sjåførtekst: ${avvikSjåfør.length}`);
  console.log(`Ruter uten slot i baseline: ${manglerSlot.length}`);

  if (ukjente.length) {
    console.log("\n--- UKJENTE NAVN ---");
    const unike = [...new Set(ukjente.map((u) => u.pdfSjåfør))].sort();
    for (const n of unike) {
      const ant = ukjente.filter((u) => u.pdfSjåfør === n).length;
      console.log(`  ${n} (${ant} ruter)`);
    }
  }

  if (tvetydige.length) {
    console.log("\n--- TVETYDIGE (trenger din bekreftelse) ---");
    const seen = new Set();
    for (const t of tvetydige) {
      if (seen.has(t.pdfNavn)) continue;
      seen.add(t.pdfNavn);
      console.log(`  "${t.pdfNavn}" → ${t.kandidater.map((k) => k.navn).join(" | ")}`);
    }
  }

  if (avvikSjåfør.length) {
    console.log("\n--- AVVIK MOT BASELINE (første 20) ---");
    for (const a of avvikSjåfør.slice(0, 20)) {
      console.log(
        `  ${a.dag} ${a.skift} ${a.rutekode}: baseline «${a.planSjåfør}» → PDF «${a.pdfSjåfør}» (${a.foreslåttAnsatt})`,
      );
    }
    if (avvikSjåfør.length > 20) {
      console.log(`  ... og ${avvikSjåfør.length - 20} til`);
    }
  }

  const outPath = path.join(ROOT, "lib/imported/uke1-analyse-rapport.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generert: new Date().toISOString(),
        kilde: XLSX_PATH,
        statistikk: {
          planRader: planRader.length,
          baselineSlots: masterSlots.length,
          matcht: matcht.length,
          ukjente: ukjente.length,
          tvetydige: tvetydige.length,
          hoppOver: hoppOver.length,
          avvikSjåfør: avvikSjåfør.length,
          manglerSlot: manglerSlot.length,
        },
        ukjenteNavn: [...new Set(ukjente.map((u) => u.pdfSjåfør))],
        tvetydige: tvetydige.map((t) => ({
          pdfNavn: t.pdfNavn,
          kandidater: t.kandidater,
          ruter: tvetydige
            .filter((x) => x.pdfNavn === t.pdfNavn)
            .map((x) => ({
              dag: DAG_NAVN[x.dag],
              skift: x.skift,
              rutekode: x.rutekode,
              startTid: x.startTid,
            })),
        })),
        avvikSjåfør,
        matcht: matcht.map((m) => ({
          dag: DAG_NAVN[m.dag],
          skift: m.skift,
          rutekode: m.rutekode,
          startTid: m.startTid,
          pdfSjåfør: m.sjåfør,
          ansattNavn: m.ansattNavn,
          ansattId: m.ansatt.id,
          fastBilId: m.ansatt.fastBilId ?? null,
          fastHengerId: m.ansatt.fastHengerId ?? null,
          baselineSjåfør: m.baselineSjåfør,
        })),
        hoppOver: hoppOver.map((h) => ({
          dag: DAG_NAVN[h.dag],
          skift: h.skift,
          rutekode: h.rutekode,
          startTid: h.startTid,
          grunn: h.grunn,
        })),
        ukjente: ukjente.map((u) => ({
          dag: DAG_NAVN[u.dag],
          skift: u.skift,
          rutekode: u.rutekode,
          startTid: u.startTid,
          pdfSjåfør: u.pdfSjåfør,
        })),
        baselineUtenPlan: baselineUtenPlan.map((s) => ({
          dag: DAG_NAVN[s.dag],
          skift: s.skift,
          rutekode: s.rutekode,
          sjåførTekst: s.sjåførTekst,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`\nDetaljrapport skrevet: ${outPath}`);
}

main();
