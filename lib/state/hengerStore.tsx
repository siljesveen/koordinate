"use client";

import { createContext, useContext, useMemo } from "react";
import type { Henger } from "@/lib/domain";
import { useAppData } from "@/lib/hooks/useAppData";
import { IMPORTERTE_HENGERE_REFERANSE_2026 } from "@/lib/imported/kjoretoy-referanse-2026";

type HengerStoreValue = {
  hengere: Henger[];
  lagre: (item: Henger) => void;
  slett: (id: string) => void;
};

const STORAGE_KEY = "bemanning.henger.v1";
const Ctx = createContext<HengerStoreValue | null>(null);

function standardHengere(): Henger[] {
  return IMPORTERTE_HENGERE_REFERANSE_2026;
}

function normalizeLoaded(data: unknown): Henger[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => x as Record<string, unknown>)
    .map((x) => {
      const id = String(x.id ?? "");
      const kjennemerke = String(x.kjennemerke ?? "").trim();
      const type = typeof x.type === "string" ? x.type.trim() : undefined;
      const aktiv = x.aktiv === false || x.aktiv === "nei" ? false : true;
      const kommentar = typeof x.kommentar === "string" ? x.kommentar : undefined;
      if (!id || !kjennemerke) return null;
      return { id, kjennemerke, type, aktiv, kommentar } as Henger;
    })
    .filter(Boolean) as Henger[];
}

function nyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `henger-${Date.now()}`;
}

export function HengerStoreProvider({ children }: { children: React.ReactNode }) {
  const { data: hengere, setData: setHengere } = useAppData<Henger[]>(STORAGE_KEY, {
    getDefault: standardHengere,
    parse: (raw) => {
      const normalized = normalizeLoaded(raw);
      return normalized.length > 0 ? normalized : standardHengere();
    },
  });

  const lagre = (item: Henger) => {
    setHengere((prev) => {
      const i = prev.findIndex((h) => h.id === item.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = item;
        return copy;
      }
      return [{ ...item, id: item.id || nyId() }, ...prev];
    });
  };

  const slett = (id: string) => setHengere((prev) => prev.filter((h) => h.id !== id));

  const value = useMemo(() => ({ hengere, lagre, slett }), [hengere]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHengerStore(): HengerStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHengerStore må brukes innenfor HengerStoreProvider");
  return ctx;
}
