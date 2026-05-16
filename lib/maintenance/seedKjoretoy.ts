import {
  IMPORTERTE_BILER_REFERANSE_2026,
  IMPORTERTE_HENGERE_REFERANSE_2026,
} from "@/lib/imported/kjoretoy-referanse-2026";

const BILER_KEY = "bemanning.biler.v1";
const HENGER_KEY = "bemanning.henger.v1";

function lagretTomEllerUgyldig(key: string): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as unknown;
    return !Array.isArray(parsed) || parsed.length === 0;
  } catch {
    return true;
  }
}

/** Skriver standard bil/henger-lister til localStorage hvis mangler eller tomme. */
export function seedKjoretoyHvisTomt(): { biler: boolean; hengere: boolean } {
  if (typeof window === "undefined") return { biler: false, hengere: false };

  let biler = false;
  let hengere = false;

  if (lagretTomEllerUgyldig(BILER_KEY)) {
    window.localStorage.setItem(BILER_KEY, JSON.stringify(IMPORTERTE_BILER_REFERANSE_2026));
    biler = true;
  }
  if (lagretTomEllerUgyldig(HENGER_KEY)) {
    window.localStorage.setItem(HENGER_KEY, JSON.stringify(IMPORTERTE_HENGERE_REFERANSE_2026));
    hengere = true;
  }

  return { biler, hengere };
}

/** Tving inn standardliste (beholder ikke eksisterende data). */
export function gjenopprettStandardKjoretoy(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BILER_KEY, JSON.stringify(IMPORTERTE_BILER_REFERANSE_2026));
  window.localStorage.setItem(HENGER_KEY, JSON.stringify(IMPORTERTE_HENGERE_REFERANSE_2026));
}
