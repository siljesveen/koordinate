import { migratePlanAvspaseringToFravær } from "./migratePlanAvspasering";
import { removeLegacyStorageKeys } from "./removeLegacyStorageKeys";

/** Engangsmigreringer som ikke sletter eller overskriver masterdata. */
export function runMigrations(): void {
  if (typeof window === "undefined") return;
  migratePlanAvspaseringToFravær();
  removeLegacyStorageKeys();
}
