import { fullNavn, type Ansatt } from "@/lib/domain";
import { compareNb } from "@/lib/utils/sort";

function normaliserTekst(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Sjekker om søketekst matcher navn (hele streng, ord for ord, eller fornavn/etternavn). */
export function navnMatcherSøk(ansatt: Ansatt, søk: string): boolean {
  const q = normaliserTekst(søk.trim());
  if (!q) return false;
  const hele = normaliserTekst(fullNavn(ansatt));
  const fornavn = normaliserTekst(ansatt.fornavn.trim());
  const etternavn = normaliserTekst(ansatt.etternavn.trim());
  const qKompakt = q.replace(/\s+/g, "");

  if (
    hele.includes(q) ||
    fornavn.includes(q) ||
    etternavn.includes(q) ||
    hele.replace(/\s+/g, "").includes(qKompakt)
  ) {
    return true;
  }

  const ord = q.split(/\s+/).filter(Boolean);
  if (ord.length > 1) {
    return ord.every((o) => hele.includes(o) || fornavn.includes(o) || etternavn.includes(o));
  }
  return false;
}

function leggNavn(map: Map<string, string[]>, kjoretoyId: string, navn: string) {
  const liste = map.get(kjoretoyId) ?? [];
  if (!liste.includes(navn)) liste.push(navn);
  map.set(kjoretoyId, liste);
}

export function byggSjåførNavnPerKjoretoy(
  ansatte: Ansatt[],
  fastIdFraAnsatt: (a: Ansatt) => string | undefined,
  ekstra?: ReadonlyMap<string, string> | Record<string, string>,
): Map<string, string> {
  const rå = new Map<string, string[]>();

  for (const a of ansatte) {
    if (a.aktiv === false) continue;
    const id = fastIdFraAnsatt(a);
    if (!id) continue;
    leggNavn(rå, id, fullNavn(a));
  }

  if (ekstra) {
    const entries =
      ekstra instanceof Map ? ekstra.entries() : Object.entries(ekstra);
    for (const [id, navn] of entries) {
      if (!id || !navn?.trim()) continue;
      for (const del of navn.split(",").map((s: string) => s.trim()).filter(Boolean)) {
        leggNavn(rå, id, del);
      }
    }
  }

  const vis = new Map<string, string>();
  for (const [id, navn] of rå) {
    navn.sort((x, y) => compareNb(x, y));
    vis.set(id, navn.join(", "));
  }
  return vis;
}
