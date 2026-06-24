"use client";

import { slotMedSjåførOgKjoretoy, backfillMasterplanKjoretoyFraAnsatte } from "@/lib/utils/masterplanKjoretoy";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Koblingsgruppe, MasterRuteSlot, MasterRuteplan, Skift, Ansatt } from "@/lib/domain";
import { patchAppData, subscribeAppDataKey } from "@/lib/data/appDataEngine";
import type { AppDataKey } from "@/lib/data/storageKeys";
import { useAuth } from "@/lib/state/authStore";
import type { UkeNummer } from "@/lib/imported/applyUkeMasterplan";
import { isDevEnvironment } from "@/lib/env/isDevEnvironment";
import {
  MASTERPLAN_STORAGE_KEY,
  processMasterplanRaw,
  readMasterplanFromLocalCache,
  masterSlotId,
} from "@/lib/masterplan/masterplanCache";
import { sorterRutekoder } from "@/lib/utils/sort";
import { erUkeImportApplied, merkUkeImportApplied } from "@/lib/masterplan/ukeImportMeta";
import {
  erKjoretoyBackfillApplied,
  merkKjoretoyBackfillApplied,
} from "@/lib/masterplan/kjoretoyBackfillMeta";

const STORAGE_KEY = MASTERPLAN_STORAGE_KEY as AppDataKey;

/** Synkroniser React-state etter vellykket patch (satt av provider). */
let syncMasterplanState: ((plan: MasterRuteplan) => void) | undefined;

function planFraRaw(raw: unknown): MasterRuteplan {
  return (
    processMasterplanRaw(raw) ?? {
      syklusLengde: 4,
      slots: [],
      referanseDato: "2026-06-16",
      aktivUkeVedReferanse: 2,
    }
  );
}

function patchMasterplan(
  updater: (prev: MasterRuteplan) => MasterRuteplan,
  canEdit: boolean,
): void {
  const next = patchAppData<MasterRuteplan>(
    STORAGE_KEY,
    (raw) => updater(planFraRaw(raw)),
    { canEdit },
  );
  if (canEdit && syncMasterplanState) {
    syncMasterplanState(processMasterplanRaw(next) ?? next);
  }
}

export { masterSlotId };

const KOBLE_FELT = [
  "standardSjåførAnsattId",
  "standardBilId",
  "standardHengerId",
] as const;

type KobleFelt = (typeof KOBLE_FELT)[number];

function erKobleFelt(key: string): key is KobleFelt {
  return (KOBLE_FELT as readonly string[]).includes(key);
}

function brukFeltIPlan(
  prev: MasterRuteplan,
  slotId: string,
  felt: Partial<MasterRuteSlot>,
): MasterRuteplan {
  const idx = prev.slots.findIndex((s) => s.id === slotId);
  if (idx < 0) return prev;

  const basis = prev.slots[idx];
  const oppdatert = { ...basis, ...felt };
  const gruppe = basis.koblingsgruppe;
  const skalSynceKobling = Object.keys(felt).some(erKobleFelt);

  const koblingsFelt: Partial<Pick<MasterRuteSlot, KobleFelt>> = {};
  for (const key of Object.keys(felt)) {
    if (erKobleFelt(key)) {
      koblingsFelt[key] = felt[key];
    }
  }

  const nyeSlots = prev.slots.map((s) => {
    if (s.id === slotId) return oppdatert;
    if (skalSynceKobling && gruppe && s.koblingsgruppe === gruppe) {
      return { ...s, ...koblingsFelt };
    }
    return s;
  });

  return { ...prev, slots: nyeSlots };
}

type MasterplanStoreValue = {
  masterplan: MasterRuteplan;
  lagreSlot: (slot: MasterRuteSlot) => void;
  oppdaterSlotFelt: (slotId: string, felt: Partial<MasterRuteSlot>) => void;
  lagreSjåførForSlot: (
    slotId: string,
    ansattId: string | undefined,
    ansatt?: Pick<Ansatt, "fastBilId" | "fastHengerId"> | null,
  ) => void;
  slettSlot: (id: string) => void;
  lagreHel: (plan: MasterRuteplan) => void;
  koblRuter: (gruppenavn: string, rutekoder: string[], opts?: { skift?: Skift; dag?: 1|2|3|4|5|6|7 }) => void;
  fjernKobling: (gruppenavn: string) => void;
};

const Ctx = createContext<MasterplanStoreValue | null>(null);

function ansattMapFraLocalStorage(): Map<string, Ansatt> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem("bemanning.ansatte.v2");
    if (!raw) return new Map();
    const liste = JSON.parse(raw) as Ansatt[];
    if (!Array.isArray(liste)) return new Map();
    return new Map(liste.map((a) => [a.id, a]));
  } catch {
    return new Map();
  }
}

export function MasterplanStoreProvider({ children }: { children: React.ReactNode }) {
  const { dataReady, canEditMasterdata } = useAuth();
  const [masterplan, setMasterplan] = useState<MasterRuteplan>(
    () =>
      readMasterplanFromLocalCache() ?? {
        syklusLengde: 4,
        slots: [],
        referanseDato: "2026-06-16",
        aktivUkeVedReferanse: 2,
      },
  );
  const loadedRef = useRef(
    typeof window !== "undefined" && (readMasterplanFromLocalCache()?.slots.length ?? 0) > 0,
  );
  const canEditRef = useRef(canEditMasterdata);
  canEditRef.current = canEditMasterdata;

  const syncFraCache = useCallback(() => {
    const loaded = readMasterplanFromLocalCache();
    if (loaded) {
      setMasterplan(loaded);
      loadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    syncMasterplanState = setMasterplan;
    return () => {
      syncMasterplanState = undefined;
    };
  }, []);

  useEffect(() => {
    if (!dataReady) return;
    syncFraCache();
    return subscribeAppDataKey(STORAGE_KEY, syncFraCache);
  }, [dataReady, syncFraCache]);

  /** Engangsimport av uke-patch — kun lokal utvikling, utsatt så navigering ikke blokkeres. */
  useEffect(() => {
    if (!isDevEnvironment()) return;
    if (!dataReady || !canEditMasterdata || !loadedRef.current) return;
    if (masterplan.slots.length === 0) return;

    let cancelled = false;
    const schedule =
      typeof requestIdleCallback === "function"
        ? (fn: () => void) => requestIdleCallback(fn, { timeout: 4000 })
        : (fn: () => void) => window.setTimeout(fn, 50);
    const cancelSchedule =
      typeof cancelIdleCallback === "function"
        ? cancelIdleCallback
        : clearTimeout;

    const idleId = schedule(() => {
      void (async () => {
        const ansattMap = ansattMapFraLocalStorage();
        if (ansattMap.size === 0 || cancelled) return;

        const { mergeUkeMasterplanPatch, UKE_MASTERPLAN_PATCHES } = await import(
          "@/lib/imported/applyUkeMasterplan"
        );

        patchMasterplan((plan) => {
          let next = plan;
          let anyUpdated = false;

          for (const uke of [1, 2, 3, 4] as const) {
            const patch = UKE_MASTERPLAN_PATCHES[uke];
            const patchVersjon = String(patch.meta?.generert ?? "");
            if (!patchVersjon) continue;
            if (erUkeImportApplied(uke, patchVersjon)) continue;

            const { plan: merged, updated } = mergeUkeMasterplanPatch(next, patch, ansattMap);
            merkUkeImportApplied(uke, patchVersjon);
            if (updated > 0) {
              next = merged;
              anyUpdated = true;
              console.info(`[masterplan] Uke ${patch.uke} lagt inn — ${updated} ruter oppdatert.`);
            }
          }

          return anyUpdated ? next : plan;
        }, canEditRef.current);
      })();
    });

    return () => {
      cancelled = true;
      cancelSchedule(idleId as number);
    };
  }, [dataReady, canEditMasterdata, masterplan.slots.length]);

  /** Engangs-backfill: fyll inn fast bil/henger for ruter som allerede har sjåfør. */
  useEffect(() => {
    if (!dataReady || !canEditMasterdata || !loadedRef.current) return;
    if (masterplan.slots.length === 0) return;
    if (erKjoretoyBackfillApplied()) return;

    let cancelled = false;
    const schedule =
      typeof requestIdleCallback === "function"
        ? (fn: () => void) => requestIdleCallback(fn, { timeout: 4000 })
        : (fn: () => void) => window.setTimeout(fn, 50);
    const cancelSchedule =
      typeof cancelIdleCallback === "function"
        ? cancelIdleCallback
        : clearTimeout;

    const idleId = schedule(() => {
      const ansattMap = ansattMapFraLocalStorage();
      if (ansattMap.size === 0 || cancelled) return;

      patchMasterplan((plan) => {
        const { plan: next, updated } = backfillMasterplanKjoretoyFraAnsatte(plan, ansattMap);
        if (updated > 0) {
          console.info(`[masterplan] Backfill kjøretøy — ${updated} ruter oppdatert.`);
        }
        merkKjoretoyBackfillApplied();
        return updated > 0 ? next : plan;
      }, canEditRef.current);
    });

    return () => {
      cancelled = true;
      cancelSchedule(idleId as number);
    };
  }, [dataReady, canEditMasterdata, masterplan.slots.length]);

  const lagreSlot = useCallback((slot: MasterRuteSlot) => {
    if (!canEditRef.current) return;
    patchMasterplan((prev) => {
      const idx = prev.slots.findIndex((s) => s.id === slot.id);
      const nyeSlots = [...prev.slots];
      if (idx >= 0) nyeSlots[idx] = slot;
      else nyeSlots.push(slot);
      return { ...prev, slots: nyeSlots };
    }, canEditRef.current);
  }, []);

  const oppdaterSlotFelt = useCallback((slotId: string, felt: Partial<MasterRuteSlot>) => {
    if (!canEditRef.current) return;
    patchMasterplan((prev) => brukFeltIPlan(prev, slotId, felt), canEditRef.current);
  }, []);

  const lagreSjåførForSlot = useCallback(
    (
      slotId: string,
      ansattId: string | undefined,
      ansatt?: Pick<Ansatt, "fastBilId" | "fastHengerId"> | null,
    ) => {
    if (!canEditRef.current) return;
    patchMasterplan((prev) => {
      const slot = prev.slots.find((s) => s.id === slotId);
      if (!slot) return prev;
      const oppdatert = slotMedSjåførOgKjoretoy(slot, ansattId, ansatt);
      return brukFeltIPlan(prev, slotId, {
        standardSjåførAnsattId: oppdatert.standardSjåførAnsattId,
        standardBilId: oppdatert.standardBilId,
        standardHengerId: oppdatert.standardHengerId,
      });
    }, canEditRef.current);
  },
    [],
  );

  const slettSlot = useCallback((id: string) => {
    if (!canEditRef.current) return;
    patchMasterplan(
      (prev) => ({ ...prev, slots: prev.slots.filter((s) => s.id !== id) }),
      canEditRef.current,
    );
  }, []);

  const lagreHel = useCallback((plan: MasterRuteplan) => {
    if (!canEditRef.current) return;
    patchMasterplan(() => plan, canEditRef.current);
  }, []);

  const koblRuter = useCallback(
    (gruppenavn: string, rutekoder: string[], opts?: { skift?: Skift; dag?: 1|2|3|4|5|6|7 }) => {
      if (!canEditRef.current) return;
      patchMasterplan((prev) => {
        const koder = sorterRutekoder(rutekoder);
        const nyGruppe: Koblingsgruppe = { rutekoder: koder, dag: opts?.dag, skift: opts?.skift };
        const grupper = { ...(prev.koblingsgrupper ?? {}), [gruppenavn]: nyGruppe };
        const kodSet = new Set(koder);
        const nyeSlots = prev.slots.map((s) => {
          if (!kodSet.has(s.rutekode)) return s;
          if (opts?.skift && s.skift !== opts.skift) return s;
          if (opts?.dag && s.dag !== opts.dag) return s;
          return { ...s, koblingsgruppe: gruppenavn };
        });
        return { ...prev, slots: nyeSlots, koblingsgrupper: grupper };
      }, canEditRef.current);
    },
    [],
  );

  const fjernKobling = useCallback((gruppenavn: string) => {
    if (!canEditRef.current) return;
    patchMasterplan((prev) => {
      const grupper = { ...(prev.koblingsgrupper ?? {}) };
      delete grupper[gruppenavn];
      const nyeSlots = prev.slots.map((s) =>
        s.koblingsgruppe === gruppenavn ? { ...s, koblingsgruppe: undefined } : s,
      );
      return { ...prev, slots: nyeSlots, koblingsgrupper: grupper };
    }, canEditRef.current);
  }, []);

  const value = useMemo(
    () => ({
      masterplan,
      lagreSlot,
      oppdaterSlotFelt,
      lagreSjåførForSlot,
      slettSlot,
      lagreHel,
      koblRuter,
      fjernKobling,
    }),
    [masterplan, lagreSlot, oppdaterSlotFelt, lagreSjåførForSlot, slettSlot, lagreHel, koblRuter, fjernKobling],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMasterplanStore(): MasterplanStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMasterplanStore må brukes innenfor MasterplanStoreProvider");
  return ctx;
}
