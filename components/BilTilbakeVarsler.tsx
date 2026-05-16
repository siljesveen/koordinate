"use client";

import { useEffect } from "react";
import { erEgenTilbakeHandling, initKjoretoyVarsler, varsleBilTilbake } from "@/lib/notifications/kjoretoyTilbake";
import {
  abonnerBilUtilgjengelig,
  type BilTilbakeMelding,
} from "@/lib/sync/bilUtilgjengeligBroadcast";
import { useToastStore } from "@/lib/state/toastStore";

function erBilTilbakeMelding(data: unknown): data is BilTilbakeMelding {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return d.type === "bil-tilbake" && typeof d.bilId === "string" && typeof d.kjennemerke === "string";
}

export default function BilTilbakeVarsler() {
  const { vis } = useToastStore();

  useEffect(() => {
    initKjoretoyVarsler();
  }, []);

  useEffect(() => {
    return abonnerBilUtilgjengelig((data) => {
      if (!erBilTilbakeMelding(data)) return;
      if (erEgenTilbakeHandling()) return;

      const full: BilTilbakeMelding = {
        type: "bil-tilbake",
        bilId: data.bilId,
        kjennemerke: data.kjennemerke,
        tilDato: data.tilDato,
        tidspunkt: data.tidspunkt ?? new Date().toISOString(),
      };

      void varsleBilTilbake(full, {
        egenFane: false,
        visToast: (tekst) => vis(tekst, "success"),
      });
    });
  }, [vis]);

  return null;
}
