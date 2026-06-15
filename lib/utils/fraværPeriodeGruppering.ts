import type { Fravær, FraværType } from "@/lib/domain";

export type FraværDag = {
  dato: string;
  type: FraværType;
  excelKode: string;
  kommentar?: string;
};

export type FraværPeriode = {
  fraDato: string;
  tilDato: string;
  type: FraværType;
  excelKode: string;
  kommentar?: string;
};

export function addDays(isoDato: string, days: number): string {
  const d = new Date(`${isoDato}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function erHelg(isoDato: string): boolean {
  const ukedag = new Date(`${isoDato}T12:00:00`).getDay();
  return ukedag === 0 || ukedag === 6;
}

/** Samme periode hvis påfølgende dag, eller kun helg mellom (man–fre + helg + man–fre). */
export function kanFortsettePeriode(sisteTil: string, nesteFra: string): boolean {
  if (addDays(sisteTil, 1) === nesteFra) return true;
  let d = addDays(sisteTil, 1);
  while (d < nesteFra) {
    if (!erHelg(d)) return false;
    d = addDays(d, 1);
  }
  return d === nesteFra;
}

function slåSammenKommentarer(...deler: Array<string | undefined>): string | undefined {
  const unike = [...new Set(deler.filter(Boolean) as string[])];
  return unike.length ? unike.join("; ") : undefined;
}

function sammeFraværKategori(a: Pick<Fravær, "type" | "excelKode">, b: Pick<Fravær, "type" | "excelKode">): boolean {
  if (a.type !== b.type) return false;
  const ka = a.excelKode?.trim().toUpperCase();
  const kb = b.excelKode?.trim().toUpperCase();
  if (ka && kb) return ka === kb;
  return true;
}

/** Grupper fraværsdager til perioder (import fra Excel). */
export function grupperFraværDagerTilPerioder(dager: FraværDag[]): FraværPeriode[] {
  const perioder: FraværPeriode[] = [];

  for (const dag of dager) {
    const siste = perioder[perioder.length - 1];
    if (
      siste &&
      siste.type === dag.type &&
      siste.excelKode === dag.excelKode &&
      kanFortsettePeriode(siste.tilDato, dag.dato)
    ) {
      siste.tilDato = dag.dato;
      siste.kommentar = slåSammenKommentarer(siste.kommentar, dag.kommentar);
      continue;
    }
    perioder.push({
      fraDato: dag.dato,
      tilDato: dag.dato,
      type: dag.type,
      excelKode: dag.excelKode,
      kommentar: dag.kommentar,
    });
  }

  return perioder;
}

/** Slå sammen lagrede perioder — f.eks. man–fre + helg + man–fre → én periode. */
export function slåSammenFraværPerioder(fravær: Fravær[]): Fravær[] {
  const perAnsatt = new Map<string, Fravær[]>();
  for (const f of fravær) {
    const list = perAnsatt.get(f.ansattId) ?? [];
    list.push(f);
    perAnsatt.set(f.ansattId, list);
  }

  const result: Fravær[] = [];
  for (const list of perAnsatt.values()) {
    const sorted = [...list].sort(
      (a, b) => a.fraDato.localeCompare(b.fraDato) || a.tilDato.localeCompare(b.tilDato),
    );
    const merged: Fravær[] = [];

    for (const f of sorted) {
      const siste = merged[merged.length - 1];
      if (siste && sammeFraværKategori(siste, f) && kanFortsettePeriode(siste.tilDato, f.fraDato)) {
        if (f.tilDato > siste.tilDato) siste.tilDato = f.tilDato;
        siste.kommentar = slåSammenKommentarer(siste.kommentar, f.kommentar);
        if (!siste.excelKode && f.excelKode) siste.excelKode = f.excelKode;
      } else {
        merged.push({ ...f });
      }
    }

    result.push(...merged);
  }

  return result;
}
