"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useAppData } from "@/lib/hooks/useAppData";
import type { MasterRuteSlot } from "@/lib/domain";
import {
  byggTurnusPlan,
  friDagerFraLegacyPlan,
  turnusCelleNøkkel,
} from "@/lib/turnusMasterplanSync";
import { useMasterplanStore } from "@/lib/state/masterplanStore";

export type TurnusSkiftType = "Ingen" | "Dag" | "Kveld" | "Begge";

/** Lagret per ansatt – kun manuelle fridager; resten avledes fra masterplan. */
export type TurnusLagret = {
  ansattId: string;
  friDager: string[];
  /** @deprecated – migreres til friDager ved innlasting */
  plan?: TurnusSkiftType[][];
};

/** Returneres til UI – full plan avledet live. */
export type Turnus4Uker = {
  ansattId: string;
  plan: TurnusSkiftType[][];
};

type Turnus4UkerStoreValue = {
  hentTurnus: (ansattId: string) => Turnus4Uker;
  setDag: (args: { ansattId: string; ukeIndex: number; dagIndex: number; skift: TurnusSkiftType }) => void;
};

const STORAGE_KEY = "bemanning.turnus4uker.v1";
const Ctx = createContext<Turnus4UkerStoreValue | null>(null);

function normalizeLoaded(data: unknown): TurnusLagret[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const t = x as TurnusLagret & { plan?: TurnusSkiftType[][] };
      const ansattId = String(t.ansattId ?? "");
      const legacyFri = friDagerFraLegacyPlan(t.plan);
      const eksisterendeFri = Array.isArray(t.friDager) ? t.friDager.map(String) : [];
      const friDager = [...new Set([...eksisterendeFri, ...legacyFri])];
      return { ansattId, friDager } satisfies TurnusLagret;
    })
    .filter((t) => t.ansattId);
}

export function Turnus4UkerStoreProvider({ children }: { children: React.ReactNode }) {
  const { masterplan } = useMasterplanStore();
  const { data: turnuser, setData: setTurnuser } = useAppData<TurnusLagret[]>(STORAGE_KEY, {
    getDefault: () => [],
    parse: normalizeLoaded,
  });

  const slots = masterplan.slots;

  const hentTurnus = useCallback(
    (ansattId: string): Turnus4Uker => {
      const lagret = turnuser.find((t) => t.ansattId === ansattId);
      const friDager = new Set(lagret?.friDager ?? []);
      return {
        ansattId,
        plan: byggTurnusPlan(slots, ansattId, friDager),
      };
    },
    [turnuser, slots],
  );

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
    const nøkkel = turnusCelleNøkkel(ukeIndex, dagIndex);
    setTurnuser((prev) => {
      const found = prev.find((t) => t.ansattId === ansattId);
      const friSet = new Set(found?.friDager ?? []);

      if (skift === "Ingen") {
        friSet.add(nøkkel);
      } else {
        friSet.delete(nøkkel);
      }

      const next: TurnusLagret = {
        ansattId,
        friDager: [...friSet],
      };
      return [next, ...prev.filter((t) => t.ansattId !== ansattId)];
    });
  };

  const value = useMemo(() => ({ hentTurnus, setDag }), [hentTurnus]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTurnus4UkerStore(): Turnus4UkerStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTurnus4UkerStore må brukes innenfor Turnus4UkerStoreProvider");
  return ctx;
}

/** Hjelpefunksjon for tester – unngår React-context. */
export function byggTurnusForAnsatt(
  slots: MasterRuteSlot[],
  ansattId: string,
  friDager: string[] = [],
): Turnus4Uker {
  return {
    ansattId,
    plan: byggTurnusPlan(slots, ansattId, new Set(friDager)),
  };
}
