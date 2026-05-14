"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Bil } from "@/lib/domain";

type BilStoreValue = {
  biler: Bil[];
  lagre: (item: Bil) => void;
  slett: (id: string) => void;
};

const STORAGE_KEY = "bemanning.biler.v1";
const Ctx = createContext<BilStoreValue | null>(null);

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
      const aktiv = Boolean(x.aktiv);
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
  const [biler, setBiler] = useState<Bil[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setBiler(normalizeLoaded(JSON.parse(raw)));
    } catch {
      // ignorer
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(biler));
    } catch {
      // ignorer
    }
  }, [biler]);

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
