"use client";

import { createContext, useContext, useMemo } from "react";
import type { Bil } from "@/lib/domain";
import { useAppData } from "@/lib/hooks/useAppData";
import { IMPORTERTE_BILER_REFERANSE_2026 } from "@/lib/imported/kjoretoy-referanse-2026";

type BilStoreValue = {
  biler: Bil[];
  lagre: (item: Bil) => void;
  slett: (id: string) => void;
};

const STORAGE_KEY = "bemanning.biler.v1";
const Ctx = createContext<BilStoreValue | null>(null);

function standardBiler(): Bil[] {
  return IMPORTERTE_BILER_REFERANSE_2026;
}

function normalizeLoaded(data: unknown): Bil[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => x as Record<string, unknown>)
    .map((x) => {
      const id = String(x.id ?? "");
      const kjennemerke = String(x.kjennemerke ?? "").trim();
      const merke = typeof x.merke === "string" ? x.merke.trim() : undefined;
      const modell = typeof x.modell === "string" ? x.modell.trim() : undefined;
      const aktiv = x.aktiv === false || x.aktiv === "nei" ? false : true;
      const kommentar = typeof x.kommentar === "string" ? x.kommentar : undefined;
      if (!id || !kjennemerke) return null;
      return { id, kjennemerke, merke, modell, aktiv, kommentar } as Bil;
    })
    .filter(Boolean) as Bil[];
}

function nyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `bil-${Date.now()}`;
}

export function BilStoreProvider({ children }: { children: React.ReactNode }) {
  const { data: biler, setData: setBiler } = useAppData<Bil[]>(STORAGE_KEY, {
    getDefault: standardBiler,
    parse: (raw) => {
      const normalized = normalizeLoaded(raw);
      return normalized.length > 0 ? normalized : standardBiler();
    },
  });

  const lagre = (item: Bil) => {
    setBiler((prev) => {
      const i = prev.findIndex((b) => b.id === item.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = item;
        return copy;
      }
      return [{ ...item, id: item.id || nyId() }, ...prev];
    });
  };

  const slett = (id: string) => setBiler((prev) => prev.filter((b) => b.id !== id));

  const value = useMemo(() => ({ biler, lagre, slett }), [biler]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBilStore(): BilStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBilStore må brukes innenfor BilStoreProvider");
  return ctx;
}
