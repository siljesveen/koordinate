"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { BilUtilgjengelig, KjøretøyUtilgjengeligType } from "@/lib/domain";
import { patchAppData, readAppDataLocal, subscribeAppDataKey } from "@/lib/data/appDataEngine";
import type { AppDataKey } from "@/lib/data/storageKeys";
import { resolveBilPeriodeEtterMerkeTilbake } from "@/lib/kjoretoyTilgjengelighet";
import { useAuth } from "@/lib/state/authStore";
import {
  abonnerBilUtilgjengelig,
  sendBilTilbakeMelding,
  type BilTilbakeMelding,
} from "@/lib/sync/bilUtilgjengeligBroadcast";

export type MerkBilTilbakeMeta = {
  tilDato?: string;
  kjennemerke?: string;
};

type BilUtilgjengeligStoreValue = {
  poster: BilUtilgjengelig[];
  lagre: (item: BilUtilgjengelig) => void;
  slett: (id: string) => void;
  /** Avslutter periode med til=i dag om nødvendig; blokker ikke plan samme dag (se overlapper …Disponibilitet). */
  merkTilbake: (id: string, meta?: MerkBilTilbakeMeta) => BilTilbakeMelding | null;
  lastInnFraLagring: () => void;
};

const STORAGE_KEY = "bemanning.bilUtilgjengelig.v1" as AppDataKey;
const Ctx = createContext<BilUtilgjengeligStoreValue | null>(null);

const TYPER: KjøretøyUtilgjengeligType[] = [
  "Verksted",
  "Vedlikehold",
  "Havari",
  "Service",
  "Inspeksjon",
  "Annet",
];

function erGyldigType(t: string): t is KjøretøyUtilgjengeligType {
  return TYPER.includes(t as KjøretøyUtilgjengeligType);
}

function normalizeLoaded(data: unknown): BilUtilgjengelig[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => x as Record<string, unknown>)
    .map((x) => {
      const id = String(x.id ?? "");
      const bilId = String(x.bilId ?? "");
      const typeRaw = String(x.type ?? "");
      const fraDato = String(x.fraDato ?? "");
      const tilRaw = x.tilDato;
      const tilDato =
        tilRaw === null || tilRaw === undefined || String(tilRaw).trim() === ""
          ? undefined
          : String(tilRaw);
      const tbRaw = x.tilbakeIDriftDato;
      const tilbakeIDriftDato =
        tbRaw === null || tbRaw === undefined || String(tbRaw).trim() === ""
          ? undefined
          : String(tbRaw);
      const planlagt = typeof x.planlagt === "boolean" ? x.planlagt : undefined;
      const kommentar = typeof x.kommentar === "string" ? x.kommentar : undefined;
      const type = erGyldigType(typeRaw) ? typeRaw : "Annet";
      if (!id || !bilId || !fraDato) return null;
      if (tilDato && fraDato > tilDato) return null;
      return {
        id,
        bilId,
        type,
        fraDato,
        tilDato,
        tilbakeIDriftDato,
        planlagt,
        kommentar,
      } as BilUtilgjengelig;
    })
    .filter(Boolean) as BilUtilgjengelig[];
}

function lesFraLocal(): BilUtilgjengelig[] {
  return normalizeLoaded(readAppDataLocal(STORAGE_KEY));
}

function patchPoster(
  updater: (prev: BilUtilgjengelig[]) => BilUtilgjengelig[],
  canEdit: boolean,
): BilUtilgjengelig[] {
  return patchAppData<BilUtilgjengelig[]>(
    STORAGE_KEY,
    (raw) => updater(normalizeLoaded(raw)),
    { canEdit },
  );
}

function nyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `bu-${Date.now()}`;
}

export function BilUtilgjengeligStoreProvider({ children }: { children: React.ReactNode }) {
  const { dataReady, canEdit } = useAuth();
  const [poster, setPoster] = useState<BilUtilgjengelig[]>(() => lesFraLocal());
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  const syncFraCache = useCallback(() => {
    setPoster(lesFraLocal());
  }, []);

  useEffect(() => {
    if (!dataReady) return;
    syncFraCache();
    return subscribeAppDataKey(STORAGE_KEY, syncFraCache);
  }, [dataReady, syncFraCache]);

  useEffect(() => {
    return abonnerBilUtilgjengelig(syncFraCache);
  }, [syncFraCache]);

  const lagre = useCallback((item: BilUtilgjengelig) => {
    if (!canEditRef.current) return;
    patchPoster((prev) => {
      const i = prev.findIndex((p) => p.id === item.id);
      if (i >= 0) {
        const old = prev[i];
        const datoEndret = old.fraDato !== item.fraDato || old.tilDato !== item.tilDato;
        const merged: BilUtilgjengelig = {
          ...item,
          tilbakeIDriftDato:
            datoEndret ? undefined : (item.tilbakeIDriftDato ?? old.tilbakeIDriftDato),
        };
        const copy = [...prev];
        copy[i] = merged;
        return copy;
      }
      return [{ ...item, id: item.id || nyId() }, ...prev];
    }, canEditRef.current);
  }, []);

  const slett = useCallback((id: string) => {
    if (!canEditRef.current) return;
    patchPoster((prev) => prev.filter((p) => p.id !== id), canEditRef.current);
  }, []);

  const merkTilbake = useCallback(
    (id: string, meta?: MerkBilTilbakeMeta): BilTilbakeMelding | null => {
      if (!canEditRef.current) return null;
      const post = poster.find((p) => p.id === id);
      if (!post) return null;

      const kjennemerke = meta?.kjennemerke?.trim() || post.bilId;
      const resolved = resolveBilPeriodeEtterMerkeTilbake(post, meta?.tilDato);

      if (resolved.kind === "ingen") return null;

      let next: BilUtilgjengelig[];
      let tilDatoMelding: string;

      if (resolved.kind === "slett") {
        next = poster.filter((p) => p.id !== id);
        tilDatoMelding = post.tilDato ?? post.fraDato;
      } else {
        next = poster.map((p) =>
          p.id === id
            ? { ...p, tilDato: resolved.tilDato, tilbakeIDriftDato: resolved.tilDato }
            : p,
        );
        tilDatoMelding = resolved.tilDato;
      }

      const fullMelding: BilTilbakeMelding = {
        type: "bil-tilbake",
        bilId: post.bilId,
        kjennemerke,
        tilDato: tilDatoMelding,
        tidspunkt: new Date().toISOString(),
      };

      patchPoster(() => next, canEditRef.current);
      sendBilTilbakeMelding(fullMelding);

      return fullMelding;
    },
    [poster],
  );

  const value = useMemo(
    () => ({ poster, lagre, slett, merkTilbake, lastInnFraLagring: syncFraCache }),
    [poster, lagre, slett, merkTilbake, syncFraCache],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBilUtilgjengeligStore(): BilUtilgjengeligStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBilUtilgjengeligStore må brukes innenfor BilUtilgjengeligStoreProvider");
  return ctx;
}
