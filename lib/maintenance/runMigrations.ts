import { migratePlanAvspaseringToFravær } from "./migratePlanAvspasering";

/** Engangsmigreringer som ikke sletter eller overskriver masterdata. */
export function runMigrations(): void {
  if (typeof window === "undefined") return;
  migratePlanAvspaseringToFravær();
}
