import type { Ansatt, MasterRuteplan, MasterRuteSlot, Skift } from "@/lib/domain";
import { slotMedSjåførOgKjoretoy } from "@/lib/utils/masterplanKjoretoy";
import { RINGNES_CYCLE } from "@/lib/imported/ringnesCycle";
import patchJson from "./uke1-masterplan-patch.json";

function masterSlotId(
  uke: number,
  dag: number,
  skift: Skift,
  rutekode: string,
): string {
  return `ms-${uke}-${dag}-${skift}-${encodeURIComponent(rutekode)}`;
}

export type Uke1SlotPatch = {
  dag: number;
  skift: Skift;
  rutekode: string;
  startTid?: string;
  standardSjåførAnsattId?: string;
  standardBilId?: string;
  standardHengerId?: string;
  clearSjåfør?: boolean;
};

export const UKE1_MASTERPLAN_PATCH = patchJson as {
  uke: 1;
  slotUpdates: Uke1SlotPatch[];
  meta?: Record<string, unknown>;
};

function baselineMasterplan(): MasterRuteplan {
  const slotMap = new Map<string, MasterRuteSlot>();
  for (const [ukeStr, dager] of Object.entries(RINGNES_CYCLE.cycle)) {
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
          slotMap.set(id, {
            id,
            uke: uke as 1 | 2 | 3 | 4,
            dag: dag as 1 | 2 | 3 | 4 | 5 | 6 | 7,
            skift,
            rutekode,
            rutenavn: rute.rutenavn?.trim() || undefined,
          });
        }
      }
    }
  }
  return { syklusLengde: 4, slots: [...slotMap.values()] };
}

export function normalizeMasterplan(data: unknown): MasterRuteplan | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.slots)) return null;
  const slots = obj.slots.filter(Boolean) as MasterRuteSlot[];
  if (slots.length === 0) return null;
  return {
    syklusLengde: typeof obj.syklusLengde === "number" ? obj.syklusLengde : 4,
    slots,
    koblingsgrupper:
      obj.koblingsgrupper && typeof obj.koblingsgrupper === "object"
        ? (obj.koblingsgrupper as MasterRuteplan["koblingsgrupper"])
        : undefined,
  };
}

export function mergeUke1MasterplanPatch(
  plan: MasterRuteplan,
  ansattById?: Map<string, Ansatt>,
): {
  plan: MasterRuteplan;
  updated: number;
} {
  const updateMap = new Map(
    UKE1_MASTERPLAN_PATCH.slotUpdates.map((u) => [
      `${u.dag}|${u.skift}|${u.rutekode}`,
      u,
    ]),
  );
  let updated = 0;
  const slots = plan.slots.map((slot) => {
    if (slot.uke !== 1) return slot;
    const key = `${slot.dag}|${slot.skift}|${slot.rutekode}`;
    const upd = updateMap.get(key);
    if (!upd) return slot;
    updated++;
    if (upd.clearSjåfør) {
      return {
        ...slot,
        startTid: upd.startTid ?? slot.startTid,
        standardSjåførAnsattId: undefined,
        standardBilId: undefined,
        standardHengerId: undefined,
      };
    }
    const medSjåfør: MasterRuteSlot = {
      ...slot,
      startTid: upd.startTid ?? slot.startTid,
      standardSjåførAnsattId: upd.standardSjåførAnsattId,
    };
    if (!ansattById || !upd.standardSjåførAnsattId) {
      return {
        ...medSjåfør,
        standardBilId: upd.standardBilId,
        standardHengerId: upd.standardHengerId,
      };
    }
    return slotMedSjåførOgKjoretoy(medSjåfør, upd.standardSjåførAnsattId, ansattById);
  });
  return { plan: { ...plan, slots }, updated };
}

export function applyUke1ToMasterplan(
  existing: unknown,
  ansattById?: Map<string, Ansatt>,
): {
  plan: MasterRuteplan;
  updated: number;
} {
  const base = normalizeMasterplan(existing) ?? baselineMasterplan();
  return mergeUke1MasterplanPatch(base, ansattById);
}
