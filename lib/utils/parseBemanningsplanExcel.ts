import * as XLSX from "xlsx";
import { erFraværExcelKode, PLAN_PARSER_VERSION } from "@/lib/utils/bemanningsplanKoder";

export type BemanningPlanDriver = {
  name: string;
  absence: Record<string, string>;
  /** Excel-cellekommentarer per dato (f.eks. «Kontroll sykehus»). */
  absenceComments?: Record<string, string>;
};

export type BemanningPlanData = {
  generated: string;
  year: number;
  fileName: string;
  sheetName: string;
  /** Versjon av parser — må matche PLAN_PARSER_VERSION. */
  parserVersion: number;
  drivers: Record<string, BemanningPlanDriver>;
};

const MÅNEDER: Array<[string, number]> = [
  ["januar", 1],
  ["februar", 2],
  ["mars", 3],
  ["april", 4],
  ["mai", 5],
  ["juni", 6],
  ["juli", 7],
  ["august", 8],
  ["september", 9],
  ["oktober", 10],
  ["november", 11],
  ["desember", 12],
];

const SKIP_RADER = new Set([
  "Dag",
  "Dato",
  "Fri",
  "Avspas innarb.",
  "Syke",
  "Tilgjenglige",
  "Tilgjengelige",
  "Behov",
  "Dif",
  "Uke",
  "Lærlinger",
  "Vikarer",
  "Støtte",
  "UKEPLANER",
  "",
]);

function månedFraCelle(celle: unknown): number | null {
  const t = String(celle ?? "")
    .trim()
    .toLowerCase();
  for (const [navn, nr] of MÅNEDER) {
    if (t.startsWith(navn)) return nr;
  }
  return null;
}

function erPersonNavn(name: string): boolean {
  if (!name || name.length < 3) return false;
  if (SKIP_RADER.has(name)) return false;
  if (/^uke/i.test(name)) return false;
  if (!/[a-zæøå]/i.test(name)) return false;
  return true;
}

function byggKolonneDatoer(
  monthRow: unknown[],
  datoRow: unknown[],
  year: number,
): Array<string | null> {
  let currentMonth: number | null = null;
  let prevDay: number | null = null;
  const colDates: Array<string | null> = [];

  for (let c = 1; c < datoRow.length; c++) {
    const måned = månedFraCelle(monthRow[c]);
    if (måned != null) {
      currentMonth = måned;
      prevDay = null;
    }

    const day = Number(datoRow[c]);
    if (!day || day < 1 || day > 31) continue;
    if (currentMonth == null) continue;

    if (prevDay != null && day < prevDay && måned == null) {
      currentMonth += 1;
      if (currentMonth > 12) currentMonth = 1;
    }

    prevDay = day;
    const mm = String(currentMonth).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    colDates[c] = `${year}-${mm}-${dd}`;
  }

  return colDates;
}

function hentCelleKommentar(cell: XLSX.CellObject | undefined): string | undefined {
  const kommentarer = cell?.c;
  if (!kommentarer?.length) return undefined;
  const deler = kommentarer
    .map((k) =>
      String(k.t ?? "")
        .replace(/\r?\n/g, " ")
        .trim(),
    )
    .filter(Boolean);
  return deler.length ? deler.join(" ") : undefined;
}

function slåSammenKommentar(eksisterende: string | undefined, ny: string): string {
  if (!eksisterende) return ny;
  if (eksisterende.includes(ny)) return eksisterende;
  return `${eksisterende}; ${ny}`;
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  year: number,
): Record<string, BemanningPlanDriver> {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  const monthRow = rows[0] ?? [];
  const datoRow = rows[5] ?? [];
  const colDates = byggKolonneDatoer(monthRow, datoRow, year);
  const drivers: Record<string, BemanningPlanDriver> = {};

  for (let r = 12; r < rows.length; r++) {
    const name = String(rows[r]?.[0] ?? "").trim();
    if (!erPersonNavn(name)) continue;

    const absence: Record<string, string> = {};
    const absenceComments: Record<string, string> = {};
    const row = rows[r] ?? [];

    for (let c = 1; c < row.length; c++) {
      const dato = colDates[c];
      if (!dato || !dato.startsWith(String(year))) continue;
      const code = String(row[c] ?? "")
        .trim()
        .toUpperCase();
      if (!erFraværExcelKode(code)) continue;

      absence[dato] = code;

      const addr = XLSX.utils.encode_cell({ r, c });
      const kommentar = hentCelleKommentar(sheet[addr]);
      if (kommentar) {
        absenceComments[dato] = slåSammenKommentar(absenceComments[dato], kommentar);
      }
    }

    drivers[name] = {
      name,
      absence,
      ...(Object.keys(absenceComments).length ? { absenceComments } : {}),
    };
  }

  return drivers;
}

function finnPlanArk(wb: XLSX.WorkBook): string {
  const prioritet = wb.SheetNames.find((s) => /bemanning plan/i.test(s));
  return prioritet ?? wb.SheetNames[0] ?? "Bemanning plan 2025";
}

function utledÅr(fileName: string): number {
  const m = fileName.match(/20\d{2}/);
  return m ? Number(m[0]) : new Date().getFullYear();
}

export function parseBemanningsplanExcel(
  buffer: ArrayBuffer,
  fileName: string,
): BemanningPlanData {
  const wb = XLSX.read(buffer, {
    type: "array",
    cellComments: true,
  } as XLSX.ParsingOptions);
  const sheetName = finnPlanArk(wb);
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Fant ikke bemanningsark i «${fileName}».`);
  }

  const year = utledÅr(fileName);
  const drivers = parseSheet(sheet, year);

  if (Object.keys(drivers).length === 0) {
    throw new Error(`Ingen sjåfører funnet i «${fileName}». Sjekk at riktig fil er valgt.`);
  }

  return {
    generated: new Date().toISOString().slice(0, 10),
    year,
    fileName,
    sheetName,
    parserVersion: PLAN_PARSER_VERSION,
    drivers,
  };
}
