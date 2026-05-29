import type {
  Ansatt,
  Bil,
  BilUtilgjengelig,
  Fravær,
  Henger,
  HengerUtilgjengelig,
  MasterRuteSlot,
} from "@/lib/domain";
import { isoDato, parseISODateInput } from "@/lib/kjoretoyTilgjengelighet";
import { syklusUkeFraDato, ukedag1til7FraDato } from "@/lib/imported/ringnesCycle";
import {
  byggDagsFraværOversikt,
  type DagsFraværAnsattRad,
  type DagsFraværKjøretøyRad,
} from "@/lib/plan/dagsFraværOversikt";

const DAG_NAVN_KORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

export type UkesDag = {
  dato: string;
  dagNr: number;
  dagNavn: string;
  datoKort: string;
  erIDag: boolean;
  syklusUke: 1 | 2 | 3 | 4;
  ansatte: DagsFraværAnsattRad[];
  biler: DagsFraværKjøretøyRad[];
  hengere: DagsFraværKjøretøyRad[];
};

export type UkesFraværOversikt = {
  ukeStart: string;
  ukeSlutt: string;
  syklusUker: number[];
  dager: UkesDag[];
  totalt: {
    ansatte: number;
    biler: number;
    hengere: number;
  };
};

/** Mandag i uken som inneholder gitt dato. */
export function mandagIUke(dato: string): string {
  const d = parseISODateInput(dato);
  const dagNr = ukedag1til7FraDato(d);
  d.setDate(d.getDate() - (dagNr - 1));
  return isoDato(d);
}

function addDays(iso: string, delta: number): string {
  const d = parseISODateInput(iso);
  d.setDate(d.getDate() + delta);
  return isoDato(d);
}

export function byggUkesFraværOversikt(args: {
  dato: string;
  ansatte: Ansatt[];
  fravær: Fravær[];
  masterSlots: MasterRuteSlot[];
  bilUtilgjengelig: BilUtilgjengelig[];
  hengerUtilgjengelig: HengerUtilgjengelig[];
  biler: Bil[];
  hengere: Henger[];
}): UkesFraværOversikt {
  const start = mandagIUke(args.dato);
  const iDag = isoDato(new Date());
  const dager: UkesDag[] = [];
  const syklusUkerSet = new Set<number>();
  let totAnsatte = 0;
  let totBiler = 0;
  let totHengere = 0;

  for (let i = 0; i < 7; i++) {
    const dato = addDays(start, i);
    const d = parseISODateInput(dato);
    const dagNr = ukedag1til7FraDato(d);
    const syklusUke = syklusUkeFraDato(d);
    syklusUkerSet.add(syklusUke);

    const oversikt = byggDagsFraværOversikt({
      dato,
      uke: syklusUke,
      dag: dagNr,
      ansatte: args.ansatte,
      fravær: args.fravær,
      bilUtilgjengelig: args.bilUtilgjengelig,
      hengerUtilgjengelig: args.hengerUtilgjengelig,
      biler: args.biler,
      hengere: args.hengere,
    });

    totAnsatte += oversikt.ansatte.length;
    totBiler += oversikt.biler.length;
    totHengere += oversikt.hengere.length;

    dager.push({
      dato,
      dagNr,
      dagNavn: DAG_NAVN_KORT[i] ?? `Dag ${dagNr}`,
      datoKort: formatDatoKort(dato),
      erIDag: dato === iDag,
      syklusUke,
      ansatte: oversikt.ansatte,
      biler: oversikt.biler,
      hengere: oversikt.hengere,
    });
  }

  return {
    ukeStart: start,
    ukeSlutt: addDays(start, 6),
    syklusUker: Array.from(syklusUkerSet).sort((a, b) => a - b),
    dager,
    totalt: { ansatte: totAnsatte, biler: totBiler, hengere: totHengere },
  };
}

function formatDatoKort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
}

export function formatUkeIntervall(o: UkesFraværOversikt): string {
  return `${formatDatoKort(o.ukeStart)}–${formatDatoKort(o.ukeSlutt)}`;
}
