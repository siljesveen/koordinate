/** Alfabetisk sortering (norsk, numerisk). */
export function compareNb(a: string, b: string): number {
  return a.localeCompare(b, "nb", { numeric: true, sensitivity: "base" });
}
