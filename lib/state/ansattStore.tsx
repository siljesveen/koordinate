"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MOCK_ANSATTE, type Ansatt } from "@/lib/domain";
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

export function AnsattStoreProvider({ children }: { children: React.ReactNode }) {
  const [ansatte, setAnsatte] = useState<Ansatt[]>(() => MOCK_ANSATTE.map(migrateAnsatt));
  const loaded = useRef(false);

  // Last fra nettleser-lagring ved oppstart (hvis finnes).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      setAnsatte(
        parsed
          .filter((x) => x && typeof x === "object")
          .map((x) => migrateAnsatt(x as LagretAnsatt)),
      );
    } catch {
      // Ignorer hvis lagring er korrupt/ikke tilgjengelig.
    }
    loaded.current = true;
  }, []);

  // Lagre ved endringer.
  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ansatte));
    } catch {
      // Ignorer hvis lagring feiler (f.eks. privat modus / quota).
    }
  }, [ansatte]);

  const value = useMemo(() => ({ ansatte, setAnsatte }), [ansatte]);

  return <AnsattStoreContext.Provider value={value}>{children}</AnsattStoreContext.Provider>;
}

export function useAnsattStore(): AnsattStoreValue {
  const ctx = useContext(AnsattStoreContext);
  if (!ctx) {
    throw new Error("useAnsattStore må brukes innenfor AnsattStoreProvider");
  }
  return ctx;
}

