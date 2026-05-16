"use client";

import { useCallback } from "react";
import { forberedVarslingVedTilbake, merkEgenTilbakeHandling, varsleBilTilbake } from "@/lib/notifications/kjoretoyTilbake";
import {
  useBilUtilgjengeligStore,
  type MerkBilTilbakeMeta,
} from "@/lib/state/bilUtilgjengeligStore";
import { useToastStore } from "@/lib/state/toastStore";

export function useMerkBilTilbake() {
  const { merkTilbake } = useBilUtilgjengeligStore();
  const { vis } = useToastStore();

  return useCallback(
    async (id: string, meta?: MerkBilTilbakeMeta) => {
      await forberedVarslingVedTilbake();
      merkEgenTilbakeHandling();
      const melding = merkTilbake(id, meta);
      if (!melding) return;

      await varsleBilTilbake(melding, {
        egenFane: true,
        visToast: (tekst) => vis(tekst, "success"),
      });
    },
    [merkTilbake, vis],
  );
}
