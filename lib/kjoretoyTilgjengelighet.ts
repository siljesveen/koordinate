import type { BilUtilgjengelig, HengerUtilgjengelig } from "@/lib/domain";

type Periode = { fraDato: string; tilDato?: string };

/** ISO-dato innen periode; manglende tilDato = åpen. Begge ender inklusiv (historikk, tidslinje). */
export function overlapperUtilgjengeligPeriode(dato: string, periode: Periode): boolean {
  if (dato < periode.fraDato) return false;
  if (!periode.tilDato) return true;
  return dato <= periode.tilDato;
}

/** Workshop «borte i dag» og tilsvarende tellere: ikke list samme kalenderdag som «tilbake» ble merket fra. */
export function erMedIVerkstedBorteIDagListe(datoRef: string, p: BilUtilgjengelig): boolean {
  if (!overlapperUtilgjengeligPeriode(datoRef, p)) return false;
  const t = p.tilbakeIDriftDato?.trim();
  if (!t) return true;
  return datoRef < t;
}

export function erUtilgjengeligPeriodeÅpen(periode: Periode): boolean {
  return !periode.tilDato;
}

export function formatUtilgjengeligPeriode(fra: string, til?: string): string {
  if (!til) return `${fra} → pågår`;
  return `${fra} → ${til}`;
}

export function parseISODateInput(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isoDato(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function isoIDag(): string {
  return isoDato(new Date());
}

/** Resultat ved «tilbake» / tidlig tilbake / avbestille planlagt fravær. */
export type BilMerkTilbakeResultat =
  | { kind: "ingen" }
  | { kind: "slett" }
  /** Avslutt periode eller kort ned planlagt slutt til denne kalenderdatoen */
  | { kind: "oppdater"; tilDato: string };

/** Om raden fortsatt kan påvirke plan (tilbake-knapp aktiveres). */
export function bilPeriodeKanMerkesTilbake(periode: Periode): boolean {
  const iDag = isoIDag();
  if (erUtilgjengeligPeriodeÅpen(periode)) return true;
  if (periode.fraDato > iDag) return true;
  if (!periode.tilDato) return true;
  if (periode.tilDato < iDag) return false;
  return overlapperUtilgjengeligPeriode(iDag, periode);
}

/** Tekst til bekreftelsesdialog før merk tilbake / fjern planlagt. */
export function bilMerkeTilbakeBekreftMelding(periode: Periode, navn: string): string {
  const iDag = isoIDag();
  if (periode.fraDato > iDag) {
    return `Fjerne planlagt utilgjengelighet for ${navn} (${formatUtilgjengeligPeriode(periode.fraDato, periode.tilDato)})? Bilen beholdes disponibel uten denne blokken.`;
  }
  if (erUtilgjengeligPeriodeÅpen(periode)) {
    return `Merk ${navn} tilbake (til i dag)?`;
  }
  if (periode.tilDato) {
    return `Merk ${navn} tidlig tilbake? Planlagt borte til ${periode.tilDato} forkortes til i dag.`;
  }
  return `Merk ${navn} tilbake (til i dag)?`;
}

/**
 * Oppdater ved «tilbake»: åpen eller lukket periode påvirket i dag, eller fjern framtidige planlagte.
 * Returnerer «oppdater» også når sluttdato allerede er i dag, slik at tilbakeIDrift kan lagres.
 * «ingen» ved ferdige historiske oppføringer eller til==slutt uten overlap i dag.
 */
export function resolveBilPeriodeEtterMerkeTilbake(
  periode: Periode,
  eksplisittTilDato?: string,
): BilMerkTilbakeResultat {
  if (eksplisittTilDato !== undefined && eksplisittTilDato.trim() !== "") {
    const t = eksplisittTilDato.trim();
    const iRef = isoIDag();
    if (t < periode.fraDato) return { kind: "ingen" };
    if (!periode.tilDato) return { kind: "oppdater", tilDato: t };
    if (t === periode.tilDato) {
      // Slutt allerede satt til i dag: lagre likevel så tilbakeIDriftDato settes (verkstedliste).
      if (t === iRef && overlapperUtilgjengeligPeriode(iRef, periode)) {
        return { kind: "oppdater", tilDato: t };
      }
      return { kind: "ingen" };
    }
    return { kind: "oppdater", tilDato: t };
  }

  const iDag = isoIDag();

  if (!periode.tilDato) {
    if (periode.fraDato > iDag) return { kind: "slett" };
    return { kind: "oppdater", tilDato: iDag };
  }

  const til = periode.tilDato;
  if (til < iDag) return { kind: "ingen" };

  if (periode.fraDato > iDag) return { kind: "slett" };

  return { kind: "oppdater", tilDato: iDag };
}

/**
 * Brukes i disponibilitetsplan mv.: om bil og hengere blokkeres denne kalenderdatoen.
 * Til-dato kan være i dag mens bilen er ledig å disponere videre («merk tilbake samme dag»),
 * mens lagret område fortsatt inkluderer hele dagen for statistikk.
 */
export function overlapperUtilgjengeligPeriodeDisponibilitet(dato: string, periode: Periode): boolean {
  if (dato < periode.fraDato) return false;
  if (!periode.tilDato) return true;
  const iDag = isoIDag();
  if (dato === iDag && dato === periode.tilDato) return false;
  return dato <= periode.tilDato;
}

/** Antall kalenderdager i perioden (inkl. fra og til), målt mot en referansedato for åpne perioder. */
export function dagerIUtilgjengeligPeriode(
  fra: string,
  til: string | undefined,
  refDato: string,
): number {
  const start = parseISODateInput(fra);
  const slutt = parseISODateInput(til && til >= fra ? til : refDato);
  const ms = slutt.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / (24 * 60 * 60 * 1000)) + 1);
}

export function erBilUtilgjengeligPåDato(
  bilId: string,
  dato: string,
  poster: BilUtilgjengelig[],
): boolean {
  return poster.some((p) => p.bilId === bilId && overlapperUtilgjengeligPeriodeDisponibilitet(dato, p));
}

/** Om bil har registrert utilgjengelighetsperiode denne dagen (inkl. verksted), uavhengig av «tilbake samme dag». */
export function erBilIUtilgjengeligPeriodePåDato(
  bilId: string,
  dato: string,
  poster: BilUtilgjengelig[],
): boolean {
  return poster.some((p) => p.bilId === bilId && overlapperUtilgjengeligPeriode(dato, p));
}

export function erHengerUtilgjengeligPåDato(
  hengerId: string,
  dato: string,
  poster: HengerUtilgjengelig[],
): boolean {
  return poster.some((p) => p.hengerId === hengerId && overlapperUtilgjengeligPeriodeDisponibilitet(dato, p));
}

export function erHengerIUtilgjengeligPeriodePåDato(
  hengerId: string,
  dato: string,
  poster: HengerUtilgjengelig[],
): boolean {
  return poster.some((p) => p.hengerId === hengerId && overlapperUtilgjengeligPeriode(dato, p));
}

export function bilPosterForDato(
  bilId: string,
  dato: string,
  poster: BilUtilgjengelig[],
): BilUtilgjengelig[] {
  return poster.filter((p) => p.bilId === bilId && overlapperUtilgjengeligPeriodeDisponibilitet(dato, p));
}

export function hengerPosterForDato(
  hengerId: string,
  dato: string,
  poster: HengerUtilgjengelig[],
): HengerUtilgjengelig[] {
  return poster.filter((p) => p.hengerId === hengerId && overlapperUtilgjengeligPeriodeDisponibilitet(dato, p));
}

/** Sammenligning for sortering (åpne perioder telles som langt frem). */
export function utilgjengeligPeriodeSorterKey(p: Periode): string {
  return `${p.fraDato}|${p.tilDato ?? "9999-12-31"}`;
}
