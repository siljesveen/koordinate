import type { FraværType } from "@/lib/domain";
import type { Ansatt } from "@/lib/domain";
import { matchAnsattIdForPlanNavn } from "@/lib/utils/bemanningsplanKobling";
import type { BemanningPlanData } from "@/lib/utils/parseBemanningsplanExcel";

/** Excel-kode for vanlig rutedag — importeres ikke som fravær. */
export const RUTE_EXCEL_KODE = "R";

/** Øk når parser/import-logikk endres — utdaterte lagrede planer må lastes opp på nytt. */
export const PLAN_PARSER_VERSION = 2;

/** Alle Excel-koder unntom R som skal registreres som fravær. */
export function erFraværExcelKode(raw: string): boolean {
  const code = raw.trim().toUpperCase();
  if (!code || code === RUTE_EXCEL_KODE) return false;
  if (/^\d+$/.test(code)) return false;
  return /^[A-ZÆØÅ]{1,3}$/.test(code);
}

export function mapExcelKodeTilFraværType(kode: string): FraværType {
  switch (kode.trim().toUpperCase()) {
    case "S":
      return "Syk";
    case "F":
      return "Ferie";
    case "A":
      return "Avspasering";
    case "K":
    case "T":
    default:
      return "Annet";
  }
}

export function erGyldigPlan(plan: BemanningPlanData | null | undefined): plan is BemanningPlanData {
  return Boolean(plan?.drivers && plan.parserVersion === PLAN_PARSER_VERSION);
}

/** Antall fraværsdager per Excel-kode i opplastet plan (kun koblede ansatte). */
export function tellFraværKoderForKoblede(plan: BemanningPlanData, ansatte: Ansatt[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const driver of Object.values(plan.drivers)) {
    if (!matchAnsattIdForPlanNavn(driver.name, ansatte)) continue;
    for (const code of Object.values(driver.absence ?? {})) {
      const k = String(code).trim().toUpperCase();
      if (!erFraværExcelKode(k)) continue;
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  return counts;
}

/** Antall fraværsdager per Excel-kode i opplastet plan. */
export function tellFraværKoderIPlan(plan: BemanningPlanData): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const driver of Object.values(plan.drivers)) {
    for (const code of Object.values(driver.absence ?? {})) {
      const k = String(code).trim().toUpperCase();
      if (!k) continue;
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  return counts;
}

export function formatFraværKoder(counts: Record<string, number>): string {
  const rekkefølge = ["S", "F", "A", "K", "T"];
  const deler: string[] = [];
  for (const k of rekkefølge) {
    if (counts[k]) deler.push(`${k}:${counts[k]}`);
  }
  for (const [k, n] of Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, "nb"))) {
    if (!rekkefølge.includes(k)) deler.push(`${k}:${n}`);
  }
  return deler.join(", ");
}

export function fraværPeriodeNøkkel(item: Pick<{ ansattId: string; fraDato: string; tilDato: string; type: string }, "ansattId" | "fraDato" | "tilDato" | "type">): string {
  return `${item.ansattId}|${item.fraDato}|${item.tilDato}|${item.type}`;
}

export function tellFraværEtterType(items: Array<{ type: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }
  return counts;
}

export function formatFraværTypeOppsummering(counts: Record<string, number>): string {
  const rekkefølge = ["Syk", "Ferie", "Avspasering", "Annet", "Fri", "Permisjon"];
  const deler: string[] = [];
  for (const type of rekkefølge) {
    if (counts[type]) deler.push(`${type} ${counts[type]}`);
  }
  for (const [type, n] of Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, "nb"))) {
    if (!rekkefølge.includes(type)) deler.push(`${type} ${n}`);
  }
  return deler.join(" · ");
}

function dagerIPeriode(fraDato: string, tilDato: string): number {
  let d = fraDato;
  let count = 0;
  while (d <= tilDato) {
    count += 1;
    const neste = new Date(`${d}T12:00:00`);
    neste.setDate(neste.getDate() + 1);
    const y = neste.getFullYear();
    const m = String(neste.getMonth() + 1).padStart(2, "0");
    const day = String(neste.getDate()).padStart(2, "0");
    d = `${y}-${m}-${day}`;
  }
  return count;
}

/** Antall kalenderdager per Excel-kode i lagret fravær (sammenlignbart med plan). */
export function tellLagredeFraværDager(fravær: Array<{ fraDato: string; tilDato: string; excelKode?: string; type: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of fravær) {
    const kode = item.excelKode?.trim().toUpperCase() || fraværTypeTilExcelKode(item.type);
    if (!kode) continue;
    counts[kode] = (counts[kode] ?? 0) + dagerIPeriode(item.fraDato, item.tilDato);
  }
  return counts;
}

function fraværTypeTilExcelKode(type: string): string | null {
  switch (type) {
    case "Syk":
      return "S";
    case "Ferie":
      return "F";
    case "Avspasering":
      return "A";
    default:
      return null;
  }
}

export function sammenlignFraværKoder(plan: Record<string, number>, lagret: Record<string, number>): string {
  const rekkefølge = ["S", "F", "A", "K", "T"];
  const deler: string[] = [];
  for (const k of rekkefølge) {
    const planN = plan[k] ?? 0;
    const lagretN = lagret[k] ?? 0;
    if (planN === 0 && lagretN === 0) continue;
    const ok = planN === lagretN ? "✓" : "≠";
    deler.push(`${k} plan ${planN} / lagret ${lagretN} ${ok}`);
  }
  return deler.join(" · ");
}

/** Visningstekst i kalender — viser Excel-kode når den finnes (A, T, K …). */
export function fraværVisningsEtikett(item: { type: string; excelKode?: string }): string {
  const kode = item.excelKode?.trim().toUpperCase();
  if (!kode) return item.type;
  if (kode === "S" && item.type === "Syk") return "S · Syk";
  if (kode === "F" && item.type === "Ferie") return "F · Ferie";
  if (kode === "A" && item.type === "Avspasering") return "A · Avspasering";
  return `${kode} · ${item.type}`;
}
