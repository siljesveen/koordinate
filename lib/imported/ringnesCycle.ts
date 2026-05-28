import cycleJson from "./ringnes-cycle.json";

export type Skift = "Dag" | "Kveld" | "Ukjent";

export type RingnesRuteRef = {
  rute: string;
  rutenavn: string;
};

export type RingnesPlanRute = {
  rute: string;
  rutenavn: string;
  /** Importeres as-is (kan være navn eller kode). */
  sjåfør: string | null;
};

export type RingnesSkiftPlan = {
  ruter: RingnesPlanRute[];
  /** Navn/koder som ikke er tilgjengelige (avspasering). */
  avspasering: string[];
  /** Navn/koder som er markert som tilgjengelige i Excel. */
  tilgjengelige?: string[];
};

export type RingnesCycleData = {
  meta: {
    format: string;
    generatedAt: string;
    source: string[];
  };
  routes: RingnesRuteRef[];
  cycle: Record<
    string,
    Record<string, Partial<Record<Skift, RingnesSkiftPlan>>>
  >;
  debugLabels?: Array<{
    uke: number;
    sheet: string;
    day: number;
    block: "main" | "sunday";
    type: "avspasering" | "tilgjengelige";
    row: number;
    col: number;
    text: string;
  }>;
};

export const RINGNES_CYCLE = cycleJson as unknown as RingnesCycleData;

export function ukedag1til7FraDato(d: Date): number {
  // JS: 0=søn ... 6=lør. Vi vil ha 1=man ... 7=søn.
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Anker: 2026-05-11 (mandag) = start av syklus-uke 1. */
const SYKLUS_ANKER = new Date(2026, 4, 11);

export function syklusUkeFraDato(d: Date): 1 | 2 | 3 | 4 {
  const diff = Math.floor(
    (d.getTime() - SYKLUS_ANKER.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  const mod = ((diff % 4) + 4) % 4;
  return (mod + 1) as 1 | 2 | 3 | 4;
}

