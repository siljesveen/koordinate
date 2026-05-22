import type { MasterRuteSlot } from "@/lib/domain";
import type { TurnusSkiftType } from "@/lib/state/turnus4ukerStore";

export type MasterplanTurnusCelle = {
  ansattId: string;
  uke: number;
  dag: number;
};

export function turnusCelleNøkkel(ukeIndex: number, dagIndex: number): string {
  return `${ukeIndex}-${dagIndex}`;
}

/** Uke 1–4 og dag 1–7 (man–søn) fra masterplan → turnus-indekser 0-basert. */
export function masterplanTilTurnusIndekser(uke: number, dag: number) {
  return { ukeIndex: uke - 1, dagIndex: dag - 1 };
}

/**
 * Avled turnus-skift for én ansatt på én dag i syklusen ut fra masterplan-ruter.
 * Ingen ruter → Begge (tilgjengelig begge skift). Kun Dag/Kveld → matchende skift.
 */
export function turnusSkiftFraMasterplan(
  slots: MasterRuteSlot[],
  ansattId: string,
  uke: number,
  dag: number,
): TurnusSkiftType {
  let harDag = false;
  let harKveld = false;

  for (const s of slots) {
    if (s.standardSjåførAnsattId !== ansattId) continue;
    if (s.uke !== uke || s.dag !== dag) continue;
    if (s.skift === "Dag") harDag = true;
    if (s.skift === "Kveld") harKveld = true;
  }

  if (!harDag && !harKveld) return "Begge";
  if (harDag && harKveld) return "Begge";
  return harDag ? "Dag" : "Kveld";
}

/** Bygg full 4-ukers turnus: masterplan + manuelle fridager (Ingen). */
export function byggTurnusPlan(
  slots: MasterRuteSlot[],
  ansattId: string,
  friDager: ReadonlySet<string>,
): TurnusSkiftType[][] {
  return Array.from({ length: 4 }, (_, ukeIndex) =>
    Array.from({ length: 7 }, (_, dagIndex) => {
      if (friDager.has(turnusCelleNøkkel(ukeIndex, dagIndex))) return "Ingen";
      return turnusSkiftFraMasterplan(slots, ansattId, ukeIndex + 1, dagIndex + 1);
    }),
  );
}

/** Migrer gammel lagret plan[][] til friDager-sett. */
export function friDagerFraLegacyPlan(plan: TurnusSkiftType[][] | undefined): Set<string> {
  const fri = new Set<string>();
  if (!plan) return fri;
  for (let w = 0; w < 4; w++) {
    const row = plan[w];
    if (!Array.isArray(row)) continue;
    for (let d = 0; d < 7; d++) {
      if (row[d] === "Ingen") fri.add(turnusCelleNøkkel(w, d));
    }
  }
  return fri;
}
