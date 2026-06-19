import type {
  Ansatt,
  BilUtilgjengelig,
  Fravær,
  HengerUtilgjengelig,
  MasterRuteSlot,
  PlanRuteTildeling,
  Skift,
} from "@/lib/domain";
import {
  erBilUtilgjengeligPåDato,
  erHengerUtilgjengeligPåDato,
} from "@/lib/kjoretoyTilgjengelighet";
import { overlapperFraværDato } from "@/lib/plan/fraværPlan";
import {
  type KoblingsgruppeKontekst,
  kobleteMedRute,
  tildelingKjoretoyForRute,
} from "@/lib/plan/koblingsgrupper";

export type EffektivRessurs = {
  sjåfør: Ansatt | undefined;
  sjåførFraMaster: boolean;
  sjåførHarFravær: boolean;
  sjåførPåAnnetSkift: Skift | undefined;
  bilId: string | undefined;
  bilFraMaster: boolean;
  bilUtilgjengelig: boolean;
  hengerId: string | undefined;
  hengerFraMaster: boolean;
  hengerUtilgjengeligFlag: boolean;
};

export type EffektivRessursArgs = {
  dato: string;
  ansattById: Map<string, Ansatt>;
  fravær: Fravær[];
  skiftOverstyringMap: Map<string, Skift>;
  bilUtilgjengelig: BilUtilgjengelig[];
  hengerUtilgjengelig: HengerUtilgjengelig[];
  tildelingMap: Map<string, PlanRuteTildeling>;
  effektiveRuter: MasterRuteSlot[];
  koblingsKontekst: KoblingsgruppeKontekst;
};

function ansattHarFraværPåDato(fravær: Fravær[], ansattId: string, dato: string): boolean {
  return fravær.some((f) => f.ansattId === ansattId && overlapperFraværDato(f, dato));
}

function slotsByRute(ruter: MasterRuteSlot[]): Map<string, MasterRuteSlot> {
  return new Map(ruter.map((s) => [s.rutekode, s]));
}

export function masterplanBilIdForSlot(
  slot: MasterRuteSlot,
  koblingsKontekst: KoblingsgruppeKontekst,
  effektiveRuter: MasterRuteSlot[],
): string | undefined {
  if (slot.standardBilId) return slot.standardBilId;
  const byRute = slotsByRute(effektiveRuter);
  for (const kr of kobleteMedRute(slot.rutekode, koblingsKontekst)) {
    const kSlot = byRute.get(kr);
    if (kSlot?.standardBilId) return kSlot.standardBilId;
  }
  return undefined;
}

export function masterplanHengerIdForSlot(
  slot: MasterRuteSlot,
  koblingsKontekst: KoblingsgruppeKontekst,
  effektiveRuter: MasterRuteSlot[],
): string | undefined {
  if (slot.standardHengerId) return slot.standardHengerId;
  const byRute = slotsByRute(effektiveRuter);
  for (const kr of kobleteMedRute(slot.rutekode, koblingsKontekst)) {
    const kSlot = byRute.get(kr);
    if (kSlot?.standardHengerId) return kSlot.standardHengerId;
  }
  return undefined;
}

export function effektivRessursForSlot(
  slot: MasterRuteSlot,
  til: PlanRuteTildeling | undefined,
  args: EffektivRessursArgs,
): EffektivRessurs {
  const {
    dato,
    ansattById,
    fravær,
    skiftOverstyringMap,
    bilUtilgjengelig,
    hengerUtilgjengelig,
    tildelingMap,
    effektiveRuter,
    koblingsKontekst,
  } = args;

  const kobletMed = (rute: string) => kobleteMedRute(rute, koblingsKontekst);
  const byRute = slotsByRute(effektiveRuter);

  let sjåfør: Ansatt | undefined;
  let sjåførFraMaster = false;
  let sjåførHarFravær = false;

  if (til?.ansattId) {
    sjåfør = ansattById.get(til.ansattId);
  } else if (til?.skjulBaselineSjåfør) {
    sjåfør = undefined;
  } else if (slot.standardSjåførAnsattId) {
    sjåfør = ansattById.get(slot.standardSjåførAnsattId);
    sjåførFraMaster = true;
  }

  if (sjåfør && !sjåfør.aktiv) {
    sjåfør = undefined;
  }

  if (sjåfør && ansattHarFraværPåDato(fravær, sjåfør.id, dato)) {
    sjåførHarFravær = true;
    if (sjåførFraMaster) {
      sjåfør = undefined;
    }
  }

  let sjåførPåAnnetSkift: Skift | undefined;
  if (sjåfør && sjåførFraMaster) {
    const overstyrtSkift = skiftOverstyringMap.get(sjåfør.id);
    if (overstyrtSkift && overstyrtSkift !== slot.skift) {
      sjåførPåAnnetSkift = overstyrtSkift;
      sjåfør = undefined;
    }
  }

  const tilKj = tildelingKjoretoyForRute(slot.rutekode, tildelingMap, koblingsKontekst);
  const planSjåførOverstyrt = Boolean(til?.ansattId);

  let bilId = tilKj?.bilId;
  let bilFraMaster = false;
  if (!(tilKj?.skjulBaselineBil && !tilKj?.bilId)) {
    if (!bilId && slot.standardBilId && !planSjåførOverstyrt) {
      bilId = slot.standardBilId;
      bilFraMaster = true;
    }
    if (!bilId) {
      for (const kr of kobletMed(slot.rutekode)) {
        const kTil = tildelingMap.get(kr);
        if (kTil?.bilId) {
          bilId = kTil.bilId;
          bilFraMaster = false;
          break;
        }
        if (kTil?.skjulBaselineBil) continue;
        const kSlot = byRute.get(kr);
        if (kSlot?.standardBilId) {
          bilId = kSlot.standardBilId;
          bilFraMaster = true;
          break;
        }
      }
    }
  } else {
    bilId = undefined;
  }
  const bilUtilgjengeligFlag =
    Boolean(bilId) && erBilUtilgjengeligPåDato(bilId!, dato, bilUtilgjengelig);

  let hengerId = tilKj?.hengerId;
  let hengerFraMaster = false;
  if (!(tilKj?.skjulBaselineHenger && !tilKj?.hengerId)) {
    if (!hengerId && slot.standardHengerId && !planSjåførOverstyrt) {
      hengerId = slot.standardHengerId;
      hengerFraMaster = true;
    }
    if (!hengerId) {
      for (const kr of kobletMed(slot.rutekode)) {
        const kTil = tildelingMap.get(kr);
        if (kTil?.hengerId) {
          hengerId = kTil.hengerId;
          hengerFraMaster = false;
          break;
        }
        if (kTil?.skjulBaselineHenger) continue;
        const kSlot = byRute.get(kr);
        if (kSlot?.standardHengerId) {
          hengerId = kSlot.standardHengerId;
          hengerFraMaster = true;
          break;
        }
      }
    }
  } else {
    hengerId = undefined;
  }
  const hengerUtilgjengeligFlag =
    Boolean(hengerId) && erHengerUtilgjengeligPåDato(hengerId!, dato, hengerUtilgjengelig);

  return {
    sjåfør,
    sjåførFraMaster,
    sjåførHarFravær,
    sjåførPåAnnetSkift,
    bilId,
    bilFraMaster,
    bilUtilgjengelig: bilUtilgjengeligFlag,
    hengerId,
    hengerFraMaster,
    hengerUtilgjengeligFlag,
  };
}
