"use client";

import { createContext, useContext, useMemo } from "react";
import type { Bil, BilTilhørighet } from "@/lib/domain";
import { BIL_TILHØRIGHETER } from "@/lib/domain";
import { useAppData } from "@/lib/hooks/useAppData";
import { syncBilerEtterAnsattFastBil } from "@/lib/kjoretoy/syncFastKjoretoy";
import { sorterBiler } from "@/lib/utils/sort";
import { useAuth } from "@/lib/state/authStore";
import { IMPORTERTE_BILER_REFERANSE_2026 } from "@/lib/imported/kjoretoy-referanse-2026";

type BilStoreValue = {
  biler: Bil[];
  lagre: (item: Bil) => void;
  slett: (id: string) => void;
  syncSjåførForAnsatt: (ansattId: string, nyBilId?: string, gammelBilId?: string) => void;
};

const STORAGE_KEY = "bemanning.biler.v1";
const Ctx = createContext<BilStoreValue | null>(null);

function standardBiler(): Bil[] {
  return IMPORTERTE_BILER_REFERANSE_2026;
}

function normalizeLoaded(data: unknown): Bil[] {
  if (!Array.isArray(data)) return [];
  const parsed = data
    .filter((x) => x && typeof x === "object")
    .map((x) => x as Record<string, unknown>)
    .map((x) => {
      const id = String(x.id ?? "");
      const kjennemerke = String(x.kjennemerke ?? "").trim();
      const merke = typeof x.merke === "string" ? x.merke.trim() : undefined;
      const modell = typeof x.modell === "string" ? x.modell.trim() : undefined;
      const aktiv = x.aktiv === false || x.aktiv === "nei" ? false : true;
      const tilhørighet =
        typeof x.tilhørighet === "string" &&
        BIL_TILHØRIGHETER.includes(x.tilhørighet as BilTilhørighet)
          ? (x.tilhørighet as BilTilhørighet)
          : undefined;
      const kommentar = typeof x.kommentar === "string" ? x.kommentar : undefined;
      const fastSjåførAnsattIds = Array.isArray(x.fastSjåførAnsattIds)
        ? x.fastSjåførAnsattIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : undefined;
      if (!id || !kjennemerke) return null;
      return {
        id,
        kjennemerke,
        merke,
        modell,
        aktiv,
        tilhørighet,
        kommentar,
        fastSjåførAnsattIds: fastSjåførAnsattIds?.length ? fastSjåførAnsattIds : undefined,
      } as Bil;
    })
    .filter(Boolean) as Bil[];
  return parsed;
}

function nyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `bil-${Date.now()}`;
}

export function BilStoreProvider({ children }: { children: React.ReactNode }) {
  const { canEditMasterdata } = useAuth();
  const { data: biler, setData: setBiler } = useAppData<Bil[]>(STORAGE_KEY, {
    getDefault: () => [],
    parse: (raw) => normalizeLoaded(raw),
  });

  const lagre = (item: Bil) => {
    if (!canEditMasterdata) return;
    setBiler((prev) => {
      const i = prev.findIndex((b) => b.id === item.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = item;
        return copy;
      }
      return [{ ...item, id: item.id || nyId() }, ...prev];
    });
  };

  const slett = (id: string) => {
    if (!canEditMasterdata) return;
    setBiler((prev) => prev.filter((b) => b.id !== id));
  };

  const syncSjåførForAnsatt = (ansattId: string, nyBilId?: string, gammelBilId?: string) => {
    if (!canEditMasterdata) return;
    setBiler((prev) => syncBilerEtterAnsattFastBil(prev, ansattId, nyBilId, gammelBilId));
  };

  const value = useMemo(
    () => ({
      biler: sorterBiler(biler),
      lagre,
      slett,
      syncSjåførForAnsatt,
    }),
    [biler],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBilStore(): BilStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBilStore må brukes innenfor BilStoreProvider");
  return ctx;
}
