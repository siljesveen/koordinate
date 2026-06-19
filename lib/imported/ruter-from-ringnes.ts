import type { Rute } from "@/lib/domain/types";
import { RINGNES_CYCLE } from "./ringnesCycle";

/**
 * Stabil id for lagring (f.eks. ansatt.ruteIds).
 * Prefiks unngår kollisjon med andre kilder senere.
 */
export function ringnesRuteId(rutenummer: string): string {
  const s = rutenummer.trim();
  return `rg-${s.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
}

export function ringnesRefTilRute(ref: { rute: string; rutenavn: string }): Rute {
  const rutenummer = ref.rute.trim();
  return {
    id: ringnesRuteId(rutenummer),
    rutenummer,
    rutenavn: ref.rutenavn.trim(),
    område: "",
    starttid: "",
    sluttid: "",
    kravKompetanse: [],
    aktiv: true,
  };
}

/** Alle ruter fra Ringnes-syklus (Excel-baseline). */
export const IMPORTERTE_RUTER: Rute[] = RINGNES_CYCLE.routes.map(ringnesRefTilRute);
