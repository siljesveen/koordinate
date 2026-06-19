export type PlanSkift = "Dag" | "Kveld";

export function isoDato(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODateInput(value: string): Date {
  const [y, m, d] = value.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function overlapperDato(
  p: { fraDato: string; tilDato?: string },
  dato: string,
): boolean {
  if (dato < p.fraDato) return false;
  if (!p.tilDato) return true;
  return dato <= p.tilDato;
}
