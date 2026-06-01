import type { Bil, Henger } from "@/lib/domain";
import { PLANNER_RESSURSLISTE } from "@/lib/imported/plannerRessursliste";
import { PLANNER_HENGER_RESSURSLISTE } from "@/lib/imported/plannerHengerRessursliste";

/** Normaliserer og fjerner duplikater (f.eks. FT65210-FEIL → FT65210). */
function normKjennemerke(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-FEIL$/i, "");
}

function unike(regnr: string[]): string[] {
  const sett = new Set<string>();
  for (const r of regnr) {
    const n = normKjennemerke(r);
    if (n) sett.add(n);
  }
  return [...sett].sort((a, b) => a.localeCompare(b, "nb", { numeric: true }));
}

function bilId(kjennemerke: string): string {
  return `bil-${kjennemerke.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function hengerId(kjennemerke: string): string {
  return `henger-${kjennemerke.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

/** Motorkjøretøy fra Ringnes-planlegger (48 stk). Kun kjennemerke. */
const BIL_REGNR = unike(PLANNER_RESSURSLISTE.map((r) => r.kjennemerke));

/** Hengere fra Ringnes-planlegger (41 stk). Kun kjennemerke. */
const HENGER_REGNR = unike(PLANNER_HENGER_RESSURSLISTE.map((r) => r.kjennemerke));

export const IMPORTERTE_BILER_REFERANSE_2026: Bil[] = BIL_REGNR.map((kjennemerke) => ({
  id: bilId(kjennemerke),
  kjennemerke,
  aktiv: true,
}));

export const IMPORTERTE_HENGERE_REFERANSE_2026: Henger[] = HENGER_REGNR.map((kjennemerke) => ({
  id: hengerId(kjennemerke),
  kjennemerke,
  aktiv: true,
}));
