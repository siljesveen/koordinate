"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DagEndring, Skift } from "@/lib/domain";

const STORAGE_KEY = "bemanning.dagendring.v1";

export function dagEndringId(dato: string, skift: Skift, rutekode: string): string {
  return `de-${dato}-${skift}-${encodeURIComponent(rutekode)}`;
}

export function dagKoblingOpphevetId(dato: string, skift: Skift, gruppeKey: string): string {
  return `de-kobling-${dato}-${skift}-${encodeURIComponent(gruppeKey)}`;
}

function normalizeLoaded(data: unknown): DagEndring[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const r = x as Record<string, unknown>;
      const id = String(r.id ?? "");
      const dato = String(r.dato ?? "");
      const skift = r.skift === "Dag" || r.skift === "Kveld" ? r.skift : null;
      const type =
        r.type === "fjernet" || r.type === "lagt_til" || r.type === "kobling_opphevet"
          ? r.type
          : null;
      const rutekode = String(r.rutekode ?? "");
      const rutekoderRaw = r.rutekoder;
      const rutekoder = Array.isArray(rutekoderRaw)
        ? rutekoderRaw.filter((x) => typeof x === "string").map(String)
        : undefined;
      const koblingsgruppe =
        typeof r.koblingsgruppe === "string" && r.koblingsgruppe.trim()
          ? r.koblingsgruppe.trim()
          : undefined;
      if (!id || !dato || !skift || !type) return null;
      if (type !== "kobling_opphevet" && !rutekode) return null;
      if (type === "kobling_opphevet" && !rutekode && (!rutekoder || rutekoder.length < 2)) {
        return null;
      }
      return {
        id,
        dato,
        skift,
        type,
        rutekode: rutekode || rutekoder![0],
        rutenavn: typeof r.rutenavn === "string" ? r.rutenavn : undefined,
        koblingsgruppe,
        rutekoder,
      } as DagEndring;
    })
    .filter(Boolean) as DagEndring[];
}

type DagEndringStoreValue = {
  endringer: DagEndring[];
  lagre: (e: DagEndring) => void;
  fjern: (id: string) => void;
};

const Ctx = createContext<DagEndringStoreValue | null>(null);

export function DagEndringStoreProvider({ children }: { children: React.ReactNode }) {
  const [endringer, setEndringer] = useState<DagEndring[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setEndringer(normalizeLoaded(JSON.parse(raw)));
      }
    } catch {
      // ignorer
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(endringer));
    } catch {
      // ignorer
    }
  }, [endringer]);

  const lagre = (e: DagEndring) => {
    setEndringer((prev) => {
      const idx = prev.findIndex((x) => x.id === e.id);
      if (idx >= 0) {
        const kopi = [...prev];
        kopi[idx] = e;
        return kopi;
      }
      return [...prev, e];
    });
  };

  const fjern = (id: string) => {
    setEndringer((prev) => prev.filter((x) => x.id !== id));
  };

  const value = useMemo(() => ({ endringer, lagre, fjern }), [endringer]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDagEndringStore(): DagEndringStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDagEndringStore må brukes innenfor DagEndringStoreProvider");
  return ctx;
}
