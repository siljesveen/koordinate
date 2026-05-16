import { clearAllAnsatteData } from "./clearAllAnsatte";
import { seedKjoretoyHvisTomt } from "./seedKjoretoy";

const CLEAR_ANSATTE_MIGRATION = "bemanning.migration.clearAnsatte20260515";
/** Engangsmigreringer som kjøres én gang per nettleser. */
export function runMigrations(): void {
  if (typeof window === "undefined") return;

  if (!window.localStorage.getItem(CLEAR_ANSATTE_MIGRATION)) {
    clearAllAnsatteData();
    window.localStorage.setItem(CLEAR_ANSATTE_MIGRATION, "1");
  }

  /* Hver oppstart: fyll inn bil/henger hvis listen i localStorage er tom/ugyldig. */
  seedKjoretoyHvisTomt();
}
