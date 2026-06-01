"use client";

import { createContext, useContext, useMemo } from "react";
import type { Henger, BilTilhørighet } from "@/lib/domain";
import { BIL_TILHØRIGHETER } from "@/lib/domain";
import { useAppData } from "@/lib/hooks/useAppData";
import { syncHengereEtterAnsattFastHenger } from "@/lib/kjoretoy/syncFastKjoretoy";
import { useAuth } from "@/lib/state/authStore";
import { IMPORTERTE_HENGERE_REFERANSE_2026 } from "@/lib/imported/kjoretoy-referanse-2026";

type HengerStoreValue = {
  hengere: Henger[];
  lagre: (item: Henger) => void;
  slett: (id: string) => void;
  syncSjåførForAnsatt: (ansattId: string, nyHengerId?: string, gammelHengerId?: string) => void;
};

const STORAGE_KEY = "bemanning.henger.v1";
const Ctx = createContext<HengerStoreValue | null>(null);

function standardHengere(): Henger[] {
  return IMPORTERTE_HENGERE_REFERANSE_2026;
}

function normalizeLoaded(data: unknown): Henger[] {
  if (!Array.isArray(data)) return [];
  const parsed = data
    .filter((x) => x && typeof x === "object")
    .map((x) => x as Record<string, unknown>)
    .map((x) => {
      const id = String(x.id ?? "");
      const kjennemerke = String(x.kjennemerke ?? "").trim();
      const type = typeof x.type === "string" ? x.type.trim() : undefined;
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
        type,
        aktiv,
        tilhørighet,
        kommentar,
        fastSjåførAnsattIds: fastSjåførAnsattIds?.length ? fastSjåførAnsattIds : undefined,
      } as Henger;
    })
    .filter(Boolean) as Henger[];
  return parsed;
}

function nyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `henger-${Date.now()}`;
}

export function HengerStoreProvider({ children }: { children: React.ReactNode }) {
  const { canEdit } = useAuth();
  const { data: hengere, setData: setHengere } = useAppData<Henger[]>(STORAGE_KEY, {
    getDefault: () => [],
    parse: (raw) => normalizeLoaded(raw),
  });

  const lagre = (item: Henger) => {
    if (!canEdit) return;
    setHengere((prev) => {
      const i = prev.findIndex((h) => h.id === item.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = item;
        return copy;
      }
      return [{ ...item, id: item.id || nyId() }, ...prev];
    });
  };

  const slett = (id: string) => {
    if (!canEdit) return;
    setHengere((prev) => prev.filter((h) => h.id !== id));
  };

  const syncSjåførForAnsatt = (ansattId: string, nyHengerId?: string, gammelHengerId?: string) => {
    if (!canEdit) return;
    setHengere((prev) => syncHengereEtterAnsattFastHenger(prev, ansattId, nyHengerId, gammelHengerId));
  };

  const value = useMemo(
    () => ({ hengere, lagre, slett, syncSjåførForAnsatt }),
    [hengere],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHengerStore(): HengerStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHengerStore må brukes innenfor HengerStoreProvider");
  return ctx;
}
