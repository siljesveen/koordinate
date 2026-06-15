"use client";

import { createContext, useContext, useMemo } from "react";
import type { Fravær } from "@/lib/domain";
import { useAppData } from "@/lib/hooks/useAppData";
import { fraværPeriodeNøkkel } from "@/lib/utils/bemanningsplanKoder";
import { slåSammenFraværPerioder } from "@/lib/utils/fraværPeriodeGruppering";type FraværStoreValue = {
  fravær: Fravær[];
  lagre: (item: Fravær) => void;
  lagreMange: (items: Fravær[]) => void;
  synkFraPlan: (importerte: Fravær[], kobledeAnsattIds: string[]) => void;
  slett: (id: string) => void;
  slettForAnsatt: (ansattId: string) => void;
};

const STORAGE_KEY = "bemanning.fravaer.v1";
const Ctx = createContext<FraværStoreValue | null>(null);

/** Slått sammen duplikater i ansattlisten. */
const ANSATT_ID_MIGRERING: Record<string, string> = {
  "a-roger-skogheim": "a-roger-haug-skogheim",
};

function migrerAnsattId(ansattId: string): string {
  return ANSATT_ID_MIGRERING[ansattId] ?? ansattId;
}

function normalizeLoaded(data: unknown): Fravær[] {
  if (!Array.isArray(data)) return [];
  const parsed = data
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
      const excelKode = typeof x.excelKode === "string" ? x.excelKode : undefined;
      if (!id || !ansattId || !type || !fraDato || !tilDato) return null;
      return {
        id,
        ansattId: migrerAnsattId(ansattId),
        type,
        fraDato,
        tilDato,
        planlagt,
        kommentar,
        excelKode,
      } as Fravær;
    })
    .filter(Boolean) as Fravær[];
  return slåSammenFraværPerioder(parsed);
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

  const lagreMange = (items: Fravær[]) => {
    if (items.length === 0) return;
    setFravær((prev) => {
      const eksisterende = new Set(prev.map((f) => fraværPeriodeNøkkel(f)));
      const nye = items
        .filter((item) => {
          const nøkkel = fraværPeriodeNøkkel(item);
          if (eksisterende.has(nøkkel)) return false;
          eksisterende.add(nøkkel);
          return true;
        })
        .map((item) => ({ ...item, id: item.id || nyId() }));
      if (nye.length === 0) return prev;
      return [...nye, ...prev];
    });
  };

  /** Erstatt plan-fravær for alle koblede ansatte — behold fravær for ansatte uten plan-rad. */
  const synkFraPlan = (importerte: Fravær[], kobledeAnsattIds: string[]) => {
    setFravær((prev) => {
      const erstattIds = new Set(kobledeAnsattIds);
      const behold = prev.filter((f) => !erstattIds.has(f.ansattId));
      const kombinert = slåSammenFraværPerioder([
        ...importerte.map((item) => ({ ...item, id: item.id || nyId() })),
        ...behold,
      ]);
      return kombinert;
    });
  };

  const slett = (id: string) => setFravær((prev) => prev.filter((f) => f.id !== id));
  const slettForAnsatt = (ansattId: string) =>
    setFravær((prev) => prev.filter((f) => f.ansattId !== ansattId));

  const value = useMemo(
    () => ({ fravær, lagre, lagreMange, synkFraPlan, slett, slettForAnsatt }),
    [fravær],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFraværStore(): FraværStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFraværStore må brukes innenfor FraværStoreProvider");
  return ctx;
}
