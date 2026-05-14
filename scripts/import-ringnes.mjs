import fs from "fs";
import path from "path";
import XLSX from "xlsx";

/**
 * Importerer uke 1-4 Excel (Ringnes) til et stabilt JSON-datasett:
 * - ruter (rutenummer + navn)
 * - plan per uke(1-4) -> dag(1-7) -> skift(Dag/Kveld) -> ruter
 * - avspasering per uke/dag/skift (navn, as-is)
 *
 * Kjøring (PowerShell):
 *   node scripts/import-ringnes.mjs --out lib/imported/ringnes-cycle.json --base \"C:\\Users\\<deg>\\Downloads\"
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
const outPath = String(args.get("--out") ?? "lib/imported/ringnes-cycle.json");

const files = [
  { uke: 1, name: "Uke 1 fra 19.02.26 Ringnes.xlsx" },
  { uke: 2, name: "Uke 2 fra  19.02.26 Ringnes.xlsx" },
  { uke: 3, name: "Uke 3 fra 19.2.26 Ringnes.xlsx" },
  { uke: 4, name: "Uke 4 fra 19.2.26 Ringnes.xlsx" },
];

const DAY_NAMES = [
  { day: 1, key: "Mandag" },
  { day: 2, key: "Tirsdag" },
  { day: 3, key: "Onsdag" },
  { day: 4, key: "Torsdag" },
  { day: 5, key: "Fredag" },
  { day: 6, key: "Lørdag" },
];

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
  // rutenummer kan være "1128-1", "6110-2", "6152-12" etc.
  return /^[0-9][0-9][0-9][0-9](?:-[0-9]+)?$/.test(t);
}

function routeDayAndShift(routeId) {
  const t = normalizeStr(routeId);
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
  if (!skift) return { day, skift: "Ukjent" };
  return { day, skift };
}

function findSundayBlockStart(rows) {
  // Søndag ligger som en ny tabell under lørdag og starter med en linje som har "SØNDAG" i kolonne A.
  for (let i = 0; i < rows.length; i++) {
    const a = normalizeStr(rows[i]?.[0]).toUpperCase();
    if (a === "SØNDAG" || a.startsWith("SØNDAG ")) {
      // neste relevante header-linje kommer ofte rett etter
      return i;
    }
  }
  return -1;
}

function parseTableBlock(rows, startRowIdx) {
  // Finn header og map kolonner
  let headerIdx = -1;
  for (let i = startRowIdx; i < rows.length; i++) {
    if (isHeaderRow(rows[i] ?? [])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return { items: [], avspasering: [] };

  const header = rows[headerIdx].map(normalizeStr);
  const colRoute = header.findIndex((h) => h.toUpperCase() === "RUTE");
  const colName = header.findIndex((h) => h.toUpperCase().includes("RUTENAVN"));
  const colDriver = header.findIndex((h) => h.toUpperCase().includes("SJÅFØR"));

  const items = [];
  const avsp = new Set();
  const tilgjengelige = new Set();
  const labelHits = [];

  function harvestNameListAt(labelRowIdx, labelColIdx, targetSet) {
    // 1) samme rad, celler til høyre
    const row = rows[labelRowIdx] ?? [];
    for (let j = labelColIdx + 1; j < row.length; j++) {
      const name = normalizeStr(row[j]);
      if (name) targetSet.add(name);
    }

    // 2) rader nedover, celler i "området" til høyre
    for (let rr = labelRowIdx + 1; rr < Math.min(rows.length, labelRowIdx + 80); rr++) {
      const downRow = rows[rr] ?? [];
      const a = normalizeStr(downRow[0]).toUpperCase();
      if (a === "SØNDAG" || a === "LØRDAG" || isHeaderRow(downRow)) break;

      // Stopp hvis vi treffer en ny label i samme kolonne (Avspasering/Tilgjengelige)
      const sameCol = normalizeStr(downRow[labelColIdx]).toLowerCase();
      if (sameCol.startsWith("avspasering") || sameCol.startsWith("tilgjengelige")) break;

      for (let j = labelColIdx + 1; j < downRow.length; j++) {
        const name = normalizeStr(downRow[j]);
        if (!name) continue;
        if (looksLikeRouteId(name)) continue;
        targetSet.add(name);
      }
    }
  }

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const routeId = normalizeStr(row[colRoute]);
    const routeName = normalizeStr(row[colName]);
    const driver = normalizeStr(row[colDriver]);

    // Tilgjengelige kan ligge i høyre del av rader, plukk opp liste fra label-posisjon
    for (let c = 0; c < row.length; c++) {
      const v = normalizeStr(row[c]);
      if (!v) continue;
      const low = v.toLowerCase();
      if (low.startsWith("tilgjengelige")) {
        labelHits.push({ type: "tilgjengelige", row: r + 1, col: c + 1, text: v });
        harvestNameListAt(r, c, tilgjengelige);
      }
    }

    if (!routeId && !routeName && !driver) continue;
    if (!looksLikeRouteId(routeId)) {
      // stopp når vi kommer til en ny blokk (typisk mye tomme rader)
      const anyText = row.some((cell) => normalizeStr(cell));
      if (!anyText) continue;
      // ellers ignorer ukjent rad
      continue;
    }

    items.push({
      rute: routeId,
      rutenavn: routeName,
      sjåfør: driver || null,
    });
  }

  // Avspasering: leses fast fra kolonne 11 og nedover (til 2 tomme rader).
  // Kolonne 11 i Excel => index 10 her.
  const AVSP_COL_IDX = 10;
  let avspLabelRow = -1;
  for (let r = startRowIdx; r < rows.length; r++) {
    const v = normalizeStr((rows[r] ?? [])[AVSP_COL_IDX]);
    if (v.toLowerCase().startsWith("avspasering")) {
      avspLabelRow = r;
      labelHits.push({ type: "avspasering", row: r + 1, col: AVSP_COL_IDX + 1, text: v });
      break;
    }
  }

  if (avspLabelRow >= 0) {
    let emptyStreak = 0;
    for (let r = avspLabelRow + 1; r < rows.length; r++) {
      const cell = normalizeStr((rows[r] ?? [])[AVSP_COL_IDX]);

      // Vi stopper også hvis vi tydelig går inn i en ny blokk/dag
      const a = normalizeStr((rows[r] ?? [])[0]).toUpperCase();
      if (a === "SØNDAG" || a === "LØRDAG" || isHeaderRow(rows[r] ?? [])) break;

      if (!cell) {
        emptyStreak++;
        if (emptyStreak >= 2) break;
        continue;
      }
      emptyStreak = 0;

      // Ikke ta med noe som ser ut som en rute-id.
      if (looksLikeRouteId(cell)) continue;
      avsp.add(cell);
    }
  }

  return {
    items,
    avspasering: Array.from(avsp),
    tilgjengelige: Array.from(tilgjengelige),
    labelHits,
  };
}

function readSheetRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

const allRoutes = new Map(); // rute -> rutenavn
const cycle = {}; // uke -> day -> shift -> { routes, avspasering, tilgjengelige? }
const debugLabels = []; // { uke, sheet, day, block, type, row, col, text }

for (const f of files) {
  const fp = path.join(baseDir, f.name);
  if (!fs.existsSync(fp)) {
    console.error("Mangler fil:", fp);
    process.exitCode = 1;
    continue;
  }

  const wb = XLSX.read(fs.readFileSync(fp), { type: "buffer" });
  cycle[f.uke] = cycle[f.uke] ?? {};

  for (const d of DAY_NAMES) {
    const rows = readSheetRows(wb, d.key);
    if (!rows.length) continue;

    // Vanlig blokk
    const main = parseTableBlock(rows, 0);
    for (const hit of main.labelHits ?? []) {
      debugLabels.push({ uke: f.uke, sheet: d.key, day: d.day, block: "main", ...hit });
    }
    for (const it of main.items) {
      if (it.rute && it.rutenavn && !allRoutes.has(it.rute)) allRoutes.set(it.rute, it.rutenavn);
      const ds = routeDayAndShift(it.rute);
      if (!ds) continue;
      const day = ds.day;
      const skift = ds.skift;
      cycle[f.uke][day] = cycle[f.uke][day] ?? {};
      cycle[f.uke][day][skift] = cycle[f.uke][day][skift] ?? { ruter: [], avspasering: [] };
      cycle[f.uke][day][skift].ruter.push(it);
    }
    // Avspasering: vi vet ikke skift på lista (ofte gjelder hele dagen), legg på begge skift
    if (main.avspasering.length) {
      for (const day of [d.day]) {
        for (const skift of ["Dag", "Kveld"]) {
          cycle[f.uke][day] = cycle[f.uke][day] ?? {};
          cycle[f.uke][day][skift] = cycle[f.uke][day][skift] ?? { ruter: [], avspasering: [] };
          cycle[f.uke][day][skift].avspasering = Array.from(
            new Set([...cycle[f.uke][day][skift].avspasering, ...main.avspasering]),
          );
        }
      }
    }
    // Tilgjengelige: gjelder typisk hele dagen, legg på begge skift
    if (main.tilgjengelige.length) {
      for (const day of [d.day]) {
        for (const skift of ["Dag", "Kveld"]) {
          cycle[f.uke][day] = cycle[f.uke][day] ?? {};
          cycle[f.uke][day][skift] = cycle[f.uke][day][skift] ?? { ruter: [], avspasering: [] };
          cycle[f.uke][day][skift].tilgjengelige = Array.from(
            new Set([...(cycle[f.uke][day][skift].tilgjengelige ?? []), ...main.tilgjengelige]),
          );
        }
      }
    }

    // Søndag ligger under lørdag-arket
    if (d.day === 6) {
      const sundayStart = findSundayBlockStart(rows);
      if (sundayStart >= 0) {
        const sunday = parseTableBlock(rows, sundayStart);
        for (const hit of sunday.labelHits ?? []) {
          debugLabels.push({ uke: f.uke, sheet: d.key, day: 7, block: "sunday", ...hit });
        }
        for (const it of sunday.items) {
          if (it.rute && it.rutenavn && !allRoutes.has(it.rute)) allRoutes.set(it.rute, it.rutenavn);
          const ds = routeDayAndShift(it.rute);
          if (!ds) continue;
          const day = ds.day; // forventer 7
          const skift = ds.skift;
          cycle[f.uke][day] = cycle[f.uke][day] ?? {};
          cycle[f.uke][day][skift] = cycle[f.uke][day][skift] ?? { ruter: [], avspasering: [] };
          cycle[f.uke][day][skift].ruter.push(it);
        }
        if (sunday.avspasering.length) {
          for (const skift of ["Dag", "Kveld"]) {
            cycle[f.uke][7] = cycle[f.uke][7] ?? {};
            cycle[f.uke][7][skift] = cycle[f.uke][7][skift] ?? { ruter: [], avspasering: [] };
            cycle[f.uke][7][skift].avspasering = Array.from(
              new Set([...cycle[f.uke][7][skift].avspasering, ...sunday.avspasering]),
            );
          }
        }
        if (sunday.tilgjengelige.length) {
          for (const skift of ["Dag", "Kveld"]) {
            cycle[f.uke][7] = cycle[f.uke][7] ?? {};
            cycle[f.uke][7][skift] = cycle[f.uke][7][skift] ?? { ruter: [], avspasering: [] };
            cycle[f.uke][7][skift].tilgjengelige = Array.from(
              new Set([...(cycle[f.uke][7][skift].tilgjengelige ?? []), ...sunday.tilgjengelige]),
            );
          }
        }
      }
    }
  }
}

const routes = Array.from(allRoutes.entries())
  .map(([rute, rutenavn]) => ({ rute, rutenavn }))
  .sort((a, b) => a.rute.localeCompare(b.rute, "nb"));

const out = {
  meta: {
    format: "ringnes-cycle-v1",
    generatedAt: new Date().toISOString(),
    source: files.map((f) => f.name),
  },
  routes,
  cycle,
  debugLabels,
};

const fullOut = path.isAbsolute(outPath)
  ? outPath
  : path.join(process.cwd(), outPath.replaceAll("/", path.sep));
fs.mkdirSync(path.dirname(fullOut), { recursive: true });
fs.writeFileSync(fullOut, JSON.stringify(out, null, 2), "utf8");
console.log("Skrev:", fullOut);
console.log("Ruter:", routes.length);
