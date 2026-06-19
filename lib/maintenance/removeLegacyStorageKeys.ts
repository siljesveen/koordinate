/** Fjern localStorage-nøkler fra fjernede stores (dagsplan, turnusmal, turnus4uker). */
const LEGACY_KEYS = [
  "bemanning.dagsplan.v1",
  "bemanning.turnusmal.v1",
  "bemanning.turnus4uker.v1",
] as const;

export function removeLegacyStorageKeys(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignorer — f.eks. privat nettlesermodus
    }
  }
}
