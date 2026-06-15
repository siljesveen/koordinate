"use client";

import { createContext, useContext, useMemo } from "react";
import { useAppData } from "@/lib/hooks/useAppData";
import { erGyldigPlan } from "@/lib/utils/bemanningsplanKoder";
import type { BemanningPlanData } from "@/lib/utils/parseBemanningsplanExcel";

type BemanningsplanStoreValue = {
  plan: BemanningPlanData | null;
  settPlan: (plan: BemanningPlanData | null) => void;
  harOpplastetPlan: boolean;
};

const STORAGE_KEY = "bemanning.plan.v1";
const Ctx = createContext<BemanningsplanStoreValue | null>(null);

function parsePlan(raw: unknown): BemanningPlanData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const drivers = o.drivers;
  if (!drivers || typeof drivers !== "object") return null;
  return {
    generated: String(o.generated ?? ""),
    year: Number(o.year) || new Date().getFullYear(),
    fileName: String(o.fileName ?? ""),
    sheetName: String(o.sheetName ?? ""),
    parserVersion: Number(o.parserVersion) || 0,
    drivers: drivers as BemanningPlanData["drivers"],
  };
}

export function BemanningsplanStoreProvider({ children }: { children: React.ReactNode }) {
  const { data: plan, setData: settPlan } = useAppData<BemanningPlanData | null>(STORAGE_KEY, {
    getDefault: () => null,
    parse: parsePlan,
  });

  const value = useMemo(
    () => ({
      plan,
      settPlan,
      harOpplastetPlan: erGyldigPlan(plan),
    }),
    [plan, settPlan],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBemanningsplanStore(): BemanningsplanStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useBemanningsplanStore må brukes innenfor BemanningsplanStoreProvider");
  }
  return ctx;
}
