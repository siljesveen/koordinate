import type { Ansatt, MasterRuteSlot } from "@/lib/domain";

export function slotMedSjåførOgKjoretoy(
  slot: MasterRuteSlot,
  ansattId: string | undefined,
  ansattById: Map<string, Ansatt>,
): MasterRuteSlot {
  if (!ansattId) {
    return {
      ...slot,
      standardSjåførAnsattId: undefined,
      standardBilId: undefined,
      standardHengerId: undefined,
    };
  }
  const ansatt = ansattById.get(ansattId);
  return {
    ...slot,
    standardSjåførAnsattId: ansattId,
    standardBilId: ansatt?.fastBilId,
    standardHengerId: ansatt?.fastHengerId,
  };
}
