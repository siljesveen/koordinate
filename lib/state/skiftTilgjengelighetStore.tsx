"use client";

import { createContext, useContext, useMemo } from "react";
import type { Skift, SkiftTilgjengelighet } from "@/lib/domain";
import { useAppData } from "@/lib/hooks/useAppData";

const STORAGE_KEY = "bemanning.skiftTilgjengelighet.v1";

/** Deterministisk id per sjåfør + startdato, slik at «sett skift» er idempotent. */
export function skiftTilgjengelighetId(ansattId: string, fraDato: string): string {
  return `st-${ansattId}-${fraDato}`;
}

function normalizeLoaded(data: unknown): SkiftTilgjengelighet[] {
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
      const kommentar =
        typeof r.kommentar === "string" && r.kommentar.trim() ? r.kommentar : undefined;
      if (!id || !ansattId || !fraDato || !skift) return null;
      if (tilDato && fraDato > tilDato) return null;
      return { id, ansattId, fraDato, tilDato, skift, kommentar } as SkiftTilgjengelighet;
    })
    .filter(Boolean) as SkiftTilgjengelighet[];
}

type SkiftTilgjengelighetStoreValue = {
  poster: SkiftTilgjengelighet[];
  lagre: (post: SkiftTilgjengelighet) => void;
  fjern: (id: string) => void;
};

const Ctx = createContext<SkiftTilgjengelighetStoreValue | null>(null);

export function SkiftTilgjengelighetStoreProvider({ children }: { children: React.ReactNode }) {
  const { data: poster, setData: setPoster } = useAppData<SkiftTilgjengelighet[]>(STORAGE_KEY, {
    getDefault: () => [],
    parse: normalizeLoaded,
  });

  const lagre = (post: SkiftTilgjengelighet) => {
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

export function useSkiftTilgjengelighetStore(): SkiftTilgjengelighetStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useSkiftTilgjengelighetStore må brukes innenfor SkiftTilgjengelighetStoreProvider",
    );
  }
  return ctx;
}
