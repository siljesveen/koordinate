import { fullNavn, type Ansatt } from "@/lib/domain";

/** Synk med scripts/lib/masterplanUkeImport.mjs */
export const BEKREFTET_ALIAS: Record<string, string> = {
  josse: "a-john-arne-johnsen",
  rufad: "a-ferad-mehmed-rufad",
  bakshi: "a-mohammad-bakhshi",
  baksi: "a-mohammad-bakhshi",
  m3: "a-mohammad-bakhshi",
  "christian e": "a-christian-elvestad",
  christian: "a-christian-elvestad",
  oivind: "a-yvind-hagen",
  oyvind: "a-yvind-hagen",
  arturs: "a-arturs-dambrovskis",
  "ivan j": "a-ivan-morgan-johansen",
  "roger m": "a-roger-moseng",
  "roger s": "a-roger-skogheim",
  "john o": "a-john-olav-lundstad",
  "john olav": "a-john-olav-lundstad",
  pelle: "a-per-ola-ake-lundgren",
  frode: "a-frode-degardstuen",
  "andre o": "a-andre-stli",
  "andre ø": "a-andre-stli",
  "thomas o": "a-thomas-yen",
  "thomas ø": "a-thomas-yen",
  "frode o": "a-frode-degardstuen",
  "frode ø": "a-frode-degardstuen",
  "morten b": "a-morten-bakken",
  "morten s": "a-morten-steinbakken",
  morten: "a-morten-steinbakken",
  "trond h": "a-trond-hagen",
  "rune b": "a-rune-berntsen",
  "rune be": "a-rune-berntsen",
  "jorn s": "a-jorn-sanaker",
  "jørn s": "a-jorn-sanaker",
  andresj: "a-andrejs-seleznovs",
  ruffad: "a-ferad-mehmed-rufad",
  roger: "a-roger-moseng",
  thomas: "a-thomas-yen",
};

const IKKE_PERSON = new Set([
  "",
  "avspasering:",
  "tilgjengelig:",
  "bring 1",
  "bring 2",
  "bring 3",
  "gdf",
  "gdf 1",
  "gdf 2",
  "gdf 3",
  "gdf1",
  "gdf2",
  "gdf3",
  "tf1",
  "tf2",
  "tf3",
  "vd rute",
  "vd/sesong",
  "sesong",
  "ledig kveld",
  "(sesong)",
  "v-d",
]);

export function normaliserPlanNavn(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae")
    .trim();
}

export function erIkkePersonNavn(navn: string): boolean {
  const n = normaliserPlanNavn(navn).replace(/\.$/, "");
  if (IKKE_PERSON.has(n)) return true;
  if (/^bring\s*\d/i.test(navn)) return true;
  if (/^gdf\s*\d/i.test(navn)) return true;
  if (/^tf\d/i.test(navn)) return true;
  if (/rute$/i.test(String(navn).trim())) return true;
  if (/^sesong/i.test(navn)) return true;
  if (/^\(sesong\)$/i.test(String(navn).trim())) return true;
  return false;
}

export type PlanNavnMatch =
  | { type: "match"; ansatt: Ansatt; planNavn: string }
  | { type: "hopp_over"; planNavn: string }
  | { type: "ukjent"; planNavn: string }
  | { type: "tvetydig"; planNavn: string; kandidater: Array<{ id: string; navn: string }> };

function aliasNøkkel(navn: string): string {
  return normaliserPlanNavn(navn).replace(/\s+/g, " ").trim();
}

export function matchPlanNavnTilAnsatt(planNavn: string, ansatte: Ansatt[]): PlanNavnMatch {
  if (erIkkePersonNavn(planNavn)) {
    return { type: "hopp_over", planNavn };
  }

  const rå = String(planNavn).trim();
  const ansattById = new Map(ansatte.map((a) => [a.id, a]));
  const aliasId = BEKREFTET_ALIAS[aliasNøkkel(rå)];
  if (aliasId) {
    const ansatt = ansattById.get(aliasId);
    if (ansatt) {
      return { type: "match", ansatt, planNavn: rå };
    }
  }

  const deler = rå.split(/\s+/);
  const fornavnDel = deler[0];
  const initial = deler[1]?.replace(/\.$/, "");

  const kandidater = ansatte.filter((a) => {
    const fn = normaliserPlanNavn(a.fornavn);
    const en = normaliserPlanNavn(a.etternavn);
    const hele = normaliserPlanNavn(fullNavn(a));
    const pdfFn = normaliserPlanNavn(fornavnDel);

    const fornavnOrd = fn.split(/\s+/);
    if (fornavnOrd[0] === pdfFn || fn.startsWith(pdfFn + " ")) {
      if (initial) {
        return (
          en.startsWith(normaliserPlanNavn(initial)) ||
          hele.includes(normaliserPlanNavn(initial)) ||
          fn.includes(normaliserPlanNavn(initial))
        );
      }
      return true;
    }

    if (pdfFn === "chien" && fn.includes("cien")) return true;
    if (pdfFn === "pelle" && fn.startsWith("per ola")) return true;
    if (pdfFn === "juri" && fn.startsWith("jurij")) return true;
    if (pdfFn === "dawid" && fn.startsWith("david")) return true;
    if (pdfFn === "hakon" && fn.startsWith("hakon")) return true;
    if (pdfFn === "morten" && initial === "B" && en.startsWith("bak")) return true;
    if (pdfFn === "roger" && initial === "M" && en === "moseng") return true;
    if (pdfFn === "roger" && initial === "S" && en === "skogheim" && !fn.includes("haug"))
      return true;
    if (pdfFn === "thomas" && (initial === "O" || initial === "Ø") && en.startsWith("oy"))
      return true;
    if (pdfFn === "andre" && (initial === "O" || initial === "Ø") && en.startsWith("ost"))
      return true;
    if (pdfFn === "frode" && (initial === "O" || initial === "Ø") && en.includes("deg"))
      return true;
    if (pdfFn === "john" && initial === "O" && fn.includes("olav") && en === "lundstad")
      return true;
    if (pdfFn === "john" && initial === "J" && fn.includes("morgan")) return true;
    if (pdfFn === "morten" && initial === "S" && en.startsWith("stein")) return true;
    if ((pdfFn === "jorn" || pdfFn === "jorn") && initial === "S" && en.startsWith("sanak"))
      return true;
    if (pdfFn === "rune" && initial?.toLowerCase().startsWith("b") && en.startsWith("ber"))
      return true;
    if (pdfFn === "trond" && initial === "H" && en.startsWith("hag")) return true;
    if (pdfFn === "arnt" && deler[1]?.toLowerCase() === "georg") {
      return fn.includes("arnt") && en.includes("georg");
    }
    if (pdfFn === "ronny" && en === "ronny") return true;
    if (pdfFn === "stein" && initial === "A" && fn.includes("arve")) return true;
    if (pdfFn === "stein" && normaliserPlanNavn(deler.slice(1).join(" ")).includes("arve"))
      return fn.includes("arve");
    if (pdfFn === "rune" && initial === "B" && en.startsWith("bje")) return true;
    if (pdfFn === "amund" && fn.startsWith("amund")) return true;
    if (pdfFn === "jack" && fn === "jack") return true;
    if (pdfFn === "josse") return a.id === "a-john-arne-johnsen";
    if (pdfFn === "rufad") return a.id === "a-ferad-mehmed-rufad";
    if (pdfFn === "bakshi") return a.id === "a-mohammad-bakhshi";
    if (pdfFn === "oivind") return a.id === "a-yvind-hagen";
    if (pdfFn === "christian") return a.id === "a-christian-elvestad";

    return false;
  });

  if (kandidater.length === 0) {
    return { type: "ukjent", planNavn: rå };
  }
  if (kandidater.length === 1) {
    return { type: "match", ansatt: kandidater[0], planNavn: rå };
  }
  return {
    type: "tvetydig",
    planNavn: rå,
    kandidater: kandidater.map((a) => ({ id: a.id, navn: fullNavn(a) })),
  };
}
