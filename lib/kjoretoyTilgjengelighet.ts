import type { BilUtilgjengelig, HengerUtilgjengelig } from "@/lib/domain";

/** ISO-dato YYYY-MM-DD ligger i lukket intervall [fra, til]. */
export function isoDatoIMellom(dato: string, fra: string, til: string): boolean {
  return fra <= dato && dato <= til;
}

export function erBilUtilgjengeligPåDato(
  bilId: string,
  dato: string,
  poster: BilUtilgjengelig[],
): boolean {
  return poster.some(
    (p) => p.bilId === bilId && isoDatoIMellom(dato, p.fraDato, p.tilDato),
  );
}

export function erHengerUtilgjengeligPåDato(
  hengerId: string,
  dato: string,
  poster: HengerUtilgjengelig[],
): boolean {
  return poster.some(
    (p) => p.hengerId === hengerId && isoDatoIMellom(dato, p.fraDato, p.tilDato),
  );
}

export function bilPosterForDato(
  bilId: string,
  dato: string,
  poster: BilUtilgjengelig[],
): BilUtilgjengelig[] {
  return poster.filter(
    (p) => p.bilId === bilId && isoDatoIMellom(dato, p.fraDato, p.tilDato),
  );
}

export function hengerPosterForDato(
  hengerId: string,
  dato: string,
  poster: HengerUtilgjengelig[],
): HengerUtilgjengelig[] {
  return poster.filter(
    (p) => p.hengerId === hengerId && isoDatoIMellom(dato, p.fraDato, p.tilDato),
  );
}
