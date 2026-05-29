import type { Skift, SkiftTilgjengelighet } from "@/lib/domain";

/** Om en skift-overstyring dekker en gitt dato (én dag eller fraDato–tilDato). */
export function skiftPostDekkerDato(
  post: Pick<SkiftTilgjengelighet, "fraDato" | "tilDato">,
  dato: string,
): boolean {
  if (dato < post.fraDato) return false;
  if (post.tilDato) return dato <= post.tilDato;
  return dato === post.fraDato;
}

/**
 * Bygger oppslag ansattId → overstyrt skift for en gitt dato.
 * Siste post i listen vinner ved overlapp (UI lagrer idempotent per ansatt+startdato).
 */
export function byggSkiftOverstyringMap(
  poster: SkiftTilgjengelighet[],
  dato: string,
): Map<string, Skift> {
  const map = new Map<string, Skift>();
  for (const p of poster) {
    if (skiftPostDekkerDato(p, dato)) map.set(p.ansattId, p.skift);
  }
  return map;
}

/** Hvilket skift en sjåfør er overstyrt til på datoen, eller undefined. */
export function skiftOverstyringForAnsatt(
  poster: SkiftTilgjengelighet[],
  ansattId: string,
  dato: string,
): Skift | undefined {
  let funnet: Skift | undefined;
  for (const p of poster) {
    if (p.ansattId === ansattId && skiftPostDekkerDato(p, dato)) funnet = p.skift;
  }
  return funnet;
}
