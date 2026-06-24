import type { Ansatt, MasterRuteplan, MasterRuteSlot } from "@/lib/domain";

type AnsattKjoretoy = Pick<Ansatt, "fastBilId" | "fastHengerId">;

export function slotMedSjåførOgKjoretoy(
  slot: MasterRuteSlot,
  ansattId: string | undefined,
  ansatt?: AnsattKjoretoy | null,
): MasterRuteSlot {
  if (!ansattId) {
    return {
      ...slot,
      standardSjåførAnsattId: undefined,
      standardBilId: undefined,
      standardHengerId: undefined,
    };
  }
  return {
    ...slot,
    standardSjåførAnsattId: ansattId,
    standardBilId: ansatt?.fastBilId,
    standardHengerId: ansatt?.fastHengerId,
  };
}

/** Fyll inn manglende fast bil/henger fra ansatt for eksisterende masterplan-rader. */
export function backfillMasterplanKjoretoyFraAnsatte(
  plan: MasterRuteplan,
  ansattById: Map<string, Ansatt>,
): { plan: MasterRuteplan; updated: number } {
  let updated = 0;
  const slots = plan.slots.map((slot) => {
    const sjåførId = slot.standardSjåførAnsattId;
    if (!sjåførId) return slot;

    const ansatt = ansattById.get(sjåførId);
    if (!ansatt) return slot;

    const bilId = slot.standardBilId ?? ansatt.fastBilId;
    const hengerId = slot.standardHengerId ?? ansatt.fastHengerId;

    if (bilId === slot.standardBilId && hengerId === slot.standardHengerId) {
      return slot;
    }

    updated++;
    return {
      ...slot,
      standardBilId: bilId,
      standardHengerId: hengerId,
    };
  });

  if (updated === 0) return { plan, updated: 0 };
  return { plan: { ...plan, slots }, updated };
}
