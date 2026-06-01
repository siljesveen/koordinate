import {
  fullNavn,
  type Ansatt,
  type BilTilhørighet,
  type Henger,
  type PlanRuteTildeling,
} from "@/lib/domain";
import { PLANNER_HENGER_RESSURSLISTE } from "@/lib/imported/plannerHengerRessursliste";
import { mergeTilleggAnsatte } from "@/lib/maintenance/plannerRessurslisteEnrich";

function hengerId(kjennemerke: string): string {
  return `henger-${kjennemerke.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function normReg(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export type HengerRessurslisteRapport = {
  hengere: number;
  fjernetHengere: number;
  fastHengerKoblinger: { kjennemerke: string; sjåfør: string }[];
  tilhørighet: { kjennemerke: string; tilhørighet: BilTilhørighet }[];
  ukjenteNavn: { kjennemerke: string; navn: string }[];
};

export function applyPlannerHengerRessursliste(
  ansatte: Ansatt[],
  eksisterendeHengere: Henger[],
): { hengere: Henger[]; ansatte: Ansatt[]; rapport: HengerRessurslisteRapport } {
  const ansatteMedTillegg = mergeTilleggAnsatte(ansatte);
  const ansattById = new Map(ansatteMedTillegg.map((a) => [a.id, a] as const));
  const gyldigeHengerIds = new Set(
    PLANNER_HENGER_RESSURSLISTE.map((r) => hengerId(normReg(r.kjennemerke))),
  );
  const gammelById = new Map(eksisterendeHengere.map((h) => [h.id, h] as const));

  const rapport: HengerRessurslisteRapport = {
    hengere: PLANNER_HENGER_RESSURSLISTE.length,
    fjernetHengere: eksisterendeHengere.filter((h) => !gyldigeHengerIds.has(h.id)).length,
    fastHengerKoblinger: [],
    tilhørighet: [],
    ukjenteNavn: [],
  };

  const nyeHengere: Henger[] = PLANNER_HENGER_RESSURSLISTE.map(
    ({ kjennemerke, kommentar, tilhørighet, sjåførAnsattIds }) => {
      const id = hengerId(normReg(kjennemerke));
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
        rapport.fastHengerKoblinger.push({
          kjennemerke: reg,
          sjåfør: fullNavn(ansattById.get(aid)!),
        });
      }

      return {
        id,
        kjennemerke: reg,
        aktiv: true,
        type: gammel?.type,
        tilhørighet,
        kommentar: kommentar.trim() || gammel?.kommentar,
        fastSjåførAnsattIds: gyldigeSjåførIds.length ? gyldigeSjåførIds : undefined,
      };
    },
  );

  const nyeAnsatte = ansatteMedTillegg.map((a) => ({
    ...a,
    fastHengerId: undefined as string | undefined,
  }));

  for (const { kjennemerke, sjåførAnsattIds } of PLANNER_HENGER_RESSURSLISTE) {
    const hId = hengerId(normReg(kjennemerke));
    for (const aid of sjåførAnsattIds ?? []) {
      if (!ansattById.has(aid)) continue;
      const idx = nyeAnsatte.findIndex((a) => a.id === aid);
      if (idx >= 0) {
        nyeAnsatte[idx] = { ...nyeAnsatte[idx], fastHengerId: hId };
      }
    }
  }

  return { hengere: nyeHengere, ansatte: nyeAnsatte, rapport };
}

export function ryddHengerReferanser(
  tildelinger: PlanRuteTildeling[],
  gyldigeHengerIds: Set<string>,
): PlanRuteTildeling[] {
  return tildelinger.map((t) =>
    t.hengerId && !gyldigeHengerIds.has(t.hengerId) ? { ...t, hengerId: undefined } : t,
  );
}

export function formatHengerRessurslisteRapport(r: HengerRessurslisteRapport): string {
  const linjer = [
    `${r.hengere} hengere satt (fjernet ${r.fjernetHengere} andre).`,
    `${r.fastHengerKoblinger.length} sjåfør-koblinger på hengere.`,
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
