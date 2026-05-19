"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { BilUtilgjengelig, KjøretøyUtilgjengeligType } from "@/lib/domain";
import { loadAppData, saveAppData } from "@/lib/data/appDataStorage";
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

const STORAGE_KEY = "bemanning.bilUtilgjengelig.v1";
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

async function lesFraLagring(): Promise<BilUtilgjengelig[]> {
  try {
    const raw = await loadAppData(STORAGE_KEY);
    if (raw === null || raw === undefined) return [];
    return normalizeLoaded(raw);
  } catch {
    return [];
  }
}

function nyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `bu-${Date.now()}`;
}

export function BilUtilgjengeligStoreProvider({ children }: { children: React.ReactNode }) {
  const { dataReady, canEdit } = useAuth();
  const [poster, setPoster] = useState<BilUtilgjengelig[]>([]);
  const loaded = useRef(false);
  const hopperOverLagring = useRef(false);

  const lastInnFraLagring = useCallback(() => {
    void lesFraLagring().then(setPoster);
  }, []);

  useEffect(() => {
    if (!dataReady) return;
    void lesFraLagring().then((data) => {
      setPoster(data);
      loaded.current = true;
    });
  }, [dataReady]);

  useEffect(() => {
    if (!loaded.current || !dataReady) return;
    if (hopperOverLagring.current) {
      hopperOverLagring.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void saveAppData(STORAGE_KEY, poster, canEdit);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [poster, dataReady, canEdit]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      hopperOverLagring.current = true;
      lastInnFraLagring();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [lastInnFraLagring]);

  useEffect(() => {
    return abonnerBilUtilgjengelig(() => {
      hopperOverLagring.current = true;
      lastInnFraLagring();
    });
  }, [lastInnFraLagring]);

  const lagre = (item: BilUtilgjengelig) => {
    setPoster((prev) => {
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
    });
  };

  const slett = (id: string) => setPoster((prev) => prev.filter((p) => p.id !== id));

  const merkTilbake = (id: string, meta?: MerkBilTilbakeMeta): BilTilbakeMelding | null => {
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

    hopperOverLagring.current = true;
    void saveAppData(STORAGE_KEY, next, canEdit);
    setPoster(next);
    sendBilTilbakeMelding(fullMelding);

    return fullMelding;
  };

  const value = useMemo(
    () => ({ poster, lagre, slett, merkTilbake, lastInnFraLagring }),
    [poster, lastInnFraLagring],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBilUtilgjengeligStore(): BilUtilgjengeligStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBilUtilgjengeligStore må brukes innenfor BilUtilgjengeligStoreProvider");
  return ctx;
}
