import {
  fullNavn,
  type Ansatt,
  type Bil,
  type BilUtilgjengelig,
  type Fravær,
  type Henger,
  type HengerUtilgjengelig,
} from "@/lib/domain";
import { formatUtilgjengeligPeriode, overlapperUtilgjengeligPeriodeDisponibilitet } from "@/lib/kjoretoyTilgjengelighet";
import { mergeAvspaseringForPlanDag } from "@/lib/plan/avspasering";
import { overlapperFraværDato } from "@/lib/plan/fraværPlan";
import { compareNb } from "@/lib/utils/sort";

export type DagsFraværAnsattRad = {
  id: string;
  ansattId: string;
  navn: string;
  type: string;
  periode: string;
  kommentar?: string;
};

export type DagsFraværKjøretøyRad = {
  id: string;
  etikett: string;
  type: string;
  periode: string;
  planlagt: boolean;
};

export type DagsFraværOversikt = {
  ansatte: DagsFraværAnsattRad[];
  biler: DagsFraværKjøretøyRad[];
  hengere: DagsFraværKjøretøyRad[];
};

function fraværPeriodeTekst(f: Fravær): string {
  if (f.fraDato === f.tilDato) return f.fraDato;
  return `${f.fraDato} → ${f.tilDato}`;
}

export function byggDagsFraværOversikt(args: {
  dato: string;
  uke: 1 | 2 | 3 | 4;
  dag: number;
  ansatte: Ansatt[];
  fravær: Fravær[];
  bilUtilgjengelig: BilUtilgjengelig[];
  hengerUtilgjengelig: HengerUtilgjengelig[];
  biler: Bil[];
  hengere: Henger[];
}): DagsFraværOversikt {
  const ansattById = new Map(args.ansatte.map((a) => [a.id, a]));
  const bilById = new Map(args.biler.map((b) => [b.id, b]));
  const hengerById = new Map(args.hengere.map((h) => [h.id, h]));

  const ansatte: DagsFraværAnsattRad[] = [];
  const dekket = new Set<string>();

  for (const f of args.fravær) {
    if (!overlapperFraværDato(f, args.dato)) continue;
    const ansatt = ansattById.get(f.ansattId);
    ansatte.push({
      id: f.id,
      ansattId: f.ansattId,
      navn: ansatt ? fullNavn(ansatt) : f.ansattId,
      type: f.type,
      periode: fraværPeriodeTekst(f),
      kommentar: f.kommentar,
    });
    dekket.add(f.ansattId);
  }

  const avspasering = mergeAvspaseringForPlanDag({
    uke: args.uke,
    dag: args.dag,
    dato: args.dato,
    ansatte: args.ansatte,
    fravær: args.fravær,
  });

  for (const entry of avspasering.entries) {
    if (entry.kilde !== "syklus" || entry.status !== "match" || !entry.ansattId) continue;
    if (dekket.has(entry.ansattId)) continue;
    ansatte.push({
      id: `syklus-${entry.ansattId}`,
      ansattId: entry.ansattId,
      navn: entry.visningsnavn,
      type: "Avspasering",
      periode: args.dato,
      kommentar: "Fra Ringnes-plan",
    });
    dekket.add(entry.ansattId);
  }

  for (const entry of avspasering.entries) {
    if (entry.kilde !== "syklus" || entry.status !== "uløst") continue;
    ansatte.push({
      id: entry.entryId,
      ansattId: entry.entryId,
      navn: entry.visningsnavn,
      type: "Avspasering",
      periode: args.dato,
      kommentar: "Fra Ringnes-plan",
    });
  }

  ansatte.sort((a, b) => compareNb(a.navn, b.navn));

  const biler: DagsFraværKjøretøyRad[] = args.bilUtilgjengelig
    .filter((p) => overlapperUtilgjengeligPeriodeDisponibilitet(args.dato, p))
    .map((p) => {
      const bil = bilById.get(p.bilId);
      return {
        id: p.id,
        etikett: bil ? bil.kjennemerke : p.bilId,
        type: p.type,
        periode: formatUtilgjengeligPeriode(p.fraDato, p.tilDato),
        planlagt: p.planlagt === true,
      };
    })
    .sort((a, b) => compareNb(a.etikett, b.etikett));

  const hengere: DagsFraværKjøretøyRad[] = args.hengerUtilgjengelig
    .filter((p) => overlapperUtilgjengeligPeriodeDisponibilitet(args.dato, p))
    .map((p) => {
      const henger = hengerById.get(p.hengerId);
      return {
        id: p.id,
        etikett: henger ? henger.kjennemerke : p.hengerId,
        type: p.type,
        periode: formatUtilgjengeligPeriode(p.fraDato, p.tilDato),
        planlagt: p.planlagt === true,
      };
    })
    .sort((a, b) => compareNb(a.etikett, b.etikett));

  return { ansatte, biler, hengere };
}

export function dagsFraværOversiktTotalt(o: DagsFraværOversikt): number {
  return o.ansatte.length + o.biler.length + o.hengere.length;
}

export function formatPlanDato(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
