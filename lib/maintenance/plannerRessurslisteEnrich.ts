import type { Ansatt } from "@/lib/domain";
import { ANSATTE_TILLEGG } from "@/lib/imported/ansatte-tillegg";

export function mergeTilleggAnsatte(ansatte: Ansatt[]): Ansatt[] {
  const byId = new Map(ansatte.map((a) => [a.id, a] as const));
  for (const t of ANSATTE_TILLEGG) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return [...byId.values()];
}
