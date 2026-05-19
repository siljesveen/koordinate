"use client";

import { createContext, useContext, useMemo } from "react";
import type { PlanRuteTildeling, Skift } from "@/lib/domain";
import { useAppData } from "@/lib/hooks/useAppData";

type PlanRuteTildelingStoreValue = {
  tildelinger: PlanRuteTildeling[];
  lagre: (item: PlanRuteTildeling) => void;
  lagreFlere: (items: PlanRuteTildeling[]) => void;
  fjernReferanser: (felt: "ansattId" | "bilId" | "hengerId", verdi: string) => void;
};

const STORAGE_KEY = "bemanning.planRuteTildeling.v2";
const Ctx = createContext<PlanRuteTildelingStoreValue | null>(null);

export function planRuteSlotId(
  uke: 1 | 2 | 3 | 4,
  dag: number,
  skift: Skift,
  rute: string,
): string {
  return `prt-${uke}-${dag}-${skift}-${encodeURIComponent(rute)}`;
}

function normalizeLoaded(data: unknown): PlanRuteTildeling[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => x as Record<string, unknown>)
    .map((x) => {
      const id = String(x.id ?? "");
      const uke = Number(x.uke);
      const dag = Number(x.dag);
      const skift = x.skift === "Dag" || x.skift === "Kveld" ? x.skift : null;
      const rute = String(x.rute ?? "");
      const ansattId = typeof x.ansattId === "string" && x.ansattId ? x.ansattId : undefined;
      const bilId = typeof x.bilId === "string" && x.bilId ? x.bilId : undefined;
      const hengerId = typeof x.hengerId === "string" && x.hengerId ? x.hengerId : undefined;
      const skjulBaselineSjåfør =
        typeof x.skjulBaselineSjåfør === "boolean" ? x.skjulBaselineSjåfør : undefined;
      const skjulBaselineBil =
        typeof x.skjulBaselineBil === "boolean" ? x.skjulBaselineBil : undefined;
      const skjulBaselineHenger =
        typeof x.skjulBaselineHenger === "boolean" ? x.skjulBaselineHenger : undefined;
      if (!id || uke < 1 || uke > 4 || dag < 1 || dag > 7 || !skift || !rute) return null;
      return {
        id,
        uke: uke as 1 | 2 | 3 | 4,
        dag: dag as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        skift,
        rute,
        ansattId,
        bilId,
        hengerId,
        skjulBaselineSjåfør,
        skjulBaselineBil,
        skjulBaselineHenger,
      } as PlanRuteTildeling;
    })
    .filter(Boolean) as PlanRuteTildeling[];
}

function parsePlanRuteTildeling(raw: unknown): PlanRuteTildeling[] {
  if (raw !== null && raw !== undefined) {
    return normalizeLoaded(raw);
  }
  try {
    const rawV1 = window.localStorage.getItem("bemanning.planRuteTildeling.v1");
    if (rawV1) return normalizeLoaded(JSON.parse(rawV1));
  } catch {
    // ignorer
  }
  return [];
}

export function PlanRuteTildelingStoreProvider({ children }: { children: React.ReactNode }) {
  const { data: tildelinger, setData: setTildelinger } = useAppData<PlanRuteTildeling[]>(STORAGE_KEY, {
    getDefault: () => [],
    parse: parsePlanRuteTildeling,
  });

  function applyEnLagre(prev: PlanRuteTildeling[], item: PlanRuteTildeling): PlanRuteTildeling[] {
    const tom =
      !item.ansattId &&
      !item.bilId &&
      !item.hengerId &&
      !item.skjulBaselineSjåfør &&
      !item.skjulBaselineBil &&
      !item.skjulBaselineHenger;
    const idx = prev.findIndex((t) => t.id === item.id);
    if (tom) {
      if (idx < 0) return prev;
      const kopi = [...prev];
      kopi.splice(idx, 1);
      return kopi;
    }
    if (idx >= 0) {
      const kopi = [...prev];
      kopi[idx] = item;
      return kopi;
    }
    return [item, ...prev];
  }

  const lagre = (item: PlanRuteTildeling) => {
    setTildelinger((prev) => applyEnLagre(prev, item));
  };

  const lagreFlere = (items: PlanRuteTildeling[]) => {
    if (items.length === 0) return;
    setTildelinger((prev) => items.reduce((acc, item) => applyEnLagre(acc, item), prev));
  };

  const fjernReferanser = (felt: "ansattId" | "bilId" | "hengerId", verdi: string) => {
    setTildelinger((prev) =>
      prev.map((t) => (t[felt] === verdi ? { ...t, [felt]: undefined } : t)),
    );
  };

  const value = useMemo(() => ({ tildelinger, lagre, lagreFlere, fjernReferanser }), [tildelinger]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlanRuteTildelingStore(): PlanRuteTildelingStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlanRuteTildelingStore må brukes innenfor PlanRuteTildelingStoreProvider");
  return ctx;
}
