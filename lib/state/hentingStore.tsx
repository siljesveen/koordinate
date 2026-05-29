"use client";

import { createContext, useContext, useMemo } from "react";
import type { Henting, HentingDagValg } from "@/lib/domain";
import { useAppData } from "@/lib/hooks/useAppData";

const KATALOG_KEY = "bemanning.henting.v1";
const DAG_KEY = "bemanning.hentingDag.v1";

/** Deterministisk id for en avhuket henting på en dato (idempotent toggle). */
export function hentingDagValgId(dato: string, hentingId: string): string {
  return `hd-${dato}-${hentingId}`;
}

function nyId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rensRuteListe(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const sett = new Set<string>();
  for (const x of v) {
    const k = String(x ?? "").trim();
    if (k) sett.add(k);
  }
  return Array.from(sett);
}

function normalizeUkeRuter(raw: unknown, fallbackRute?: string): Record<number, string[]> {
  const ut: Record<number, string[]> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      const dag = Number(key);
      if (!Number.isInteger(dag) || dag < 1 || dag > 7) continue;
      const ruter = rensRuteListe(val);
      if (ruter.length) ut[dag] = ruter;
    }
    return ut;
  }
  // Bakoverkompat: gammel standardRutekode → alle ukedager.
  if (fallbackRute && fallbackRute.trim()) {
    for (let d = 1; d <= 7; d++) ut[d] = [fallbackRute.trim()];
  }
  return ut;
}

function normalizeKatalog(data: unknown): Henting[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const r = x as Record<string, unknown>;
      const id = String(r.id ?? "");
      const kunde = String(r.kunde ?? "").trim();
      const ukeRuter = normalizeUkeRuter(
        r.ukeRuter,
        typeof r.standardRutekode === "string" ? r.standardRutekode : undefined,
      );
      const antall =
        typeof r.antall === "string" && r.antall.trim() ? r.antall.trim() : undefined;
      const kommentar =
        typeof r.kommentar === "string" && r.kommentar.trim() ? r.kommentar.trim() : undefined;
      const aktiv = r.aktiv === undefined ? true : Boolean(r.aktiv);
      if (!id || !kunde) return null;
      return { id, kunde, ukeRuter, antall, kommentar, aktiv } as Henting;
    })
    .filter(Boolean) as Henting[];
}

function normalizeDagValg(data: unknown): HentingDagValg[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const r = x as Record<string, unknown>;
      const id = String(r.id ?? "");
      const dato = String(r.dato ?? "");
      const hentingId = String(r.hentingId ?? "");
      let ruter: string[] | undefined;
      if (Array.isArray(r.ruter)) {
        ruter = rensRuteListe(r.ruter);
      } else if (typeof r.rutekode === "string" && r.rutekode.trim()) {
        // Bakoverkompat: gammelt enkelt rutekode-felt.
        ruter = [r.rutekode.trim()];
      }
      const antall =
        typeof r.antall === "string" && r.antall.trim() ? r.antall.trim() : undefined;
      if (!id || !dato || !hentingId) return null;
      return { id, dato, hentingId, ruter, antall } as HentingDagValg;
    })
    .filter(Boolean) as HentingDagValg[];
}

type HentingStoreValue = {
  hentinger: Henting[];
  dagValg: HentingDagValg[];
  lagreHenting: (h: Omit<Henting, "id"> & { id?: string }) => void;
  slettHenting: (id: string) => void;
  /** Hak av / fjern en henting for en dato. */
  vekselDagValg: (dato: string, hentingId: string) => void;
  /** Sett (eller fjern) overstyrte ruter for en avhuket henting. undefined = bruk ukeoppsett. */
  settDagRuter: (dato: string, hentingId: string, ruter: string[] | undefined) => void;
  /** Sett mengde for en avhuket henting på en dato. */
  settDagAntall: (dato: string, hentingId: string, antall: string | undefined) => void;
};

const Ctx = createContext<HentingStoreValue | null>(null);

export function HentingStoreProvider({ children }: { children: React.ReactNode }) {
  const { data: hentinger, setData: setHentinger } = useAppData<Henting[]>(KATALOG_KEY, {
    getDefault: () => [],
    parse: normalizeKatalog,
  });
  const { data: dagValg, setData: setDagValg } = useAppData<HentingDagValg[]>(DAG_KEY, {
    getDefault: () => [],
    parse: normalizeDagValg,
  });

  const lagreHenting: HentingStoreValue["lagreHenting"] = (h) => {
    const id = h.id || nyId("h");
    setHentinger((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      const neste: Henting = {
        id,
        kunde: h.kunde,
        ukeRuter: h.ukeRuter,
        antall: h.antall,
        kommentar: h.kommentar,
        aktiv: h.aktiv,
      };
      if (idx >= 0) {
        const kopi = [...prev];
        kopi[idx] = neste;
        return kopi;
      }
      return [...prev, neste];
    });
  };

  const slettHenting = (id: string) =>
    setHentinger((prev) => prev.filter((x) => x.id !== id));

  const vekselDagValg = (dato: string, hentingId: string) => {
    const id = hentingDagValgId(dato, hentingId);
    setDagValg((prev) => {
      if (prev.some((x) => x.id === id)) return prev.filter((x) => x.id !== id);
      return [...prev, { id, dato, hentingId }];
    });
  };

  const settDagRuter = (dato: string, hentingId: string, ruter: string[] | undefined) => {
    const id = hentingDagValgId(dato, hentingId);
    setDagValg((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx < 0) {
        return [...prev, { id, dato, hentingId, ruter }];
      }
      const kopi = [...prev];
      kopi[idx] = { ...kopi[idx], ruter };
      return kopi;
    });
  };

  const settDagAntall = (dato: string, hentingId: string, antall: string | undefined) => {
    const id = hentingDagValgId(dato, hentingId);
    const rens = antall && antall.trim() ? antall.trim() : undefined;
    setDagValg((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx < 0) {
        return [...prev, { id, dato, hentingId, antall: rens }];
      }
      const kopi = [...prev];
      kopi[idx] = { ...kopi[idx], antall: rens };
      return kopi;
    });
  };

  const value = useMemo(
    () => ({
      hentinger,
      dagValg,
      lagreHenting,
      slettHenting,
      vekselDagValg,
      settDagRuter,
      settDagAntall,
    }),
    [hentinger, dagValg],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHentingStore(): HentingStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHentingStore må brukes innenfor HentingStoreProvider");
  return ctx;
}
