const KJORETOY_BACKFILL_KEY = "bemanning.masterplan.kjoretoyFraAnsatt.v1";

export function erKjoretoyBackfillApplied(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KJORETOY_BACKFILL_KEY) === "1";
}

export function merkKjoretoyBackfillApplied(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KJORETOY_BACKFILL_KEY, "1");
}
