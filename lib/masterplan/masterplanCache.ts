import type { Koblingsgruppe, MasterRuteplan, MasterRuteSlot, Skift } from "@/lib/domain";

const STORAGE_KEY = "bemanning.masterplan.v1";

export function masterSlotId(
  uke: number,
  dag: number,
  skift: Skift,
  rutekode: string,
): string {
  return `ms-${uke}-${dag}-${skift}-${encodeURIComponent(rutekode)}`;
}

const BAMA_RUTER: { rutekode: string; rutenavn: string }[] = [
  { rutekode: "1520", rutenavn: "Bama shh Hamar" },
  { rutekode: "1550", rutenavn: "Bama shh Gjøvik" },
  { rutekode: "1560", rutenavn: "Bama shh Lillehammer" },
];

function deduplicateSlots(plan: MasterRuteplan): MasterRuteplan {
  const seen = new Map<string, MasterRuteSlot>();
  for (const slot of plan.slots) {
    const key = masterSlotId(slot.uke, slot.dag, slot.skift, slot.rutekode);
    if (!seen.has(key)) seen.set(key, slot);
  }
  if (seen.size === plan.slots.length) return plan;
  return { ...plan, slots: [...seen.values()] };
}

function ensureBamaAlleDager(plan: MasterRuteplan): MasterRuteplan {
  const eksisterende = new Set<string>();
  for (const s of plan.slots) {
    if (s.skift === "Dag") {
      eksisterende.add(`${s.uke}|${s.dag}|${s.rutekode}`);
    }
  }

  const nyeSlots = [...plan.slots];
  let endret = false;

  for (let uke = 1; uke <= 4; uke++) {
    for (let dag = 1; dag <= 6; dag++) {
      for (const bama of BAMA_RUTER) {
        const key = `${uke}|${dag}|${bama.rutekode}`;
        if (eksisterende.has(key)) continue;
        endret = true;
        eksisterende.add(key);
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

  return endret ? { ...plan, slots: nyeSlots } : plan;
}

export function normalizeLoaded(data: unknown): MasterRuteplan | null {
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
        koblingsgrupper[key] = { rutekoder: val.filter((x) => typeof x === "string") };
      } else if (val && typeof val === "object") {
        const v = val as Record<string, unknown>;
        const rutekoder = Array.isArray(v.rutekoder)
          ? v.rutekoder.filter((x: unknown) => typeof x === "string")
          : [];
        const skift = v.skift === "Dag" || v.skift === "Kveld" ? v.skift : undefined;
        const dag =
          typeof v.dag === "number" && v.dag >= 1 && v.dag <= 7
            ? (v.dag as 1 | 2 | 3 | 4 | 5 | 6 | 7)
            : undefined;
        if (rutekoder.length >= 2) koblingsgrupper[key] = { rutekoder, dag, skift };
      }
    }
    if (Object.keys(koblingsgrupper).length === 0) koblingsgrupper = undefined;
  }
  return {
    syklusLengde,
    slots,
    koblingsgrupper,
    referanseDato:
      typeof obj.referanseDato === "string" ? obj.referanseDato : "2026-06-16",
    aktivUkeVedReferanse:
      obj.aktivUkeVedReferanse === 1 ||
      obj.aktivUkeVedReferanse === 2 ||
      obj.aktivUkeVedReferanse === 3 ||
      obj.aktivUkeVedReferanse === 4
        ? obj.aktivUkeVedReferanse
        : 2,
  };
}

export function processMasterplanRaw(data: unknown): MasterRuteplan | null {
  const loaded = normalizeLoaded(data);
  if (!loaded) return null;
  return ensureBamaAlleDager(deduplicateSlots(loaded));
}

export function readMasterplanCacheRaw(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function readMasterplanFromLocalCache(): MasterRuteplan | null {
  const raw = readMasterplanCacheRaw();
  if (!raw) return null;
  try {
    return processMasterplanRaw(JSON.parse(raw));
  } catch {
    return null;
  }
}

export const MASTERPLAN_STORAGE_KEY = STORAGE_KEY;
