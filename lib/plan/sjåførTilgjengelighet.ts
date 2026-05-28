import type { DagEndring, MasterRuteSlot, PlanRuteTildeling, Skift } from "@/lib/domain";

export type PlanSkift = "Dag" | "Kveld";

export function motsattSkift(skift: PlanSkift): PlanSkift {
  return skift === "Dag" ? "Kveld" : "Dag";
}

export function byggEffektiveRuter(args: {
  uke: number;
  dag: number;
  skift: Skift;
  dato: string;
  masterSlots: MasterRuteSlot[];
  dagEndringer: DagEndring[];
}): MasterRuteSlot[] {
  const { uke, dag, skift, dato, masterSlots, dagEndringer } = args;
  const dagEndringerForSkift = dagEndringer.filter(
    (e) => e.dato === dato && e.skift === skift,
  );
  const fjernede = new Set(
    dagEndringerForSkift.filter((e) => e.type === "fjernet").map((e) => e.rutekode),
  );
  const fraMaster = masterSlots.filter(
    (s) =>
      s.uke === uke &&
      s.dag === dag &&
      s.skift === skift &&
      !fjernede.has(s.rutekode),
  );
  const lagtTil: MasterRuteSlot[] = dagEndringerForSkift
    .filter((e) => e.type === "lagt_til")
    .map((e) => ({
      id: `dag-${e.id}`,
      uke: uke as MasterRuteSlot["uke"],
      dag: dag as MasterRuteSlot["dag"],
      skift,
      rutekode: e.rutekode,
      rutenavn: e.rutenavn,
    }));
  return [...fraMaster, ...lagtTil];
}

export function planTildelingMap(args: {
  uke: number;
  dag: number;
  skift: Skift;
  tildelinger: PlanRuteTildeling[];
}): Map<string, PlanRuteTildeling> {
  const m = new Map<string, PlanRuteTildeling>();
  for (const t of args.tildelinger) {
    if (t.uke === args.uke && t.dag === args.dag && t.skift === args.skift) {
      m.set(t.rute, t);
    }
  }
  return m;
}

/** Plan-overstyring eller masterplan-baseline — uten aktiv/fravær-sjekk. */
export function effektivSjåførIdForSlot(
  slot: MasterRuteSlot,
  til: PlanRuteTildeling | undefined,
): string | undefined {
  if (til?.ansattId) return til.ansattId;
  if (til?.skjulBaselineSjåfør) return undefined;
  return slot.standardSjåførAnsattId;
}

export type SjåførerJobberPåSkiftArgs = {
  uke: number;
  dag: number;
  dato: string;
  skift: PlanSkift;
  masterSlots: MasterRuteSlot[];
  dagEndringer: DagEndring[];
  tildelinger: PlanRuteTildeling[];
  erAktivSjåfør?: (ansattId: string) => boolean;
  harFravær?: (ansattId: string) => boolean;
};

/** Sjåfører som faktisk jobber på gitt skift (ansattId → første rute). */
export function sjåførerJobberPåSkift(
  args: SjåførerJobberPåSkiftArgs,
): Map<string, string> {
  const ruter = byggEffektiveRuter({
    uke: args.uke,
    dag: args.dag,
    skift: args.skift,
    dato: args.dato,
    masterSlots: args.masterSlots,
    dagEndringer: args.dagEndringer,
  });
  const tildelingMap = planTildelingMap({
    uke: args.uke,
    dag: args.dag,
    skift: args.skift,
    tildelinger: args.tildelinger,
  });

  const result = new Map<string, string>();
  for (const slot of ruter) {
    const sjåførId = effektivSjåførIdForSlot(slot, tildelingMap.get(slot.rutekode));
    if (!sjåførId) continue;
    if (args.erAktivSjåfør && !args.erAktivSjåfør(sjåførId)) continue;
    if (args.harFravær?.(sjåførId)) continue;
    if (!result.has(sjåførId)) result.set(sjåførId, slot.rutekode);
  }
  return result;
}

export function sjåførMotpartsskiftGrunn(skift: PlanSkift, rute: string): string {
  const etikett = skift === "Dag" ? "dag" : "kveld";
  return `Jobber ${etikett} (rute ${rute})`;
}

/** Masterplan: nøkkel `uke-dag-skift` → sjåfører satt på det skiftet den dagen. */
export function sjåførerPerSkiftDagCache(slots: MasterRuteSlot[]): Map<string, Set<string>> {
  const cache = new Map<string, Set<string>>();
  for (const s of slots) {
    if (!s.standardSjåførAnsattId) continue;
    const key = `${s.uke}-${s.dag}-${s.skift}`;
    const set = cache.get(key) ?? new Set<string>();
    set.add(s.standardSjåførAnsattId);
    cache.set(key, set);
  }
  return cache;
}

export function sjåførErBlokkertMotpartsskift(
  cache: Map<string, Set<string>>,
  slot: Pick<MasterRuteSlot, "uke" | "dag" | "skift" | "standardSjåførAnsattId">,
  ansattId: string,
): boolean {
  if (ansattId && ansattId === slot.standardSjåførAnsattId) return false;
  const mot = motsattSkift(slot.skift as PlanSkift);
  const key = `${slot.uke}-${slot.dag}-${mot}`;
  return cache.get(key)?.has(ansattId) ?? false;
}
