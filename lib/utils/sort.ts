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
