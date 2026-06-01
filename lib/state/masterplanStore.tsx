"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Koblingsgruppe, MasterRuteSlot, MasterRuteplan, Skift, Ansatt } from "@/lib/domain";
import { loadAppData, saveAppData } from "@/lib/data/appDataStorage";
import { markKeyDirty } from "@/lib/data/dirtyKeys";
import {
  mergeUkeMasterplanPatch,
  UKE_MASTERPLAN_PATCHES,
  type UkeNummer,
} from "@/lib/imported/applyUkeMasterplan";
import { useAuth } from "@/lib/state/authStore";
import { useAppDataReload } from "@/lib/state/appDataReload";
import {
  RINGNES_CYCLE,
  type RingnesCycleData,
} from "@/lib/imported/ringnesCycle";
import { ALIAS_MAP_KEY, BASELINE_KEY, type AliasMap, safeJsonParse } from "./baselineStore";

const STORAGE_KEY = "bemanning.masterplan.v1";
const UKE1_IMPORT_KEY = "bemanning.uke1ImportApplied.v2";
const UKE2_IMPORT_KEY = "bemanning.uke2ImportApplied.v1";
const UKE3_IMPORT_KEY = "bemanning.uke3ImportApplied.v1";
const UKE4_IMPORT_KEY = "bemanning.uke4ImportApplied.v2";

const UKE_IMPORT_KEYS: Record<UkeNummer, string> = {
  1: UKE1_IMPORT_KEY,
  2: UKE2_IMPORT_KEY,
  3: UKE3_IMPORT_KEY,
  4: UKE4_IMPORT_KEY,
};

const UKE_AUTO_IMPORTS = ([1, 2, 3, 4] as const).map((uke) => ({
  patch: UKE_MASTERPLAN_PATCHES[uke],
  key: UKE_IMPORT_KEYS[uke],
}));

export function masterSlotId(
  uke: number,
  dag: number,
  skift: Skift,
  rutekode: string,
): string {
  return `ms-${uke}-${dag}-${skift}-${encodeURIComponent(rutekode)}`;
}

function konverterBaselineTilMaster(
  cycle: RingnesCycleData,
  aliasMap: AliasMap,
): MasterRuteplan {
  const slotMap = new Map<string, MasterRuteSlot>();

  for (const [ukeStr, dager] of Object.entries(cycle.cycle)) {
    const uke = Number(ukeStr);
    if (uke < 1 || uke > 4) continue;

    for (const [dagStr, skiftMap] of Object.entries(dager)) {
      const dag = Number(dagStr);
      if (dag < 1 || dag > 7) continue;

      for (const [skiftStr, skiftPlan] of Object.entries(skiftMap)) {
        const skift = skiftStr as Skift;
        if (skift !== "Dag" && skift !== "Kveld") continue;
        if (!skiftPlan?.ruter) continue;

        for (const rute of skiftPlan.ruter) {
          const rutekode = rute.rute.trim();
          if (!rutekode) continue;

          const id = masterSlotId(uke, dag, skift, rutekode);
          if (slotMap.has(id)) continue;

          const sjåførAnsattId =
            rute.sjåfør && aliasMap[rute.sjåfør]
              ? aliasMap[rute.sjåfør]
              : undefined;

          slotMap.set(id, {
            id,
            uke: uke as 1 | 2 | 3 | 4,
            dag: dag as 1 | 2 | 3 | 4 | 5 | 6 | 7,
            skift,
            rutekode,
            rutenavn: rute.rutenavn?.trim() || undefined,
            standardSjåførAnsattId: sjåførAnsattId,
          });
        }
      }
    }
  }

  return { syklusLengde: 4, slots: [...slotMap.values()] };
}

/** Fjerner duplikate slots (samme uke/dag/skift/rutekode) fra eksisterende data. */
function deduplicateSlots(plan: MasterRuteplan): MasterRuteplan {
  const seen = new Map<string, MasterRuteSlot>();
  for (const slot of plan.slots) {
    const key = masterSlotId(slot.uke, slot.dag, slot.skift, slot.rutekode);
    if (!seen.has(key)) {
      seen.set(key, slot);
    }
  }
  if (seen.size === plan.slots.length) return plan;
  return { ...plan, slots: [...seen.values()] };
}

function normalizeLoaded(data: unknown): MasterRuteplan | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const syklusLengde = typeof obj.syklusLengde === "number" ? obj.syklusLengde : 4;
  if (!Array.isArray(obj.slots)) return null;

  const slots: MasterRuteSlot[] = obj.slots
    .filter((x: unknown) => x && typeof x === "object")
    .map((x: unknown) => {
      const s = x as Record<string, unknown>;
      const id = String(s.id ?? "");
      const uke = Number(s.uke);
      const dag = Number(s.dag);
      const skift = s.skift === "Dag" || s.skift === "Kveld" ? s.skift : null;
      const rutekode = String(s.rutekode ?? "");
      if (!id || uke < 1 || uke > 4 || dag < 1 || dag > 7 || !skift || !rutekode) return null;

      return {
        id,
        uke: uke as 1 | 2 | 3 | 4,
        dag: dag as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        skift,
        rutekode,
        rutenavn: typeof s.rutenavn === "string" ? s.rutenavn : undefined,
        standardSjåførAnsattId:
          typeof s.standardSjåførAnsattId === "string" && s.standardSjåførAnsattId
            ? s.standardSjåførAnsattId
            : undefined,
        standardBilId:
          typeof s.standardBilId === "string" && s.standardBilId ? s.standardBilId : undefined,
        standardHengerId:
          typeof s.standardHengerId === "string" && s.standardHengerId
            ? s.standardHengerId
            : undefined,
        startTid:
          typeof s.startTid === "string" && s.startTid ? s.startTid : undefined,
        sluttTid:
          typeof s.sluttTid === "string" && s.sluttTid ? s.sluttTid : undefined,
        varighet:
          typeof s.varighet === "number" && s.varighet > 1 ? s.varighet : undefined,
        koblingsgruppe:
          typeof s.koblingsgruppe === "string" && s.koblingsgruppe
            ? s.koblingsgruppe
            : undefined,
      } as MasterRuteSlot;
    })
    .filter(Boolean) as MasterRuteSlot[];

  if (slots.length === 0) return null;
  let koblingsgrupper: Record<string, Koblingsgruppe> | undefined;
  if (obj.koblingsgrupper && typeof obj.koblingsgrupper === "object") {
    const raw = obj.koblingsgrupper as Record<string, unknown>;
    koblingsgrupper = {};
    for (const [key, val] of Object.entries(raw)) {
      if (Array.isArray(val)) {
        // Migrering fra gammelt format (string[]) til nytt (Koblingsgruppe)
        koblingsgrupper[key] = { rutekoder: val.filter((x) => typeof x === "string") };
      } else if (val && typeof val === "object") {
        const v = val as Record<string, unknown>;
        const rutekoder = Array.isArray(v.rutekoder) ? v.rutekoder.filter((x: unknown) => typeof x === "string") : [];
        const skift = v.skift === "Dag" || v.skift === "Kveld" ? v.skift : undefined;
        const dag = typeof v.dag === "number" && v.dag >= 1 && v.dag <= 7 ? v.dag as 1|2|3|4|5|6|7 : undefined;
        if (rutekoder.length >= 2) koblingsgrupper[key] = { rutekoder, dag, skift };
      }
    }
    if (Object.keys(koblingsgrupper).length === 0) koblingsgrupper = undefined;
  }
  return { syklusLengde, slots, koblingsgrupper };
}

type MasterplanStoreValue = {
  masterplan: MasterRuteplan;
  lagreSlot: (slot: MasterRuteSlot) => void;
  slettSlot: (id: string) => void;
  lagreHel: (plan: MasterRuteplan) => void;
  koblRuter: (gruppenavn: string, rutekoder: string[], opts?: { skift?: Skift; dag?: 1|2|3|4|5|6|7 }) => void;
  fjernKobling: (gruppenavn: string) => void;
};

const Ctx = createContext<MasterplanStoreValue | null>(null);

const BAMA_RUTER: { rutekode: string; rutenavn: string }[] = [
  { rutekode: "1520", rutenavn: "Bama shh Hamar" },
  { rutekode: "1550", rutenavn: "Bama shh Gjøvik" },
  { rutekode: "1560", rutenavn: "Bama shh Lillehammer" },
];

function ensureBamaAlleDager(plan: MasterRuteplan): MasterRuteplan {
  let endret = false;
  const nyeSlots = [...plan.slots];

  for (let uke = 1; uke <= 4; uke++) {
    for (let dag = 1; dag <= 6; dag++) {
      for (const bama of BAMA_RUTER) {
        const finnes = nyeSlots.some(
          (s) => s.uke === uke && s.dag === dag && s.skift === "Dag" && s.rutekode === bama.rutekode,
        );
        if (!finnes) {
          endret = true;
          nyeSlots.push({
            id: masterSlotId(uke, dag, "Dag", bama.rutekode),
            uke: uke as 1 | 2 | 3 | 4,
            dag: dag as 1 | 2 | 3 | 4 | 5 | 6 | 7,
            skift: "Dag",
            rutekode: bama.rutekode,
            rutenavn: bama.rutenavn,
          });
        }
      }
    }
  }

  if (!endret) return plan;
  return { ...plan, slots: nyeSlots };
}

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
  const { dataReady, canEdit, configured, profile } = useAuth();
  const { reloadTick } = useAppDataReload();
  const innlogget = configured && !!profile;
  const [masterplan, setMasterplan] = useState<MasterRuteplan>({ syklusLengde: 4, slots: [] });
  const loadedRef = useRef(false);
  /** Unngår at innlasting overskriver sky med tom/eldre masterplan (f.eks. uten koblingsgrupper). */
  const brukerHarEndret = useRef(false);

  useEffect(() => {
    if (!dataReady) return;

    let cancelled = false;

    void (async () => {
      try {
        const raw = await loadAppData(STORAGE_KEY, innlogget);
        if (cancelled) return;

        if (raw !== null && raw !== undefined) {
          const loaded = normalizeLoaded(raw);
          if (loaded) {
            const fixed = ensureBamaAlleDager(deduplicateSlots(loaded));
            setMasterplan(fixed);
            loadedRef.current = true;
            return;
          }
        }

        const aliasMap = safeJsonParse<AliasMap>(window.localStorage.getItem(ALIAS_MAP_KEY)) ?? {};
        const baseline = safeJsonParse<RingnesCycleData>(
          window.localStorage.getItem(BASELINE_KEY),
        );
        const source = baseline ?? RINGNES_CYCLE;
        const migrert = ensureBamaAlleDager(konverterBaselineTilMaster(source, aliasMap));
        setMasterplan(migrert);
      } catch {
        const migrert = ensureBamaAlleDager(konverterBaselineTilMaster(RINGNES_CYCLE, {}));
        if (!cancelled) setMasterplan(migrert);
      } finally {
        if (!cancelled) loadedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataReady, reloadTick, innlogget]);

  /** Engangsimport av uke-patch (per patch-generert tidspunkt). */
  useEffect(() => {
    if (!dataReady || !canEdit || !loadedRef.current || !innlogget) return;
    if (masterplan.slots.length === 0) return;

    const ansattMap = ansattMapFraLocalStorage();
    if (ansattMap.size === 0) return;

    let plan = masterplan;
    let anyUpdated = false;

    for (const { patch, key } of UKE_AUTO_IMPORTS) {
      const patchVersjon = String(patch.meta?.generert ?? "");
      if (!patchVersjon) continue;
      if (window.localStorage.getItem(key) === patchVersjon) continue;

      const { plan: next, updated } = mergeUkeMasterplanPatch(plan, patch, ansattMap);
      window.localStorage.setItem(key, patchVersjon);
      if (updated > 0) {
        plan = next;
        anyUpdated = true;
        console.info(`[masterplan] Uke ${patch.uke} lagt inn — ${updated} ruter oppdatert.`);
      }
    }

    if (!anyUpdated) return;

    brukerHarEndret.current = true;
    markKeyDirty(STORAGE_KEY);
    setMasterplan(plan);
  }, [dataReady, canEdit, innlogget, masterplan, reloadTick]);

  useEffect(() => {
    if (!loadedRef.current || !dataReady || !brukerHarEndret.current) return;
    if (masterplan.slots.length === 0) return;

    markKeyDirty(STORAGE_KEY);

    const timer = window.setTimeout(() => {
      void saveAppData(STORAGE_KEY, masterplan, canEdit);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [masterplan, dataReady, canEdit]);

  const lagreSlot = (slot: MasterRuteSlot) => {
    brukerHarEndret.current = true;
    setMasterplan((prev) => {
      const idx = prev.slots.findIndex((s) => s.id === slot.id);
      const nyeSlots = [...prev.slots];
      if (idx >= 0) {
        nyeSlots[idx] = slot;
      } else {
        nyeSlots.push(slot);
      }
      return { ...prev, slots: nyeSlots };
    });
  };

  const slettSlot = (id: string) => {
    brukerHarEndret.current = true;
    setMasterplan((prev) => ({
      ...prev,
      slots: prev.slots.filter((s) => s.id !== id),
    }));
  };

  const lagreHel = (plan: MasterRuteplan) => {
    brukerHarEndret.current = true;
    setMasterplan(plan);
  };

  const koblRuter = (gruppenavn: string, rutekoder: string[], opts?: { skift?: Skift; dag?: 1|2|3|4|5|6|7 }) => {
    brukerHarEndret.current = true;
    setMasterplan((prev) => {
      const nyGruppe: Koblingsgruppe = { rutekoder, dag: opts?.dag, skift: opts?.skift };
      const grupper = { ...(prev.koblingsgrupper ?? {}), [gruppenavn]: nyGruppe };
      const nyeSlots = prev.slots.map((s) => {
        if (!rutekoder.includes(s.rutekode)) return s;
        if (opts?.skift && s.skift !== opts.skift) return s;
        if (opts?.dag && s.dag !== opts.dag) return s;
        return { ...s, koblingsgruppe: gruppenavn };
      });
      return { ...prev, slots: nyeSlots, koblingsgrupper: grupper };
    });
  };

  const fjernKobling = (gruppenavn: string) => {
    brukerHarEndret.current = true;
    setMasterplan((prev) => {
      const grupper = { ...(prev.koblingsgrupper ?? {}) };
      delete grupper[gruppenavn];
      const nyeSlots = prev.slots.map((s) =>
        s.koblingsgruppe === gruppenavn ? { ...s, koblingsgruppe: undefined } : s,
      );
      return { ...prev, slots: nyeSlots, koblingsgrupper: grupper };
    });
  };

  const value = useMemo(() => ({ masterplan, lagreSlot, slettSlot, lagreHel, koblRuter, fjernKobling }), [masterplan]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMasterplanStore(): MasterplanStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMasterplanStore må brukes innenfor MasterplanStoreProvider");
  return ctx;
}
