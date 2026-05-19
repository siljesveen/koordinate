"use client";

import { createContext, useContext, useMemo } from "react";
import type { Fravær } from "@/lib/domain";
import { useAppData } from "@/lib/hooks/useAppData";

type FraværStoreValue = {
  fravær: Fravær[];
  lagre: (item: Fravær) => void;
  slett: (id: string) => void;
  slettForAnsatt: (ansattId: string) => void;
};

const STORAGE_KEY = "bemanning.fravaer.v1";
const Ctx = createContext<FraværStoreValue | null>(null);

function normalizeLoaded(data: unknown): Fravær[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => x as Record<string, unknown>)
    .map((x) => {
      const id = String(x.id ?? "");
      const ansattId = String(x.ansattId ?? "");
      const type = String(x.type ?? "");
      const fraDato = String(x.fraDato ?? "");
      const tilDato = String(x.tilDato ?? "");
      const planlagt = typeof x.planlagt === "boolean" ? x.planlagt : undefined;
      const kommentar = typeof x.kommentar === "string" ? x.kommentar : undefined;
      if (!id || !ansattId || !type || !fraDato || !tilDato) return null;
      return { id, ansattId, type, fraDato, tilDato, planlagt, kommentar } as Fravær;
    })
    .filter(Boolean) as Fravær[];
}

function nyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `f-${Date.now()}`;
}

export function FraværStoreProvider({ children }: { children: React.ReactNode }) {
  const { data: fravær, setData: setFravær } = useAppData<Fravær[]>(STORAGE_KEY, {
    getDefault: () => [],
    parse: normalizeLoaded,
  });

  const lagre = (item: Fravær) => {
    setFravær((prev) => {
      const i = prev.findIndex((f) => f.id === item.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = item;
        return copy;
      }
      return [{ ...item, id: item.id || nyId() }, ...prev];
    });
  };

  const slett = (id: string) => setFravær((prev) => prev.filter((f) => f.id !== id));
  const slettForAnsatt = (ansattId: string) =>
    setFravær((prev) => prev.filter((f) => f.ansattId !== ansattId));

  const value = useMemo(() => ({ fravær, lagre, slett, slettForAnsatt }), [fravær]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFraværStore(): FraværStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFraværStore må brukes innenfor FraværStoreProvider");
  return ctx;
}
