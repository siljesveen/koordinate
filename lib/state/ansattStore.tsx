"use client";

import { createContext, useContext, useMemo } from "react";
import type { Ansatt } from "@/lib/domain";
import { useAppData } from "@/lib/hooks/useAppData";
import { mergeTilleggAnsatte } from "@/lib/maintenance/plannerRessurslisteEnrich";
import { sorterAnsatte } from "@/lib/utils/sort";
import { IMPORTERTE_ANSATTE_BEMANNING_2026 } from "@/lib/imported/ansatte-bemanning-2026";
import { IMPORTERTE_RUTER } from "@/lib/imported/ruter-from-ringnes";

type LagretAnsatt = Ansatt & { fastRute?: string };

const GYLDIG_RUTE_ID = new Set(IMPORTERTE_RUTER.map((r) => r.id));

function migrateAnsatt(a: LagretAnsatt): Ansatt {
  const copy = { ...a } as Record<string, unknown>;
  delete copy.fastRute;
  const base = copy as Ansatt;
  let ids = Array.isArray(a.ruteIds) ? a.ruteIds.filter((x) => typeof x === "string" && x) : [];
  if (ids.length === 0 && typeof a.fastRute === "string" && a.fastRute) {
    ids = [a.fastRute];
  }
  ids = [...new Set(ids)].filter((id) => GYLDIG_RUTE_ID.has(id));
  return { ...base, ruteIds: ids.length ? ids : undefined };
}

type AnsattStoreValue = {
  ansatte: Ansatt[];
  setAnsatte: React.Dispatch<React.SetStateAction<Ansatt[]>>;
};

const AnsattStoreContext = createContext<AnsattStoreValue | null>(null);
const STORAGE_KEY = "bemanning.ansatte.v2";

function standardAnsatte(): Ansatt[] {
  return sorterAnsatte(IMPORTERTE_ANSATTE_BEMANNING_2026.map(migrateAnsatt));
}

function mergeImportertTelefon(ansatte: Ansatt[]): Ansatt[] {
  const importertTelefon = new Map(
    IMPORTERTE_ANSATTE_BEMANNING_2026.map((a) => [a.id, a.telefon] as const),
  );
  return ansatte.map((a) => {
    const telefon = importertTelefon.get(a.id);
    if (!telefon || a.telefon) return a;
    return { ...a, telefon };
  });
}

function parseAnsatte(raw: unknown): Ansatt[] {
  if (!Array.isArray(raw)) return standardAnsatte();
  const parsed = raw
    .filter((x) => x && typeof x === "object")
    .map((x) => migrateAnsatt(x as LagretAnsatt));
  if (parsed.length === 0) return standardAnsatte();
  return sorterAnsatte(mergeTilleggAnsatte(mergeImportertTelefon(parsed)));
}

export function AnsattStoreProvider({ children }: { children: React.ReactNode }) {
  const { data: ansatte, setData: setAnsatte } = useAppData<Ansatt[]>(STORAGE_KEY, {
    getDefault: standardAnsatte,
    parse: parseAnsatte,
  });

  const value = useMemo(
    () => ({ ansatte: sorterAnsatte(ansatte), setAnsatte }),
    [ansatte, setAnsatte],
  );

  return <AnsattStoreContext.Provider value={value}>{children}</AnsattStoreContext.Provider>;
}

export function useAnsattStore(): AnsattStoreValue {
  const ctx = useContext(AnsattStoreContext);
  if (!ctx) {
    throw new Error("useAnsattStore må brukes innenfor AnsattStoreProvider");
  }
  return ctx;
}
