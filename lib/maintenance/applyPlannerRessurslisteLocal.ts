import type { Ansatt, Bil, Henger, MasterRuteplan, PlanRuteTildeling } from "@/lib/domain";
import {
  applyPlannerHengerRessursliste,
  formatHengerRessurslisteRapport,
  ryddHengerReferanser,
  type HengerRessurslisteRapport,
} from "@/lib/maintenance/applyPlannerHengerRessursliste";
import {
  applyPlannerRessursliste,
  formatRessurslisteRapport,
  ryddBilReferanser,
  type RessurslisteRapport,
} from "@/lib/maintenance/applyPlannerRessursliste";

const ANSATTE_KEY = "bemanning.ansatte.v2";
const BILER_KEY = "bemanning.biler.v1";
const HENGER_KEY = "bemanning.henger.v1";
const MASTERPLAN_KEY = "bemanning.masterplan.v1";
const TILDELING_KEY = "bemanning.planRuteTildeling.v2";

function lesJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type PlannerKjøretøyRapport = {
  biler: RessurslisteRapport;
  hengere: HengerRessurslisteRapport;
};

/** Bruker ressursliste fra planlegger på biler og hengere i localStorage. */
export function applyPlannerRessurslisteLocal(): PlannerKjøretøyRapport {
  const tomBil: RessurslisteRapport = {
    biler: 0,
    fjernetBiler: 0,
    fastBilKoblinger: [],
    tilhørighet: [],
    ukjenteNavn: [],
  };
  const tomHenger: HengerRessurslisteRapport = {
    hengere: 0,
    fjernetHengere: 0,
    fastHengerKoblinger: [],
    tilhørighet: [],
    ukjenteNavn: [],
  };

  if (typeof window === "undefined") {
    return { biler: tomBil, hengere: tomHenger };
  }

  const ansatte = lesJson<Ansatt[]>(ANSATTE_KEY, []);
  const eksisterendeBiler = lesJson<Bil[]>(BILER_KEY, []);
  const eksisterendeHengere = lesJson<Henger[]>(HENGER_KEY, []);
  const masterplan = lesJson<MasterRuteplan>(MASTERPLAN_KEY, { syklusLengde: 4, slots: [] });
  const tildelinger = lesJson<PlanRuteTildeling[]>(TILDELING_KEY, []);

  const { biler, ansatte: etterBiler, rapport: bilRapport } = applyPlannerRessursliste(
    ansatte,
    eksisterendeBiler,
  );
  const {
    hengere,
    ansatte: nyeAnsatte,
    rapport: hengerRapport,
  } = applyPlannerHengerRessursliste(etterBiler, eksisterendeHengere);

  const gyldigeBilIds = new Set(biler.map((b) => b.id));
  const gyldigeHengerIds = new Set(hengere.map((h) => h.id));
  let ryddet = ryddBilReferanser(masterplan, tildelinger, gyldigeBilIds);
  ryddet = {
    ...ryddet,
    tildelinger: ryddHengerReferanser(ryddet.tildelinger, gyldigeHengerIds),
  };

  window.localStorage.setItem(BILER_KEY, JSON.stringify(biler));
  window.localStorage.setItem(HENGER_KEY, JSON.stringify(hengere));
  window.localStorage.setItem(ANSATTE_KEY, JSON.stringify(nyeAnsatte));
  window.localStorage.setItem(MASTERPLAN_KEY, JSON.stringify(ryddet.masterplan));
  window.localStorage.setItem(TILDELING_KEY, JSON.stringify(ryddet.tildelinger));

  return { biler: bilRapport, hengere: hengerRapport };
}

export function formatPlannerKjøretøyRapport(r: PlannerKjøretøyRapport): string {
  return `${formatRessurslisteRapport(r.biler)} ${formatHengerRessurslisteRapport(r.hengere)}`;
}
