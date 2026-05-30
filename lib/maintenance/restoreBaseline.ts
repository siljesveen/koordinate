import type { Ansatt, MasterRuteplan } from "@/lib/domain";
import { buildBaselineMasterplanMedUker } from "@/lib/imported/applyUkeMasterplan";
import { IMPORTERTE_ANSATTE_BEMANNING_2026 } from "@/lib/imported/ansatte-bemanning-2026";
import {
  IMPORTERTE_BILER_REFERANSE_2026,
  IMPORTERTE_HENGERE_REFERANSE_2026,
} from "@/lib/imported/kjoretoy-referanse-2026";
import { APP_DATA_KEYS } from "@/lib/data/storageKeys";

const BAMA_RUTER: { rutekode: string; rutenavn: string }[] = [
  { rutekode: "1520", rutenavn: "Bama shh Hamar" },
  { rutekode: "1550", rutenavn: "Bama shh Gjøvik" },
  { rutekode: "1560", rutenavn: "Bama shh Lillehammer" },
];

function masterSlotId(uke: number, dag: number, skift: "Dag" | "Kveld", rutekode: string): string {
  return `ms-${uke}-${dag}-${skift}-${encodeURIComponent(rutekode)}`;
}

function ensureBamaAlleDager(plan: MasterRuteplan): MasterRuteplan {
  let endret = false;
  const nyeSlots = [...plan.slots];

  for (let uke = 1; uke <= 4; uke++) {
    for (let dag = 1; dag <= 6; dag++) {
      for (const bama of BAMA_RUTER) {
        const finnes = nyeSlots.some(
          (s) => s.uke === uke && s.dag === dag && s.skift === "Dag" && s.rutekode === bama.rutekode,
        );
        if (!finnes) {
          endret = true;
          nyeSlots.push({
            id: masterSlotId(uke, dag, "Dag", bama.rutekode),
            uke: uke as 1 | 2 | 3 | 4,
            dag: dag as 1 | 2 | 3 | 4 | 5 | 6 | 7,
            skift: "Dag",
            rutekode: bama.rutekode,
            rutenavn: bama.rutenavn,
          });
        }
      }
    }
  }

  if (!endret) return plan;
  return { ...plan, slots: nyeSlots };
}

/** Standard app_data-payload: ansatte, kjøretøy og masterplan fra import. */
export function buildBaselineAppDataPayload(): Record<string, unknown> {
  const ansatte: Ansatt[] = IMPORTERTE_ANSATTE_BEMANNING_2026;
  const ansattById = new Map(ansatte.map((a) => [a.id, a] as const));
  const masterplan = ensureBamaAlleDager(buildBaselineMasterplanMedUker(ansattById));

  const payload: Record<string, unknown> = {
    "bemanning.ansatte.v2": ansatte,
    "bemanning.biler.v1": IMPORTERTE_BILER_REFERANSE_2026,
    "bemanning.henger.v1": IMPORTERTE_HENGERE_REFERANSE_2026,
    "bemanning.masterplan.v1": masterplan,
    "bemanning.fravaer.v1": [],
    "bemanning.turnus4uker.v1": [],
    "bemanning.planRuteTildeling.v2": [],
    "bemanning.dagendring.v1": [],
    "bemanning.bilUtilgjengelig.v1": [],
    "bemanning.hengerUtilgjengelig.v1": [],
    "bemanning.skiftTilgjengelighet.v1": [],
    "bemanning.henting.v1": [],
    "bemanning.hentingDag.v1": [],
  };

  for (const key of APP_DATA_KEYS) {
    if (!(key in payload)) payload[key] = [];
  }

  return payload;
}

export function baselineOppsummering(payload: Record<string, unknown>): string {
  const ansatte = payload["bemanning.ansatte.v2"];
  const biler = payload["bemanning.biler.v1"];
  const hengere = payload["bemanning.henger.v1"];
  const mp = payload["bemanning.masterplan.v1"] as { slots?: unknown[] } | undefined;
  const a = Array.isArray(ansatte) ? ansatte.length : 0;
  const b = Array.isArray(biler) ? biler.length : 0;
  const h = Array.isArray(hengere) ? hengere.length : 0;
  const s = Array.isArray(mp?.slots) ? mp.slots.length : 0;
  return `${a} ansatte, ${b} biler, ${h} hengere, ${s} ruter i masterplan`;
}
