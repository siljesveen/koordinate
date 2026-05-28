import type { Fravær } from "@/lib/domain";

const MIGRATION_KEY = "bemanning.migration.planAvspaseringToFravaer.v1";
const OLD_KEY = "bemanning.planAvspasering.v1";
const FRAVÆR_KEY = "bemanning.fravaer.v1";

type LegacyPlanAvspasering = {
  id: string;
  ansattId: string;
  dato: string;
  kommentar?: string;
};

function nyFraværId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Flytt eldre plan-avspasering til fravær med type Avspasering. */
export function migratePlanAvspaseringToFravær(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(MIGRATION_KEY)) return;

  const raw = window.localStorage.getItem(OLD_KEY);
  if (raw) {
    try {
      const legacy = JSON.parse(raw) as LegacyPlanAvspasering[];
      if (Array.isArray(legacy) && legacy.length > 0) {
        const eksisterende = JSON.parse(window.localStorage.getItem(FRAVÆR_KEY) || "[]") as Fravær[];
        const fravær = Array.isArray(eksisterende) ? [...eksisterende] : [];
        const nøkler = new Set(
          fravær
            .filter((f) => f.type === "Avspasering")
            .map((f) => `${f.ansattId}:${f.fraDato}:${f.tilDato}`),
        );

        for (const post of legacy) {
          if (!post?.ansattId || !post?.dato) continue;
          const nøkkel = `${post.ansattId}:${post.dato}:${post.dato}`;
          if (nøkler.has(nøkkel)) continue;
          nøkler.add(nøkkel);
          fravær.unshift({
            id: post.id || nyFraværId(),
            ansattId: post.ansattId,
            type: "Avspasering",
            fraDato: post.dato,
            tilDato: post.dato,
            planlagt: true,
            kommentar: post.kommentar ?? "Migrert fra plan-avspasering",
          });
        }

        window.localStorage.setItem(FRAVÆR_KEY, JSON.stringify(fravær));
      }
    } catch {
      /* ignorer korrupt legacy-data */
    }
    window.localStorage.removeItem(OLD_KEY);
  }

  window.localStorage.setItem(MIGRATION_KEY, "1");
}
