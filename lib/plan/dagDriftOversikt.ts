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
} from "@/lib/domain";
import {
  erBilIUtilgjengeligPeriodePåDato,
  erHengerIUtilgjengeligPeriodePåDato,
} from "@/lib/kjoretoyTilgjengelighet";
import { mergeAvspaseringForPlanDag } from "@/lib/plan/avspasering";
import { byggDagsFraværOversikt, dagsFraværOversiktTotalt } from "@/lib/plan/dagsFraværOversikt";
import { overlapperFraværDato } from "@/lib/plan/fraværPlan";
import { byggKoblingsgruppeKontekst, sjåførPåRuterErTillattKoblet } from "@/lib/plan/koblingsgrupper";
import { byggEffektiveRuter, planTildelingMap, type PlanSkift } from "@/lib/plan/sjåførTilgjengelighet";

export type DriftProblemAlvor = "kritisk" | "advarsel";

export type DriftProblemRad = {
  id: string;
  rutekode: string;
  rutenavn: string;
  skift: PlanSkift;
  sjåførNavn?: string;
  bilMerke?: string;
  problem: string;
  alvor: DriftProblemAlvor;
};

export type DriftSkiftTelling = {
  skift: PlanSkift;
  totalt: number;
  ok: number;
  problemer: number;
};

export type DagDriftOversikt = {
  sammendrag: {
    ok: number;
    trengerHandling: number;
    personerUte: number;
    kjøretøyUte: number;
    dag: DriftSkiftTelling;
    kveld: DriftSkiftTelling;
  };
  problemer: DriftProblemRad[];
};

function overlapperDato(post: Pick<Fravær, "fraDato" | "tilDato">, dato: string): boolean {
  return overlapperFraværDato(post, dato);
}

function bilMerke(bilId: string | undefined, biler: Bil[]): string | undefined {
  if (!bilId) return undefined;
  return biler.find((b) => b.id === bilId)?.kjennemerke;
}

function analyserSkift(args: {
  skift: PlanSkift;
  uke: 1 | 2 | 3 | 4;
  dag: number;
  dato: string;
  masterSlots: MasterRuteSlot[];
  koblingsgrupper?: Record<string, Koblingsgruppe>;
  dagEndringer: DagEndring[];
  tildelinger: PlanRuteTildeling[];
  ansattById: Map<string, Ansatt>;
  fravær: Fravær[];
  avspaseringIds: Set<string>;
  bilUtilgjengelig: BilUtilgjengelig[];
  hengerUtilgjengelig: HengerUtilgjengelig[];
  biler: Bil[];
}): { telling: DriftSkiftTelling; problemer: DriftProblemRad[] } {
  const ruter = byggEffektiveRuter({
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

  const koblingCtx = byggKoblingsgruppeKontekst({
    koblingsgrupper: args.koblingsgrupper,
    ruter,
    dagEndringer: args.dagEndringer,
    dato: args.dato,
    skift: args.skift as Skift,
    dag: args.dag,
  });

  const sjåførTeller = new Map<string, string[]>();
  const problemer: DriftProblemRad[] = [];

  for (const slot of ruter) {
    const til = tildelingMap.get(slot.rutekode);
    const manuellSjåfør = Boolean(til?.ansattId);
    let sjåførId = til?.ansattId;
    if (!sjåførId && !til?.skjulBaselineSjåfør) {
      sjåførId = slot.standardSjåførAnsattId;
    }

    const ansatt = sjåførId ? args.ansattById.get(sjåførId) : undefined;
    const harFravær = Boolean(
      sjåførId &&
        args.fravær.some(
          (f) =>
            f.ansattId === sjåførId &&
            f.type !== "Avspasering" &&
            overlapperDato(f, args.dato),
        ),
    );
    const harAvspasering = Boolean(sjåførId && args.avspaseringIds.has(sjåførId));

    let effektivSjåfør: Ansatt | undefined = ansatt?.aktiv ? ansatt : undefined;
    if (effektivSjåfør && harFravær && !manuellSjåfør) {
      effektivSjåfør = undefined;
    }

    const bilId = til?.bilId ?? slot.standardBilId;
    const hengerId = til?.hengerId ?? slot.standardHengerId;
    const bilUtil = Boolean(bilId && erBilIUtilgjengeligPeriodePåDato(bilId, args.dato, args.bilUtilgjengelig));
    const hengUtil = Boolean(
      hengerId && erHengerIUtilgjengeligPeriodePåDato(hengerId, args.dato, args.hengerUtilgjengelig),
    );

    const problemDeler: string[] = [];
    let alvor: DriftProblemAlvor = "advarsel";

    if (til?.skjulBaselineSjåfør && !til?.ansattId) {
      problemDeler.push("Mangler sjåfør");
      alvor = "kritisk";
    } else if (!effektivSjåfør) {
      if (harFravær && slot.standardSjåførAnsattId && !manuellSjåfør) {
        problemDeler.push("Sjåfør har fravær");
      } else {
        problemDeler.push("Mangler sjåfør");
      }
      alvor = "kritisk";
    } else if (harAvspasering) {
      problemDeler.push("Sjåfør avspaserer");
      alvor = "kritisk";
    } else if (harFravær && manuellSjåfør) {
      problemDeler.push("Sjåfør har fravær");
      alvor = "kritisk";
    }

    if (!bilId && slot.standardBilId) {
      problemDeler.push("Mangler bil");
      alvor = "kritisk";
    } else if (bilUtil) {
      problemDeler.push("Bil utilgjengelig");
      if (alvor !== "kritisk") alvor = "advarsel";
    }

    if (!hengerId && slot.standardHengerId) {
      problemDeler.push("Mangler henger");
      if (alvor !== "kritisk") alvor = "advarsel";
    } else if (hengUtil) {
      problemDeler.push("Henger utilgjengelig");
      if (alvor !== "kritisk") alvor = "advarsel";
    }

    if (effektivSjåfør) {
      const liste = sjåførTeller.get(effektivSjåfør.id) ?? [];
      liste.push(slot.rutekode);
      sjåførTeller.set(effektivSjåfør.id, liste);
    }

    if (problemDeler.length === 0) {
      continue;
    }

    problemer.push({
      id: `${args.skift}-${slot.rutekode}`,
      rutekode: slot.rutekode,
      rutenavn: slot.rutenavn ?? slot.rutekode,
      skift: args.skift,
      sjåførNavn: ansatt && (effektivSjåfør || manuellSjåfør || harAvspasering || harFravær)
        ? fullNavn(ansatt)
        : undefined,
      bilMerke: bilMerke(bilId, args.biler),
      problem: problemDeler.join(" · "),
      alvor,
    });
  }

  for (const [ansattId, ruterListe] of sjåførTeller) {
    if (ruterListe.length <= 1) continue;
    if (sjåførPåRuterErTillattKoblet(ruterListe, koblingCtx)) continue;

    const ansatt = args.ansattById.get(ansattId);
    for (const rutekode of ruterListe) {
      const eksisterende = problemer.find((p) => p.rutekode === rutekode && p.skift === args.skift);
      if (eksisterende) {
        if (!eksisterende.problem.includes("2 ruter")) {
          eksisterende.problem = `${eksisterende.problem} · Sjåfør på 2 ruter`;
        }
        eksisterende.alvor = "kritisk";
        continue;
      }
      const slot = ruter.find((r) => r.rutekode === rutekode);
      if (!slot) continue;
      problemer.push({
        id: `${args.skift}-${rutekode}-dup`,
        rutekode,
        rutenavn: slot.rutenavn ?? rutekode,
        skift: args.skift,
        sjåførNavn: ansatt ? fullNavn(ansatt) : undefined,
        problem: "Sjåfør på 2 ruter",
        alvor: "kritisk",
      });
    }
  }

  problemer.sort((a, b) => {
    if (a.alvor !== b.alvor) return a.alvor === "kritisk" ? -1 : 1;
    return a.rutekode.localeCompare(b.rutekode, "nb", { numeric: true });
  });

  const ruterMedProblem = new Set(problemer.map((p) => p.rutekode));
  const okRecount = ruter.length - ruterMedProblem.size;

  return {
    telling: {
      skift: args.skift,
      totalt: ruter.length,
      ok: okRecount,
      problemer: problemer.length,
    },
    problemer,
  };
}

export function byggDagDriftOversikt(args: {
  dato: string;
  uke: 1 | 2 | 3 | 4;
  dag: number;
  ansatte: Ansatt[];
  fravær: Fravær[];
  masterSlots: MasterRuteSlot[];
  koblingsgrupper?: Record<string, Koblingsgruppe>;
  dagEndringer: DagEndring[];
  tildelinger: PlanRuteTildeling[];
  bilUtilgjengelig: BilUtilgjengelig[];
  hengerUtilgjengelig: HengerUtilgjengelig[];
  biler: Bil[];
  hengere: Henger[];
}): DagDriftOversikt {
  const ansattById = new Map(args.ansatte.map((a) => [a.id, a]));
  const avspasering = mergeAvspaseringForPlanDag({
    uke: args.uke,
    dag: args.dag,
    dato: args.dato,
    ansatte: args.ansatte,
    fravær: args.fravær,
  });

  const dag = analyserSkift({
    skift: "Dag",
    uke: args.uke,
    dag: args.dag,
    dato: args.dato,
    masterSlots: args.masterSlots,
    koblingsgrupper: args.koblingsgrupper,
    dagEndringer: args.dagEndringer,
    tildelinger: args.tildelinger,
    ansattById,
    fravær: args.fravær,
    avspaseringIds: avspasering.ansattIds,
    bilUtilgjengelig: args.bilUtilgjengelig,
    hengerUtilgjengelig: args.hengerUtilgjengelig,
    biler: args.biler,
  });

  const kveld = analyserSkift({
    skift: "Kveld",
    uke: args.uke,
    dag: args.dag,
    dato: args.dato,
    masterSlots: args.masterSlots,
    koblingsgrupper: args.koblingsgrupper,
    dagEndringer: args.dagEndringer,
    tildelinger: args.tildelinger,
    ansattById,
    fravær: args.fravær,
    avspaseringIds: avspasering.ansattIds,
    bilUtilgjengelig: args.bilUtilgjengelig,
    hengerUtilgjengelig: args.hengerUtilgjengelig,
    biler: args.biler,
  });

  const problemer = [...dag.problemer, ...kveld.problemer].sort((a, b) => {
    if (a.alvor !== b.alvor) return a.alvor === "kritisk" ? -1 : 1;
    if (a.skift !== b.skift) return a.skift === "Dag" ? -1 : 1;
    return a.rutekode.localeCompare(b.rutekode, "nb", { numeric: true });
  });

  const dagsoversikt = byggDagsFraværOversikt({
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

  return {
    sammendrag: {
      ok: dag.telling.ok + kveld.telling.ok,
      trengerHandling: problemer.length,
      personerUte: dagsoversikt.ansatte.length,
      kjøretøyUte: dagsoversikt.biler.length + dagsoversikt.hengere.length,
      dag: dag.telling,
      kveld: kveld.telling,
    },
    problemer,
  };
}

export function formatPlanDatoLang(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export { dagsFraværOversiktTotalt };
