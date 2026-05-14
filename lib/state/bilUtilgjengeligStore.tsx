"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { BilUtilgjengelig, KjøretøyUtilgjengeligType } from "@/lib/domain";

type BilUtilgjengeligStoreValue = {
  poster: BilUtilgjengelig[];
  lagre: (item: BilUtilgjengelig) => void;
  slett: (id: string) => void;
};

const STORAGE_KEY = "bemanning.bilUtilgjengelig.v1";
const Ctx = createContext<BilUtilgjengeligStoreValue | null>(null);

const TYPER: KjøretøyUtilgjengeligType[] = [
  "Vedlikehold",
  "Havari",
  "Service",
  "Inspeksjon",
  "Annet",
];

function erGyldigType(t: string): t is KjøretøyUtilgjengeligType {
  return TYPER.includes(t as KjøretøyUtilgjengeligType);
}

function normalizeLoaded(data: unknown): BilUtilgjengelig[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => x as Record<string, unknown>)
    .map((x) => {
      const id = String(x.id ?? "");
      const bilId = String(x.bilId ?? "");
      const typeRaw = String(x.type ?? "");
      const fraDato = String(x.fraDato ?? "");
      const tilDato = String(x.tilDato ?? "");
      const planlagt = typeof x.planlagt === "boolean" ? x.planlagt : undefined;
      const kommentar = typeof x.kommentar === "string" ? x.kommentar : undefined;
      const type = erGyldigType(typeRaw) ? typeRaw : "Annet";
      if (!id || !bilId || !fraDato || !tilDato) return null;
      return { id, bilId, type, fraDato, tilDato, planlagt, kommentar } as BilUtilgjengelig;
    })
    .filter(Boolean) as BilUtilgjengelig[];
}

function nyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `bu-${Date.now()}`;
}

export function BilUtilgjengeligStoreProvider({ children }: { children: React.ReactNode }) {
  const [poster, setPoster] = useState<BilUtilgjengelig[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      setPoster(normalizeLoaded(JSON.parse(raw)));
    } catch {
      // ignorer
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(poster));
    } catch {
      // ignorer
    }
  }, [poster]);

  const lagre = (item: BilUtilgjengelig) => {
    setPoster((prev) => {
      const i = prev.findIndex((p) => p.id === item.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = item;
        return copy;
      }
      return [{ ...item, id: item.id || nyId() }, ...prev];
    });
  };

  const slett = (id: string) => setPoster((prev) => prev.filter((p) => p.id !== id));

  const value = useMemo(() => ({ poster, lagre, slett }), [poster]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBilUtilgjengeligStore(): BilUtilgjengeligStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBilUtilgjengeligStore må brukes innenfor BilUtilgjengeligStoreProvider");
  return ctx;
}
