/** Normaliserer tid til HH:mm (24-timers). Returnerer null ved ugyldig input. */
export function normaliserTidInput(raw: string): string | null {
  const t = raw.trim().replace(".", ":");
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
