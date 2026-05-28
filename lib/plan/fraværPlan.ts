import { fullNavn, type Ansatt, type Fravær } from "@/lib/domain";

export function overlapperFraværDato(
  post: Pick<Fravær, "fraDato" | "tilDato">,
  dato: string,
): boolean {
  if (dato < post.fraDato) return false;
  if (!post.tilDato) return true;
  return dato <= post.tilDato;
}

export function fraværForAnsattPåDato(
  fravær: Fravær[],
  ansattId: string,
  dato: string,
  type?: Fravær["type"],
): Fravær | undefined {
  return fravær.find(
    (f) =>
      f.ansattId === ansattId &&
      overlapperFraværDato(f, dato) &&
      (type === undefined || f.type === type),
  );
}

export function avspaseringFraværForPlanDag(
  fravær: Fravær[],
  dato: string,
  ansatte: Ansatt[],
): Fravær[] {
  const ansattIds = new Set(ansatte.map((a) => a.id));
  return fravær.filter(
    (f) => f.type === "Avspasering" && overlapperFraværDato(f, dato) && ansattIds.has(f.ansattId),
  );
}

export function avspaseringFraværEntries(args: {
  fravær: Fravær[];
  dato: string;
  ansatte: Ansatt[];
}): Array<{ ansattId: string; visningsnavn: string; planNavn: string }> {
  const ansattById = new Map(args.ansatte.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const entries: Array<{ ansattId: string; visningsnavn: string; planNavn: string }> = [];

  for (const post of avspaseringFraværForPlanDag(args.fravær, args.dato, args.ansatte)) {
    if (seen.has(post.ansattId)) continue;
    const ansatt = ansattById.get(post.ansattId);
    if (!ansatt) continue;
    seen.add(post.ansattId);
    entries.push({
      ansattId: post.ansattId,
      visningsnavn: fullNavn(ansatt),
      planNavn: post.kommentar?.trim() || "Registrert i fravær",
    });
  }

  entries.sort((a, b) => a.visningsnavn.localeCompare(b.visningsnavn, "nb"));
  return entries;
}
