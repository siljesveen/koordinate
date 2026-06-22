"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReserveTilgjengelighet, Skift } from "@/lib/domain";
import { useAppData } from "@/lib/hooks/useAppData";

const STORAGE_KEY = "bemanning.reserveTilgjengelighet.v1";

/** Deterministisk id per sjåfør + startdato + skift. */
export function reserveTilgjengelighetId(
  ansattId: string,
  fraDato: string,
  skift: Skift,
): string {
  return `rt-${ansattId}-${fraDato}-${skift}`;
}

function erGyldigKl(kl: string): boolean {
  return /^\d{2}:\d{2}$/.test(kl);
}

function normalizeLoaded(data: unknown): ReserveTilgjengelighet[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const r = x as Record<string, unknown>;
      const id = String(r.id ?? "");
      const ansattId = String(r.ansattId ?? "");
      const fraDato = String(r.fraDato ?? "");
      const tilRaw = r.tilDato;
      const tilDato =
        tilRaw === null || tilRaw === undefined || String(tilRaw).trim() === ""
          ? undefined
          : String(tilRaw);
      const skift: Skift | null =
        r.skift === "Dag" || r.skift === "Kveld" ? r.skift : null;
      const fraKl = String(r.fraKl ?? "").trim();
      const kommentar =
        typeof r.kommentar === "string" && r.kommentar.trim() ? r.kommentar : undefined;
      if (!id || !ansattId || !fraDato || !skift || !erGyldigKl(fraKl)) return null;
      if (tilDato && fraDato > tilDato) return null;
      return { id, ansattId, fraDato, tilDato, skift, fraKl, kommentar } as ReserveTilgjengelighet;
    })
    .filter(Boolean) as ReserveTilgjengelighet[];
}

type ReserveTilgjengelighetStoreValue = {
  poster: ReserveTilgjengelighet[];
  lagre: (post: ReserveTilgjengelighet) => void;
  fjern: (id: string) => void;
};

const Ctx = createContext<ReserveTilgjengelighetStoreValue | null>(null);

export function ReserveTilgjengelighetStoreProvider({ children }: { children: React.ReactNode }) {
  const { data: poster, setData: setPoster } = useAppData<ReserveTilgjengelighet[]>(STORAGE_KEY, {
    getDefault: () => [],
    parse: normalizeLoaded,
  });

  const lagre = (post: ReserveTilgjengelighet) => {
    setPoster((prev) => {
      const idx = prev.findIndex((x) => x.id === post.id);
      if (idx >= 0) {
        const kopi = [...prev];
        kopi[idx] = post;
        return kopi;
      }
      return [...prev, post];
    });
  };

  const fjern = (id: string) => setPoster((prev) => prev.filter((x) => x.id !== id));

  const value = useMemo(() => ({ poster, lagre, fjern }), [poster]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReserveTilgjengelighetStore(): ReserveTilgjengelighetStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useReserveTilgjengelighetStore må brukes innenfor ReserveTilgjengelighetStoreProvider",
    );
  }
  return ctx;
}
