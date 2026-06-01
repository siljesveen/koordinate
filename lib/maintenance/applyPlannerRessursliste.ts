import {
  fullNavn,
  type Ansatt,
  type Bil,
  type BilTilhørighet,
  type MasterRuteplan,
  type PlanRuteTildeling,
} from "@/lib/domain";
import { PLANNER_RESSURSLISTE } from "@/lib/imported/plannerRessursliste";
import { ANSATTE_TILLEGG } from "@/lib/imported/ansatte-tillegg";

function bilId(kjennemerke: string): string {
  return `bil-${kjennemerke.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function normReg(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export type RessurslisteRapport = {
  biler: number;
  fjernetBiler: number;
  fastBilKoblinger: { kjennemerke: string; sjåfør: string }[];
  tilhørighet: { kjennemerke: string; tilhørighet: BilTilhørighet }[];
  ukjenteNavn: { kjennemerke: string; navn: string }[];
};

function mergeTilleggAnsatte(ansatte: Ansatt[]): Ansatt[] {
  const byId = new Map(ansatte.map((a) => [a.id, a] as const));
  for (const t of ANSATTE_TILLEGG) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return [...byId.values()];
}

export function applyPlannerRessursliste(
  ansatte: Ansatt[],
  eksisterendeBiler: Bil[],
): { biler: Bil[]; ansatte: Ansatt[]; rapport: RessurslisteRapport } {
  const ansatteMedTillegg = mergeTilleggAnsatte(ansatte);
  const ansattById = new Map(ansatteMedTillegg.map((a) => [a.id, a] as const));
  const gyldigeBilIds = new Set(PLANNER_RESSURSLISTE.map((r) => bilId(normReg(r.kjennemerke))));
  const gammelById = new Map(eksisterendeBiler.map((b) => [b.id, b] as const));

  const rapport: RessurslisteRapport = {
    biler: PLANNER_RESSURSLISTE.length,
    fjernetBiler: eksisterendeBiler.filter((b) => !gyldigeBilIds.has(b.id)).length,
    fastBilKoblinger: [],
    tilhørighet: [],
    ukjenteNavn: [],
  };

  const nyeBiler: Bil[] = PLANNER_RESSURSLISTE.map(({ kjennemerke, kommentar, tilhørighet, sjåførAnsattIds }) => {
    const id = bilId(normReg(kjennemerke));
    const gammel = gammelById.get(id);
    const reg = normReg(kjennemerke);
    const gyldigeSjåførIds = (sjåførAnsattIds ?? []).filter((aid) => {
      if (ansattById.has(aid)) return true;
      rapport.ukjenteNavn.push({ kjennemerke: reg, navn: aid });
      return false;
    });

    if (tilhørighet) {
      rapport.tilhørighet.push({ kjennemerke: reg, tilhørighet });
    }
    for (const aid of gyldigeSjåførIds) {
      const a = ansattById.get(aid)!;
      rapport.fastBilKoblinger.push({ kjennemerke: reg, sjåfør: fullNavn(a) });
    }

    return {
      id,
      kjennemerke: reg,
      aktiv: true,
      merke: gammel?.merke,
      modell: gammel?.modell,
      tilhørighet,
      kommentar: kommentar.trim() || gammel?.kommentar,
      fastSjåførAnsattIds: gyldigeSjåførIds.length ? gyldigeSjåførIds : undefined,
    };
  });

  const bilIdByReg = new Map(nyeBiler.map((b) => [b.kjennemerke, b.id] as const));
  const primærBilForAnsatt = new Map<string, string>();

  for (const { kjennemerke, sjåførAnsattIds } of PLANNER_RESSURSLISTE) {
    const bId = bilIdByReg.get(normReg(kjennemerke));
    if (!bId || !sjåførAnsattIds?.length) continue;
    for (const aid of sjåførAnsattIds) {
      if (!ansattById.has(aid) || primærBilForAnsatt.has(aid)) continue;
      primærBilForAnsatt.set(aid, bId);
    }
  }

  const nyeAnsatte = ansatteMedTillegg.map((a) => ({
    ...a,
    fastBilId: primærBilForAnsatt.get(a.id),
  }));

  return { biler: nyeBiler, ansatte: nyeAnsatte, rapport };
}

/** Fjern referanser til biler som ikke lenger finnes. */
export function ryddBilReferanser(
  masterplan: MasterRuteplan,
  tildelinger: PlanRuteTildeling[],
  gyldigeBilIds: Set<string>,
): { masterplan: MasterRuteplan; tildelinger: PlanRuteTildeling[] } {
  return {
    masterplan: {
      ...masterplan,
      slots: masterplan.slots.map((s) =>
        s.standardBilId && !gyldigeBilIds.has(s.standardBilId)
          ? { ...s, standardBilId: undefined }
          : s,
      ),
    },
    tildelinger: tildelinger.map((t) =>
      t.bilId && !gyldigeBilIds.has(t.bilId) ? { ...t, bilId: undefined } : t,
    ),
  };
}

export function formatRessurslisteRapport(r: RessurslisteRapport): string {
  const linjer = [
    `${r.biler} biler satt (fjernet ${r.fjernetBiler} andre).`,
    `${r.fastBilKoblinger.length} sjåfør-koblinger på biler.`,
    `${r.tilhørighet.length} med tilhørighet (Reserve/Bring/GDF/TF).`,
  ];
  if (r.ukjenteNavn.length) {
    linjer.push(
      `${r.ukjenteNavn.length} ID-er ikke funnet: ${r.ukjenteNavn
        .slice(0, 5)
        .map((u) => `${u.navn} (${u.kjennemerke})`)
        .join(", ")}${r.ukjenteNavn.length > 5 ? " …" : ""}`,
    );
  }
  return linjer.join(" ");
}
