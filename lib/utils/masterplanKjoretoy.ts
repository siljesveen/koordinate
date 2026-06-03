import type { MasterRuteSlot } from "@/lib/domain";

export function slotMedSjåførOgKjoretoy(
  slot: MasterRuteSlot,
  ansattId: string | undefined,
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
    // Bil/henger settes eksplisitt per rute i masterplan — ikke fra ansatt.fastBilId/fastHengerId.
  };
}
