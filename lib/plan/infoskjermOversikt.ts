import {
  fullNavn,
  type Ansatt,
  type Bil,
  type BilUtilgjengelig,
  type DagEndring,
  type Fravær,
  type Henger,
  type HengerUtilgjengelig,
  type Koblingsgruppe,
  type MasterRuteSlot,
  type PlanRuteTildeling,
  type Skift,
  type SkiftTilgjengelighet,
} from "@/lib/domain";
import {
  erBilUtilgjengeligPåDato,
  erHengerUtilgjengeligPåDato,
} from "@/lib/kjoretoyTilgjengelighet";
import { mergeAvspaseringForPlanDag } from "@/lib/plan/avspasering";
import { harDagKommentarIPlan } from "@/lib/plan/bemanningsplanDagKommentar";
import { byggDagDriftOversikt, formatPlanDatoLang } from "@/lib/plan/dagDriftOversikt";
import { byggDagsFraværOversikt } from "@/lib/plan/dagsFraværOversikt";
import { overlapperFraværDato } from "@/lib/plan/fraværPlan";
import { byggSkiftOverstyringMap } from "@/lib/plan/skiftTilgjengelighet";
import {
  byggEffektiveRuter,
  motsattSkift,
  planTildelingMap,
  sjåførerJobberPåSkift,
  type PlanSkift,
} from "@/lib/plan/sjåførTilgjengelighet";
import type { BemanningPlanData } from "@/lib/utils/parseBemanningsplanExcel";
import { aktivTurnusUke, ukedagNummer } from "@/lib/utils/turnusUtils";

export type InfoskjermTilgjengeligRad = {
  id: string;
  navn: string;
  arbeidstid?: string;
  harDagKommentar: boolean;
};

export type InfoskjermSkiftBlokk = {
  skift: PlanSkift;
  ruterTotalt: number;
  ruterOk: number;
  avvik: number;
  tilgjengelige: InfoskjermTilgjengeligRad[];
};

export type InfoskjermKjøretøyUte = {
  etikett: string;
  type: string;
};

export type InfoskjermOversikt = {
  dato: string;
  datoTekst: string;
  oppdatert: string;
  dag: InfoskjermSkiftBlokk;
  kveld: InfoskjermSkiftBlokk;
  avvikTotalt: number;
  personerUte: number;
  kjøretøyUte: InfoskjermKjøretøyUte[];
  fotnote: string;
};

function overlapperDato(post: Pick<Fravær, "fraDato" | "tilDato">, dato: string): boolean {
  return overlapperFraværDato(post, dato);
}

function arbeidstidTekst(ansatt: Ansatt, dato: string): string | undefined {
  if (!ansatt.turnus) return undefined;
  const uke = aktivTurnusUke(ansatt.turnus, dato);
  const dagInfo = uke.dager[ukedagNummer(dato)];
  if (!dagInfo) return undefined;
  return `${dagInfo.startTid}–${dagInfo.sluttTid}`;
}

function beregnTilgjengeligeForSkift(args: {
  skift: PlanSkift;
  dato: string;
  uke: 1 | 2 | 3 | 4;
  dag: number;
  ansatte: Ansatt[];
  fravær: Fravær[];
  masterSlots: MasterRuteSlot[];
  dagEndringer: DagEndring[];
  tildelinger: PlanRuteTildeling[];
  skiftTilgjengelighet: SkiftTilgjengelighet[];
  bilUtilgjengelig: BilUtilgjengelig[];
  hengerUtilgjengelig: HengerUtilgjengelig[];
  bemanningsplan: BemanningPlanData | null;
}): InfoskjermTilgjengeligRad[] {
  const skiftOverstyringMap = byggSkiftOverstyringMap(args.skiftTilgjengelighet, args.dato);
  const effektiveRuter = byggEffektiveRuter({
    uke: args.uke,
    dag: args.dag,
    skift: args.skift as Skift,
    dato: args.dato,
    masterSlots: args.masterSlots,
    dagEndringer: args.dagEndringer,
  });
  const tildelingMap = planTildelingMap({
    uke: args.uke,
    dag: args.dag,
    skift: args.skift as Skift,
    tildelinger: args.tildelinger,
  });

  const blocked = new Set<string>();
  for (const slot of effektiveRuter) {
    const til = tildelingMap.get(slot.rutekode);
    if (til?.ansattId) blocked.add(til.ansattId);
    else if (!til?.skjulBaselineSjåfør && slot.standardSjåførAnsattId) {
      blocked.add(slot.standardSjåførAnsattId);
    }
  }

  const sjåførerPåMotsattSkift = sjåførerJobberPåSkift({
    uke: args.uke,
    dag: args.dag,
    dato: args.dato,
    skift: motsattSkift(args.skift),
    masterSlots: args.masterSlots,
    dagEndringer: args.dagEndringer,
    tildelinger: args.tildelinger,
    erAktivSjåfør: (id) => args.ansatte.find((a) => a.id === id)?.aktiv === true,
    harFravær: (id) => args.fravær.some((f) => f.ansattId === id && overlapperDato(f, args.dato)),
  });

  for (const id of sjåførerPåMotsattSkift.keys()) {
    if (skiftOverstyringMap.get(id) === args.skift) continue;
    blocked.add(id);
  }

  const avspasering = mergeAvspaseringForPlanDag({
    uke: args.uke,
    dag: args.dag,
    dato: args.dato,
    ansatte: args.ansatte,
    fravær: args.fravær,
  });
  for (const id of avspasering.ansattIds) blocked.add(id);

  return args.ansatte
    .filter((a) => {
      if (!a.aktiv) return false;
      if (a.selskap && a.selskap !== "Asko") return false;
      if (blocked.has(a.id)) return false;
      const overstyrtSkift = skiftOverstyringMap.get(a.id);
      if (overstyrtSkift && overstyrtSkift !== args.skift) return false;
      if (args.fravær.some((f) => f.ansattId === a.id && overlapperDato(f, args.dato))) return false;
      if (a.fastBilId && erBilUtilgjengeligPåDato(a.fastBilId, args.dato, args.bilUtilgjengelig)) {
        return false;
      }
      if (
        a.fastHengerId &&
        erHengerUtilgjengeligPåDato(a.fastHengerId, args.dato, args.hengerUtilgjengelig)
      ) {
        return false;
      }
      return true;
    })
    .map((a) => ({
      id: a.id,
      navn: fullNavn(a),
      arbeidstid: arbeidstidTekst(a, args.dato),
      harDagKommentar: harDagKommentarIPlan(a, args.bemanningsplan, args.dato),
    }))
    .sort((a, b) => a.navn.localeCompare(b.navn, "nb"));
}

export function byggInfoskjermOversikt(args: {
  dato: string;
  uke: 1 | 2 | 3 | 4;
  dag: number;
  ansatte: Ansatt[];
  fravær: Fravær[];
  masterSlots: MasterRuteSlot[];
  koblingsgrupper?: Record<string, Koblingsgruppe>;
  dagEndringer: DagEndring[];
  tildelinger: PlanRuteTildeling[];
  skiftTilgjengelighet: SkiftTilgjengelighet[];
  bilUtilgjengelig: BilUtilgjengelig[];
  hengerUtilgjengelig: HengerUtilgjengelig[];
  biler: Bil[];
  hengere: Henger[];
  bemanningsplan: BemanningPlanData | null;
}): InfoskjermOversikt {
  const drift = byggDagDriftOversikt({
    dato: args.dato,
    uke: args.uke,
    dag: args.dag,
    ansatte: args.ansatte,
    fravær: args.fravær,
    masterSlots: args.masterSlots,
    koblingsgrupper: args.koblingsgrupper,
    dagEndringer: args.dagEndringer,
    tildelinger: args.tildelinger,
    bilUtilgjengelig: args.bilUtilgjengelig,
    hengerUtilgjengelig: args.hengerUtilgjengelig,
    biler: args.biler,
    hengere: args.hengere,
  });

  const dagTilgjengelige = beregnTilgjengeligeForSkift({
    skift: "Dag",
    dato: args.dato,
    uke: args.uke,
    dag: args.dag,
    ansatte: args.ansatte,
    fravær: args.fravær,
    masterSlots: args.masterSlots,
    dagEndringer: args.dagEndringer,
    tildelinger: args.tildelinger,
    skiftTilgjengelighet: args.skiftTilgjengelighet,
    bilUtilgjengelig: args.bilUtilgjengelig,
    hengerUtilgjengelig: args.hengerUtilgjengelig,
    bemanningsplan: args.bemanningsplan,
  });

  const kveldTilgjengelige = beregnTilgjengeligeForSkift({
    skift: "Kveld",
    dato: args.dato,
    uke: args.uke,
    dag: args.dag,
    ansatte: args.ansatte,
    fravær: args.fravær,
    masterSlots: args.masterSlots,
    dagEndringer: args.dagEndringer,
    tildelinger: args.tildelinger,
    skiftTilgjengelighet: args.skiftTilgjengelighet,
    bilUtilgjengelig: args.bilUtilgjengelig,
    hengerUtilgjengelig: args.hengerUtilgjengelig,
    bemanningsplan: args.bemanningsplan,
  });

  const ute = byggDagsFraværOversikt({
    dato: args.dato,
    uke: args.uke,
    dag: args.dag,
    ansatte: args.ansatte,
    fravær: args.fravær,
    bilUtilgjengelig: args.bilUtilgjengelig,
    hengerUtilgjengelig: args.hengerUtilgjengelig,
    biler: args.biler,
    hengere: args.hengere,
  });

  const kjøretøyUte: InfoskjermKjøretøyUte[] = [
    ...ute.biler.map((b) => ({ etikett: b.etikett, type: b.type })),
    ...ute.hengere.map((h) => ({ etikett: h.etikett, type: h.type })),
  ];

  return {
    dato: args.dato,
    datoTekst: formatPlanDatoLang(args.dato),
    oppdatert: new Date().toISOString(),
    dag: {
      skift: "Dag",
      ruterTotalt: drift.sammendrag.dag.totalt,
      ruterOk: drift.sammendrag.dag.ok,
      avvik: drift.sammendrag.dag.problemer,
      tilgjengelige: dagTilgjengelige,
    },
    kveld: {
      skift: "Kveld",
      ruterTotalt: drift.sammendrag.kveld.totalt,
      ruterOk: drift.sammendrag.kveld.ok,
      avvik: drift.sammendrag.kveld.problemer,
      tilgjengelige: kveldTilgjengelige,
    },
    avvikTotalt: drift.sammendrag.trengerHandling,
    personerUte: drift.sammendrag.personerUte,
    kjøretøyUte,
    fotnote: "* = merknad i bemanningsplan denne dagen (se Plan / Fravær)",
  };
}
