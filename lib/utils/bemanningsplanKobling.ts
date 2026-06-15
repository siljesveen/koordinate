import type { Ansatt } from "@/lib/domain";
import type { BemanningPlanData } from "@/lib/utils/parseBemanningsplanExcel";
import { matchAnsattIdForDriverNavn } from "@/lib/utils/fraværAnsattMatching";

export type PlanKoblingStatus = {
  planNavn: string;
  ansattId: string | null;
  ansattNavn: string | null;
  viaBinding: boolean;
  fraværDager: number;
};

export type PlanKoblingSynkResult = {
  koblinger: PlanKoblingStatus[];
  koblet: PlanKoblingStatus[];
  utenTreff: PlanKoblingStatus[];
  ansatteUtenPlanRad: Array<{ id: string; navn: string; planExcelNavn?: string }>;
  oppdaterteBindinger: number;
};

/** Finn ansatt for plan-navn — eksplisitt planExcelNavn først, deretter navnematching. */
export function matchAnsattIdForPlanNavn(planNavn: string, ansatte: Ansatt[]): string | null {
  const eksplisitt = ansatte.filter((a) => a.planExcelNavn === planNavn);
  if (eksplisitt.length === 1) return eksplisitt[0].id;
  if (eksplisitt.length > 1) return null;
  return matchAnsattIdForDriverNavn(planNavn, ansatte);
}

export function analyserPlanKoblinger(
  plan: BemanningPlanData,
  ansatte: Ansatt[],
): Omit<PlanKoblingSynkResult, "oppdaterteBindinger"> {
  const koblinger: PlanKoblingStatus[] = [];
  const kobletPlanNavn = new Set<string>();

  for (const driver of Object.values(plan.drivers)) {
    const viaBinding = ansatte.some((a) => a.planExcelNavn === driver.name);
    const ansattId = matchAnsattIdForPlanNavn(driver.name, ansatte);
    const ansatt = ansattId ? ansatte.find((a) => a.id === ansattId) : undefined;

    const status: PlanKoblingStatus = {
      planNavn: driver.name,
      ansattId: ansattId ?? null,
      ansattNavn: ansatt ? `${ansatt.fornavn} ${ansatt.etternavn}`.trim() : null,
      viaBinding,
      fraværDager: Object.keys(driver.absence ?? {}).length,
    };
    koblinger.push(status);
    if (ansattId) kobletPlanNavn.add(driver.name);
  }

  const koblet = koblinger.filter((k) => k.ansattId);
  const utenTreff = koblinger.filter((k) => !k.ansattId);

  const ansatteUtenPlanRad = ansatte
    .filter((a) => a.aktiv !== false)
    .filter((a) => !a.planExcelNavn || !plan.drivers[a.planExcelNavn])
    .filter((a) => {
      const harRad = koblet.some((k) => k.ansattId === a.id);
      return !harRad;
    })
    .map((a) => ({
      id: a.id,
      navn: `${a.fornavn} ${a.etternavn}`.trim(),
      planExcelNavn: a.planExcelNavn,
    }));

  return {
    koblinger,
    koblet,
    utenTreff,
    ansatteUtenPlanRad,
  };
}

/** Alle ansatt-IDer som har rad i planen og er koblet. */
export function kobledeAnsattIdsFraPlan(plan: BemanningPlanData, ansatte: Ansatt[]): string[] {
  const ids = new Set<string>();
  for (const driver of Object.values(plan.drivers)) {
    const ansattId = matchAnsattIdForPlanNavn(driver.name, ansatte);
    if (ansattId) ids.add(ansattId);
  }
  return [...ids];
}

/** Oppdater planExcelNavn på ansatte som matcher plan-rader. */
export function synkPlanBindinger(
  plan: BemanningPlanData,
  ansatte: Ansatt[],
): { ansatte: Ansatt[]; result: PlanKoblingSynkResult } {
  const analyse = analyserPlanKoblinger(plan, ansatte);
  let oppdaterteBindinger = 0;

  const ansatteMedBinding = ansatte.map((a) => {
    const kobling = analyse.koblet.find((k) => k.ansattId === a.id);
    if (!kobling || a.planExcelNavn === kobling.planNavn) return a;
    oppdaterteBindinger += 1;
    return { ...a, planExcelNavn: kobling.planNavn };
  });

  for (const rad of analyse.koblet) {
    if (!rad.ansattId) continue;
    const a = ansatteMedBinding.find((x) => x.id === rad.ansattId);
    if (a && !a.planExcelNavn) {
      const idx = ansatteMedBinding.findIndex((x) => x.id === rad.ansattId);
      ansatteMedBinding[idx] = { ...a, planExcelNavn: rad.planNavn };
      oppdaterteBindinger += 1;
    }
  }

  return {
    ansatte: ansatteMedBinding,
    result: { ...analyse, oppdaterteBindinger },
  };
}

export function settPlanBinding(
  ansatte: Ansatt[],
  ansattId: string,
  planExcelNavn: string | undefined,
): Ansatt[] {
  return ansatte.map((a) => {
    if (a.id !== ansattId) {
      if (planExcelNavn && a.planExcelNavn === planExcelNavn) {
        return { ...a, planExcelNavn: undefined };
      }
      return a;
    }
    return { ...a, planExcelNavn: planExcelNavn || undefined };
  });
}
