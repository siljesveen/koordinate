import type { Ansatt, Dagsplan, Fravær, Rute } from "./types";
import { IMPORTERTE_ANSATTE } from "@/lib/imported/ansatte-from-excel";
import { IMPORTERTE_RUTER as RUTER_FRA_RINGNES } from "@/lib/imported/ruter-from-ringnes";

/** Alle ansatte (importert baseline). */
export const MOCK_ANSATTE: Ansatt[] = IMPORTERTE_ANSATTE;

/**
 * Ruter dere faktisk kjører — fra Ringnes-syklus (`ringnes-cycle.json`).
 * Eksporteres også som `MOCK_RUTER` for bakoverkompatibel import-navn.
 */
export const IMPORTERTE_RUTER: Rute[] = RUTER_FRA_RINGNES;
export const MOCK_RUTER: Rute[] = RUTER_FRA_RINGNES;

/**
 * Tom starttilstand for dagsplan (ingen innbakte demo-rader med gamle mock-id-er).
 */
export function mockDagsplanForDato(_dato: string): Dagsplan[] {
  return [];
}

/** Mock: fravær over perioder (eksempler). */
export const MOCK_FRAVÆR: Fravær[] = [
  {
    id: "f1",
    ansattId: "a5",
    type: "Ferie",
    fraDato: "2026-07-01",
    tilDato: "2026-07-14",
    kommentar: "Sommerferie",
  },
  {
    id: "f2",
    ansattId: "a4",
    type: "Syk",
    fraDato: "2026-05-05",
    tilDato: "2026-05-08",
    kommentar: "Attest innhentes",
  },
];
