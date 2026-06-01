import { type Ansatt, type Bil, type Henger } from "@/lib/domain";
import { ANSATTE_TILLEGG } from "@/lib/imported/ansatte-tillegg";
import { PLANNER_HENGER_RESSURSLISTE } from "@/lib/imported/plannerHengerRessursliste";
import { PLANNER_RESSURSLISTE } from "@/lib/imported/plannerRessursliste";

function bilId(kjennemerke: string): string {
  return `bil-${kjennemerke.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function normReg(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function hengerId(kjennemerke: string): string {
  return `henger-${kjennemerke.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

const PLANNER_BY_REG = new Map(
  PLANNER_RESSURSLISTE.map((r) => [normReg(r.kjennemerke), r] as const),
);

const PLANNER_HENGER_BY_REG = new Map(
  PLANNER_HENGER_RESSURSLISTE.map((r) => [normReg(r.kjennemerke), r] as const),
);

/** Første bil i planlegger-listen der ansatt står som sjåfør. */
export function computePrimærBilPerAnsatt(): Map<string, string> {
  const map = new Map<string, string>();
  for (const { kjennemerke, sjåførAnsattIds } of PLANNER_RESSURSLISTE) {
    if (!sjåførAnsattIds?.length) continue;
    const bId = bilId(normReg(kjennemerke));
    for (const aid of sjåførAnsattIds) {
      if (!map.has(aid)) map.set(aid, bId);
    }
  }
  return map;
}

/** Første henger i planlegger-listen der ansatt står som sjåfør. */
export function computePrimærHengerPerAnsatt(): Map<string, string> {
  const map = new Map<string, string>();
  for (const { kjennemerke, sjåførAnsattIds } of PLANNER_HENGER_RESSURSLISTE) {
    if (!sjåførAnsattIds?.length) continue;
    const hId = hengerId(normReg(kjennemerke));
    for (const aid of sjåførAnsattIds) {
      if (!map.has(aid)) map.set(aid, hId);
    }
  }
  return map;
}

/** Slår inn sjåfør og tilhørighet fra planlegger uansett hva som ligger i sky/cache. */
export function enrichHengereMedPlanner(hengere: Henger[]): Henger[] {
  if (!hengere.length) return hengere;
  return hengere.map((h) => {
    const p = PLANNER_HENGER_BY_REG.get(normReg(h.kjennemerke));
    if (!p) return h;
    return {
      ...h,
      tilhørighet: p.tilhørighet ?? h.tilhørighet,
      kommentar: p.kommentar.trim() ? p.kommentar : h.kommentar,
      fastSjåførAnsattIds: p.sjåførAnsattIds?.length ? [...p.sjåførAnsattIds] : h.fastSjåførAnsattIds,
    };
  });
}

/** Slår inn sjåfør og tilhørighet fra planlegger uansett hva som ligger i sky/cache. */
export function enrichBilerMedPlanner(biler: Bil[]): Bil[] {
  if (!biler.length) return biler;
  return biler.map((b) => {
    const p = PLANNER_BY_REG.get(normReg(b.kjennemerke));
    if (!p) return b;
    return {
      ...b,
      tilhørighet: p.tilhørighet ?? b.tilhørighet,
      kommentar: p.kommentar.trim() ? p.kommentar : b.kommentar,
      fastSjåførAnsattIds: p.sjåførAnsattIds?.length ? [...p.sjåførAnsattIds] : b.fastSjåførAnsattIds,
    };
  });
}

export function mergeTilleggAnsatte(ansatte: Ansatt[]): Ansatt[] {
  const byId = new Map(ansatte.map((a) => [a.id, a] as const));
  for (const t of ANSATTE_TILLEGG) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return [...byId.values()];
}

export function enrichAnsatteMedPlanner(ansatte: Ansatt[]): Ansatt[] {
  const medTillegg = mergeTilleggAnsatte(ansatte);
  const primærBil = computePrimærBilPerAnsatt();
  const primærHenger = computePrimærHengerPerAnsatt();
  return medTillegg.map((a) => ({
    ...a,
    fastBilId: primærBil.get(a.id) ?? a.fastBilId,
    fastHengerId: primærHenger.get(a.id) ?? a.fastHengerId,
  }));
}

/** Sjekk om lagrede biler mangler sjåfør-koblinger (sky har gammel data). */
export function bilerManglerPlannerSjåfør(biler: Bil[]): boolean {
  if (!Array.isArray(biler) || biler.length < 40) return true;
  const medSjåfør = biler.filter((b) => (b.fastSjåførAnsattIds?.length ?? 0) > 0).length;
  return medSjåfør < 20;
}

/** Sjekk om lagrede hengere mangler sjåfør-koblinger (sky har gammel data). */
export function hengereManglerPlannerSjåfør(hengere: Henger[]): boolean {
  if (!Array.isArray(hengere) || hengere.length < 35) return true;
  const medSjåfør = hengere.filter((h) => (h.fastSjåførAnsattIds?.length ?? 0) > 0).length;
  return medSjåfør < 15;
}
