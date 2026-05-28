import { fullNavn, type Ansatt, type DagEndring, type Fravær, type MasterRuteSlot, type PlanRuteTildeling } from "@/lib/domain";
import { avspaseringFraværEntries } from "@/lib/plan/fraværPlan";
import { RINGNES_CYCLE } from "@/lib/imported/ringnesCycle";
import {
  byggEffektiveRuter,
  effektivSjåførIdForSlot,
  planTildelingMap,
  type PlanSkift,
} from "@/lib/plan/sjåførTilgjengelighet";
import { erIkkePersonNavn, matchPlanNavnTilAnsatt } from "@/lib/plan/planNavnMatching";

export type AvspaseringKilde = "syklus" | "registrert";

export type AvspaseringEntry = {
  ansattId: string;
  visningsnavn: string;
  planNavn: string;
  kilde: AvspaseringKilde;
};

export type AvspaseringForDag = {
  ansattIds: Set<string>;
  entries: AvspaseringEntry[];
  umatchedNavn: string[];
};

/** Fjern «, 2 skift» / «, 2s» fra Excel-listen før navnematching. */
export function rensAvspaseringPlanNavn(raw: string): string {
  return raw
    .replace(/,\s*\d+\s*skift?/i, "")
    .replace(/,\s*\d+s\b/i, "")
    .trim();
}

export function avspaseringNavnForSyklusDag(uke: 1 | 2 | 3 | 4, dag: number): string[] {
  const dayPlan = RINGNES_CYCLE.cycle[String(uke)]?.[String(dag)];
  if (!dayPlan) return [];

  const navn = new Set<string>();
  for (const skift of ["Dag", "Kveld"] as const) {
    for (const rå of dayPlan[skift]?.avspasering ?? []) {
      const renset = rensAvspaseringPlanNavn(rå);
      if (renset) navn.add(rå);
    }
  }
  return Array.from(navn);
}

export function resolveSyklusAvspaseringForDag(args: {
  uke: 1 | 2 | 3 | 4;
  dag: number;
  ansatte: Ansatt[];
}): AvspaseringForDag {
  const planNavnListe = avspaseringNavnForSyklusDag(args.uke, args.dag);
  const ansattIds = new Set<string>();
  const entries: AvspaseringEntry[] = [];
  const umatchedNavn: string[] = [];
  const seenIds = new Set<string>();

  for (const rå of planNavnListe) {
    const planNavn = rensAvspaseringPlanNavn(rå);
    if (!planNavn || erIkkePersonNavn(planNavn)) continue;

    const match = matchPlanNavnTilAnsatt(planNavn, args.ansatte);
    if (match.type === "match") {
      if (seenIds.has(match.ansatt.id)) continue;
      seenIds.add(match.ansatt.id);
      ansattIds.add(match.ansatt.id);
      entries.push({
        ansattId: match.ansatt.id,
        visningsnavn: fullNavn(match.ansatt),
        planNavn: rå,
        kilde: "syklus",
      });
      continue;
    }
    if (match.type === "ukjent" || match.type === "tvetydig") {
      umatchedNavn.push(rå);
    }
  }

  entries.sort((a, b) => a.visningsnavn.localeCompare(b.visningsnavn, "nb"));
  return { ansattIds, entries, umatchedNavn };
}

export function mergeAvspaseringForPlanDag(args: {
  uke: 1 | 2 | 3 | 4;
  dag: number;
  dato: string;
  ansatte: Ansatt[];
  fravær: Fravær[];
}): AvspaseringForDag {
  const syklus = resolveSyklusAvspaseringForDag({
    uke: args.uke,
    dag: args.dag,
    ansatte: args.ansatte,
  });
  const ansattIds = new Set(syklus.ansattIds);
  const entries: AvspaseringEntry[] = [...syklus.entries];
  const seenIds = new Set(syklus.ansattIds);

  for (const post of avspaseringFraværEntries({
    fravær: args.fravær,
    dato: args.dato,
    ansatte: args.ansatte,
  })) {
    if (seenIds.has(post.ansattId)) continue;
    seenIds.add(post.ansattId);
    ansattIds.add(post.ansattId);
    entries.push({
      ...post,
      kilde: "registrert",
    });
  }

  entries.sort((a, b) => a.visningsnavn.localeCompare(b.visningsnavn, "nb"));
  return { ansattIds, entries, umatchedNavn: syklus.umatchedNavn };
}

export function ansattHarAvspasering(ansattId: string, avspasering: AvspaseringForDag): boolean {
  return avspasering.ansattIds.has(ansattId);
}

export type SjåførRutePåDag = {
  skift: PlanSkift;
  rutekode: string;
  harPlanOverstyring: boolean;
};

/** Finn alle ruter (dag + kveld) der sjåføren er satt denne datoen. */
export function finnSjåførRuterPåDag(args: {
  uke: number;
  dag: number;
  dato: string;
  ansattId: string;
  masterSlots: MasterRuteSlot[];
  dagEndringer: DagEndring[];
  tildelinger: PlanRuteTildeling[];
}): SjåførRutePåDag[] {
  const result: SjåførRutePåDag[] = [];

  for (const skift of ["Dag", "Kveld"] as const) {
    const ruter = byggEffektiveRuter({
      uke: args.uke,
      dag: args.dag,
      skift,
      dato: args.dato,
      masterSlots: args.masterSlots,
      dagEndringer: args.dagEndringer,
    });
    const tildelingMap = planTildelingMap({
      uke: args.uke,
      dag: args.dag,
      skift,
      tildelinger: args.tildelinger,
    });

    for (const slot of ruter) {
      const til = tildelingMap.get(slot.rutekode);
      const sjåførId = effektivSjåførIdForSlot(slot, til);
      if (sjåførId !== args.ansattId) continue;
      result.push({
        skift,
        rutekode: slot.rutekode,
        harPlanOverstyring: Boolean(til?.ansattId),
      });
    }
  }

  return result;
}

/** @deprecated Bruk mergeAvspaseringForPlanDag */
export function resolveAvspaseringForDag(args: {
  uke: 1 | 2 | 3 | 4;
  dag: number;
  ansatte: Ansatt[];
}): AvspaseringForDag {
  return resolveSyklusAvspaseringForDag(args);
}
