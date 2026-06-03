import type { UkeNummer } from "@/lib/imported/applyUkeMasterplan";

/** Lokale meta-nøkler — ikke i APP_DATA_KEYS / Supabase. */
export const UKE_IMPORT_META_KEYS: Record<UkeNummer, string> = {
  1: "bemanning.uke1ImportApplied.v2",
  2: "bemanning.uke2ImportApplied.v1",
  3: "bemanning.uke3ImportApplied.v1",
  4: "bemanning.uke4ImportApplied.v2",
};

export function erUkeImportApplied(uke: UkeNummer, patchVersjon: string): boolean {
  if (typeof window === "undefined" || !patchVersjon) return false;
  return window.localStorage.getItem(UKE_IMPORT_META_KEYS[uke]) === patchVersjon;
}

export function merkUkeImportApplied(uke: UkeNummer, patchVersjon: string): void {
  if (typeof window === "undefined" || !patchVersjon) return;
  window.localStorage.setItem(UKE_IMPORT_META_KEYS[uke], patchVersjon);
}
