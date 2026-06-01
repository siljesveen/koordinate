import type { Ansatt, Bil, Henger } from "@/lib/domain";

/** Oppdater bil.fastSjåførAnsattIds når ansatt.fastBilId endres. */
export function syncBilerEtterAnsattFastBil(
  biler: Bil[],
  ansattId: string,
  nyFastBilId: string | undefined,
  gammelFastBilId?: string,
): Bil[] {
  return biler.map((b) => {
    let ids = [...(b.fastSjåførAnsattIds ?? [])];
    let endret = false;

    if (gammelFastBilId && b.id === gammelFastBilId && gammelFastBilId !== nyFastBilId) {
      const filtrert = ids.filter((id) => id !== ansattId);
      if (filtrert.length !== ids.length) {
        ids = filtrert;
        endret = true;
      }
    }

    if (nyFastBilId && b.id === nyFastBilId && !ids.includes(ansattId)) {
      ids.push(ansattId);
      endret = true;
    }

    if (!endret) return b;
    return { ...b, fastSjåførAnsattIds: ids.length ? ids : undefined };
  });
}

/** Oppdater henger.fastSjåførAnsattIds når ansatt.fastHengerId endres. */
export function syncHengereEtterAnsattFastHenger(
  hengere: Henger[],
  ansattId: string,
  nyFastHengerId: string | undefined,
  gammelFastHengerId?: string,
): Henger[] {
  return hengere.map((h) => {
    let ids = [...(h.fastSjåførAnsattIds ?? [])];
    let endret = false;

    if (gammelFastHengerId && h.id === gammelFastHengerId && gammelFastHengerId !== nyFastHengerId) {
      const filtrert = ids.filter((id) => id !== ansattId);
      if (filtrert.length !== ids.length) {
        ids = filtrert;
        endret = true;
      }
    }

    if (nyFastHengerId && h.id === nyFastHengerId && !ids.includes(ansattId)) {
      ids.push(ansattId);
      endret = true;
    }

    if (!endret) return h;
    return { ...h, fastSjåførAnsattIds: ids.length ? ids : undefined };
  });
}
