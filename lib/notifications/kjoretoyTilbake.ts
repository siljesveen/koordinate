import type { BilTilbakeMelding } from "@/lib/sync/bilUtilgjengeligBroadcast";

const SW_PATH = "/sw-koordinate.js";
const DEDUP_MS = 5000;
const nyligVist = new Set<string>();
let underEgenTilbakeHandling = false;

let swRegistrering: Promise<ServiceWorkerRegistration | null> | null = null;

function registrerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (!swRegistrering) {
    swRegistrering = navigator.serviceWorker
      .register(SW_PATH, { scope: "/" })
      .catch(() => null);
  }
  return swRegistrering;
}

export function initKjoretoyVarsler(): void {
  if (typeof window === "undefined") return;
  void registrerServiceWorker();
}

export async function forberedVarslingVedTilbake(): Promise<NotificationPermission | "unsupported"> {
  return beOmVarslingstillatelse();
}

export async function beOmVarslingstillatelse(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  await registrerServiceWorker();
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

function notificationOptions(melding: BilTilbakeMelding): NotificationOptions {
  const reg = melding.kjennemerke;
  return {
    body: `${reg} er tilbake og kan brukes i planleggingen fra i dag.`,
    tag: `bil-tilbake-${melding.bilId}`,
    requireInteraction: false,
    silent: false,
  };
}

export function merkEgenTilbakeHandling(): void {
  underEgenTilbakeHandling = true;
  window.setTimeout(() => {
    underEgenTilbakeHandling = false;
  }, 500);
}

export function erEgenTilbakeHandling(): boolean {
  return underEgenTilbakeHandling;
}

function reserverVarsel(nøkkel: string): boolean {
  if (nyligVist.has(nøkkel)) return false;
  nyligVist.add(nøkkel);
  window.setTimeout(() => nyligVist.delete(nøkkel), DEDUP_MS);
  return true;
}

/** Kun systemvarsel via service worker (ett varsel, ikke dobbelt med Edge). */
async function visSystemvarsel(melding: BilTilbakeMelding): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const nøkkel = `push-${melding.bilId}-${melding.tidspunkt}`;
  if (!reserverVarsel(nøkkel)) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("Bil tilbake fra verksted", notificationOptions(melding));
    return true;
  } catch {
    return false;
  }
}

export function bilTilbakeToastTekst(melding: BilTilbakeMelding): string {
  return `${melding.kjennemerke} er tilbake og ledig i planleggingen.`;
}

/**
 * Én type varsel per hendelse:
 * - Egen fane: kun grønt varsel i appen
 * - Annen fane: kun systemvarsel (hvis tillatt)
 */
export async function varsleBilTilbake(
  melding: BilTilbakeMelding,
  opts: { egenFane: boolean; visToast: (tekst: string) => void },
): Promise<void> {
  const nøkkel = `hendelse-${melding.tidspunkt}`;

  if (opts.egenFane) {
    if (!reserverVarsel(nøkkel)) return;
    opts.visToast(bilTilbakeToastTekst(melding));
    return;
  }

  if (!reserverVarsel(nøkkel)) return;
  await visSystemvarsel(melding);
}
