import type { Ansatt, Bil } from "@/lib/domain";
import { fullNavn } from "@/lib/domain";

/** Alfabetisk sortering (norsk, numerisk). */
export function compareNb(a: string, b: string): number {
  return a.localeCompare(b, "nb", { numeric: true, sensitivity: "base" });
}

export function compareAnsattNavn(a: Ansatt, b: Ansatt): number {
  return compareNb(fullNavn(a), fullNavn(b));
}

export function compareBilKjennemerke(a: Bil, b: Bil): number {
  return compareNb(a.kjennemerke, b.kjennemerke);
}

/** Returnerer ny sortert kopi — muterer ikke input. */
export function sorterAnsatte<T extends Ansatt>(ansatte: readonly T[]): T[] {
  return [...ansatte].sort(compareAnsattNavn);
}

/** Returnerer ny sortert kopi — muterer ikke input. */
export function sorterBiler<T extends Bil>(biler: readonly T[]): T[] {
  return [...biler].sort(compareBilKjennemerke);
}

/** Rutekoder / rutenummer i stigende numerisk rekkefølge (1110 før 1120). */
export function compareRutekode(a: string, b: string): number {
  return compareNb(a, b);
}

/** Returnerer ny sortert kopi — muterer ikke input. */
export function sorterRutekoder<T extends string>(rutekoder: readonly T[]): T[] {
  return [...rutekoder].sort(compareRutekode);
}

type SlotMedStart = { rutekode: string; startTid?: string };

/** Kronologisk planrekkefølge: starttid, deretter rutenummer. */
export function compareMasterSlotKronologisk(a: SlotMedStart, b: SlotMedStart): number {
  const ha = a.startTid?.trim();
  const hb = b.startTid?.trim();
  if (ha && hb && ha !== hb) return ha.localeCompare(hb);
  if (ha && !hb) return -1;
  if (!ha && hb) return 1;
  return compareRutekode(a.rutekode, b.rutekode);
}

/** Returnerer ny sortert kopi — muterer ikke input. */
export function sorterMasterSlots<T extends SlotMedStart>(slots: readonly T[]): T[] {
  return [...slots].sort(compareMasterSlotKronologisk);
}
