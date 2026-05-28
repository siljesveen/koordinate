"use client";

import { useCallback, useState, type ReactNode } from "react";
import BekreftDialog from "./BekreftDialog";

type BekreftOptions = {
  bekreftTekst?: string;
  avbrytTekst?: string;
};

type Pending = BekreftOptions & {
  melding: string;
  resolve: (ok: boolean) => void;
};

export function useBekreftDialog() {
  const [pending, setPending] = useState<Pending | null>(null);

  const requestBekreft = useCallback(
    (melding: string, opts?: BekreftOptions): Promise<boolean> =>
      new Promise((resolve) => {
        setPending({ melding, ...opts, resolve });
      }),
    [],
  );

  const dialog: ReactNode = pending ? (
    <BekreftDialog
      melding={pending.melding}
      bekreftTekst={pending.bekreftTekst}
      avbrytTekst={pending.avbrytTekst}
      onBekreft={() => {
        pending.resolve(true);
        setPending(null);
      }}
      onAvbryt={() => {
        pending.resolve(false);
        setPending(null);
      }}
    />
  ) : null;

  return { requestBekreft, dialog };
}
