import type { ReserveTilgjengelighet, Skift } from "@/lib/domain";
import { skiftPostDekkerDato } from "@/lib/plan/skiftTilgjengelighet";

/** Standard ankomsttid ved reserve, per skift. */
export function standardReserveFraKl(skift: Skift): string {
  return skift === "Dag" ? "06:00" : "14:00";
}

/** Om en reserve-post dekker dato + skift. */
export function reserveDekkerDatoOgSkift(
  post: Pick<ReserveTilgjengelighet, "fraDato" | "tilDato" | "skift">,
  dato: string,
  skift: Skift,
): boolean {
  return post.skift === skift && skiftPostDekkerDato(post, dato);
}

/**
 * Bygger oppslag ansattId → aktiv reserve for gitt dato og skift.
 * Siste post i listen vinner ved overlapp.
 */
export function byggReserveMap(
  poster: ReserveTilgjengelighet[],
  dato: string,
  skift: Skift,
): Map<string, ReserveTilgjengelighet> {
  const map = new Map<string, ReserveTilgjengelighet>();
  for (const p of poster) {
    if (reserveDekkerDatoOgSkift(p, dato, skift)) map.set(p.ansattId, p);
  }
  return map;
}

/** Visningstekst for reserve i lister. */
export function reserveTilgjengeligTekst(fraKl: string): string {
  return `Reserve fra ${fraKl}`;
}
