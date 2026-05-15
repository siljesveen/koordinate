/** Tømmer alle ansatte og rydder referanser i andre lag. */

const ANSATTE_KEY = "bemanning.ansatte.v2";
const FRAVAER_KEY = "bemanning.fravaer.v1";
const TURNUS_KEY = "bemanning.turnus4uker.v1";
const TILDELING_KEY = "bemanning.planRuteTildeling.v2";
const MASTERPLAN_KEY = "bemanning.masterplan.v1";

export function clearAllAnsatteData(): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(ANSATTE_KEY, "[]");
  window.localStorage.setItem(FRAVAER_KEY, "[]");
  window.localStorage.setItem(TURNUS_KEY, "[]");

  try {
    const rawTil = window.localStorage.getItem(TILDELING_KEY);
    if (rawTil) {
      const tildelinger = JSON.parse(rawTil) as unknown;
      if (Array.isArray(tildelinger)) {
        const oppdatert = tildelinger.map((t) => {
          if (!t || typeof t !== "object") return t;
          const copy = { ...(t as Record<string, unknown>) };
          delete copy.ansattId;
          return copy;
        });
        window.localStorage.setItem(TILDELING_KEY, JSON.stringify(oppdatert));
      }
    }
  } catch {
    // ignorer
  }

  try {
    const rawMp = window.localStorage.getItem(MASTERPLAN_KEY);
    if (rawMp) {
      const plan = JSON.parse(rawMp) as { slots?: unknown[] };
      if (plan && Array.isArray(plan.slots)) {
        plan.slots = plan.slots.map((s) => {
          if (!s || typeof s !== "object") return s;
          const slot = { ...(s as Record<string, unknown>) };
          delete slot.standardSjåførAnsattId;
          return slot;
        });
        window.localStorage.setItem(MASTERPLAN_KEY, JSON.stringify(plan));
      }
    }
  } catch {
    // ignorer
  }
}
