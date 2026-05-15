import { clearAllAnsatteData } from "./clearAllAnsatte";

const CLEAR_ANSATTE_MIGRATION = "bemanning.migration.clearAnsatte20260515";

/** Engangsmigreringer som kjøres én gang per nettleser. */
export function runMigrations(): void {
  if (typeof window === "undefined") return;

  if (!window.localStorage.getItem(CLEAR_ANSATTE_MIGRATION)) {
    clearAllAnsatteData();
    window.localStorage.setItem(CLEAR_ANSATTE_MIGRATION, "1");
  }
}
