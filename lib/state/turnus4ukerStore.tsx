"use client";

import { createContext, useContext, useMemo } from "react";
import { useAppData } from "@/lib/hooks/useAppData";

export type TurnusSkiftType = "Ingen" | "Dag" | "Kveld" | "Begge";

export type Turnus4Uker = {
  ansattId: string;
  /** 4 uker × 7 dager (Man–Søn). */
  plan: TurnusSkiftType[][];
};

type Turnus4UkerStoreValue = {
  turnuser: Turnus4Uker[];
  hentTurnus: (ansattId: string) => Turnus4Uker;
  setDag: (args: { ansattId: string; ukeIndex: number; dagIndex: number; skift: TurnusSkiftType }) => void;
};

const STORAGE_KEY = "bemanning.turnus4uker.v1";
const Ctx = createContext<Turnus4UkerStoreValue | null>(null);

function defaultTurnus(ansattId: string): Turnus4Uker {
  return {
    ansattId,
    plan: Array.from({ length: 4 }, () => Array.from({ length: 7 }, () => "Ingen" as const)),
  };
}

function normalizeLoaded(data: unknown): Turnus4Uker[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => x)
    .map((x) => {
      const t = x as any;
      const ansattId = String(t.ansattId ?? "");
      const plan = Array.isArray(t.plan) ? t.plan : [];
      const normalized: TurnusSkiftType[][] = Array.from({ length: 4 }, (_, w) => {
        const row = Array.isArray(plan[w]) ? plan[w] : [];
        return Array.from({ length: 7 }, (_, d) => {
          const v = String(row[d] ?? "Ingen");
          if (v === "Dag" || v === "Kveld" || v === "Begge" || v === "Ingen") return v;
          return "Ingen";
        });
      });
      return { ansattId, plan: normalized } satisfies Turnus4Uker;
    })
    .filter((t) => t.ansattId);
}

export function Turnus4UkerStoreProvider({ children }: { children: React.ReactNode }) {
  const { data: turnuser, setData: setTurnuser } = useAppData<Turnus4Uker[]>(STORAGE_KEY, {
    getDefault: () => [],
    parse: normalizeLoaded,
  });

  const hentTurnus = (ansattId: string): Turnus4Uker => {
    const existing = turnuser.find((t) => t.ansattId === ansattId);
    return existing ?? defaultTurnus(ansattId);
  };

  const setDag = ({
    ansattId,
    ukeIndex,
    dagIndex,
    skift,
  }: {
    ansattId: string;
    ukeIndex: number;
    dagIndex: number;
    skift: TurnusSkiftType;
  }) => {
    setTurnuser((prev) => {
      const found = prev.find((t) => t.ansattId === ansattId);
      const base = found ?? defaultTurnus(ansattId);
      const plan = base.plan.map((row) => [...row]);
      plan[ukeIndex] = [...plan[ukeIndex]];
      plan[ukeIndex][dagIndex] = skift;
      const next = { ...base, plan };
      const without = prev.filter((t) => t.ansattId !== ansattId);
      return [next, ...without];
    });
  };

  const value = useMemo(() => ({ turnuser, hentTurnus, setDag }), [turnuser]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTurnus4UkerStore(): Turnus4UkerStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTurnus4UkerStore må brukes innenfor Turnus4UkerStoreProvider");
  return ctx;
}

