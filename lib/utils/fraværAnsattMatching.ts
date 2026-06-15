import type { Ansatt, Fravær } from "@/lib/domain";

export function normalizeNavn(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Ǿø]/gi, "o")
    .replace(/[åä]/gi, "a")
    .replace(/[æ]/gi, "ae")
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Excel-format: «Etternavn, Fornavn». */
export function parseExcelNavn(raw: string): { fornavn: string; etternavn: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.includes(",")) return null;
  const [etternavn, ...rest] = trimmed.split(",").map((s) => s.trim());
  const fornavn = rest.join(" ").trim();
  if (!etternavn || !fornavn) return null;
  return { fornavn, etternavn };
}

/** Fallback når JSON har «Fornavn Etternavn» uten komma. */
export function parseFrittNavn(raw: string): { fornavn: string; etternavn: string } | null {
  const parts = raw
    .trim()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (parts.length < 2) return null;
  return {
    etternavn: parts[parts.length - 1],
    fornavn: parts.slice(0, -1).join(" "),
  };
}

export function parseDriverNavn(raw: string): { fornavn: string; etternavn: string } | null {
  return parseExcelNavn(raw) ?? parseFrittNavn(raw);
}

export function ansattNavnNøkkel(fornavn: string, etternavn: string): string {
  return normalizeNavn(`${etternavn}, ${fornavn}`);
}

export function buildAnsattNavnIndex(ansatte: Ansatt[]): {
  index: Map<string, string>;
  kollisjoner: Array<{ nøkkel: string; id1: string; id2: string; navn1: string; navn2: string }>;
} {
  const index = new Map<string, string>();
  const navn = new Map<string, string>();
  const kollisjoner: Array<{ nøkkel: string; id1: string; id2: string; navn1: string; navn2: string }> = [];

  for (const ansatt of ansatte) {
    const nøkkel = ansattNavnNøkkel(ansatt.fornavn, ansatt.etternavn);
    const visning = `${ansatt.fornavn} ${ansatt.etternavn}`.trim();
    if (index.has(nøkkel)) {
      kollisjoner.push({
        nøkkel,
        id1: index.get(nøkkel)!,
        id2: ansatt.id,
        navn1: navn.get(nøkkel) ?? "",
        navn2: visning,
      });
    }
    index.set(nøkkel, ansatt.id);
    navn.set(nøkkel, visning);
  }

  return { index, kollisjoner };
}

export function matchAnsattIdForDriverNavn(raw: string, ansatte: Ansatt[]): string | null {
  const parsed = parseDriverNavn(raw);
  if (!parsed) return null;
  const { index } = buildAnsattNavnIndex(ansatte);
  const eksakt = index.get(ansattNavnNøkkel(parsed.fornavn, parsed.etternavn));
  if (eksakt) return eksakt;

  const etternavnNøkkel = normalizeNavn(parsed.etternavn);
  const fornavnNøkkel = normalizeNavn(parsed.fornavn);
  const kandidater = ansatte.filter((a) => {
    if (normalizeNavn(a.etternavn) !== etternavnNøkkel) return false;
    const ansattFornavn = normalizeNavn(a.fornavn);
    return ansattFornavn.startsWith(fornavnNøkkel) || fornavnNøkkel.startsWith(ansattFornavn.split(" ")[0] ?? "");
  });

  if (kandidater.length === 1) return kandidater[0].id;
  return null;
}

export type FraværValidering = {
  foreldreløse: Fravær[];
  ukjenteAnsattId: string[];
  duplikatNavn: Array<{ nøkkel: string; id1: string; id2: string; navn1: string; navn2: string }>;
};

export function validerFraværMotAnsatte(fravær: Fravær[], ansatte: Ansatt[]): FraværValidering {
  const ansattIds = new Set(ansatte.map((a) => a.id));
  const { kollisjoner } = buildAnsattNavnIndex(ansatte);
  const foreldreløse = fravær.filter((f) => !ansattIds.has(f.ansattId));
  const ukjenteAnsattId = [...new Set(foreldreløse.map((f) => f.ansattId))];
  return { foreldreløse, ukjenteAnsattId, duplikatNavn: kollisjoner };
}
