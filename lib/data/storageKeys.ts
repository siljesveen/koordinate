/** localStorage-nøkler som speiles i Supabase `app_data`. */
export const APP_DATA_KEYS = [
  "bemanning.ansatte.v2",
  "bemanning.masterplan.v1",
  "bemanning.planRuteTildeling.v2",
  "bemanning.dagendring.v1",
  "bemanning.fravaer.v1",
  "bemanning.plan.v1",
  "bemanning.biler.v1",
  "bemanning.henger.v1",
  "bemanning.bilUtilgjengelig.v1",
  "bemanning.hengerUtilgjengelig.v1",
  "bemanning.skiftTilgjengelighet.v1",
  "bemanning.reserveTilgjengelighet.v1",
  "bemanning.henting.v1",
  "bemanning.hentingDag.v1",
] as const;

export type AppDataKey = (typeof APP_DATA_KEYS)[number];

const SYNC_FLAG = "koordinate.syncedToSupabase.v1";

export function erSyncedTilSupabase(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SYNC_FLAG) === "1";
}

export function merkSyncedTilSupabase(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SYNC_FLAG, "1");
}
