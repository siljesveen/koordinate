export const BIL_UTILGJENGELIG_CHANNEL = "koordinate-bil-utilgjengelig";

export type BilTilbakeMelding = {
  type: "bil-tilbake";
  bilId: string;
  kjennemerke: string;
  tilDato: string;
  /** ISO-tidspunkt for når hendelsen skjedde */
  tidspunkt: string;
};

export function sendBilTilbakeMelding(melding: BilTilbakeMelding): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel(BIL_UTILGJENGELIG_CHANNEL);
  ch.postMessage(melding);
  ch.close();
}

export function abonnerBilUtilgjengelig(
  handler: (data: unknown) => void,
): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return () => {};
  }
  const ch = new BroadcastChannel(BIL_UTILGJENGELIG_CHANNEL);
  ch.onmessage = (ev) => handler(ev.data);
  return () => ch.close();
}
