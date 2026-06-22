import { useMemo } from "react";
import { syklusUkeFraDato, ukedag1til7FraDato } from "@/lib/imported/ringnesCycle";
import {
  fullNavn,
  type Ansatt,
  type Bil,
  type BilUtilgjengelig,
  type DagEndring,
  type Fravær,
  type Henger,
  type HengerUtilgjengelig,
  type MasterRuteplan,
  type MasterRuteSlot,
  type PlanRuteTildeling,
  type Skift,
  type SkiftTilgjengelighet,
  type ReserveTilgjengelighet,
} from "@/lib/domain";
import {
  erBilIUtilgjengeligPeriodePåDato,
  erBilUtilgjengeligPåDato,
  erHengerIUtilgjengeligPeriodePåDato,
  erHengerUtilgjengeligPåDato,
  overlapperUtilgjengeligPeriodeDisponibilitet,
} from "@/lib/kjoretoyTilgjengelighet";
import {
  byggDagsFraværOversikt,
  dagsFraværOversiktTotalt,
} from "@/lib/plan/dagsFraværOversikt";
import { mergeAvspaseringForPlanDag } from "@/lib/plan/avspasering";
import {
  effektivRessursForSlot as effektivRessursForSlotPure,
  masterplanBilIdForSlot as masterplanBilIdForSlotPure,
  masterplanHengerIdForSlot as masterplanHengerIdForSlotPure,
  sjåførDragAnsattId,
  type EffektivRessurs,
} from "@/lib/plan/effektivRessurs";
import {
  byggKoblingsgruppeKontekst,
  finnKoblingForRute as finnKoblingForRutePure,
  kobleteMedRute as kobleteMedRutePure,
  koblingErOpphevetForDag,
  koblingLagringsNøkkel,
  tildelingKjoretoyForRute as tildelingKjoretoyForRutePure,
} from "@/lib/plan/koblingsgrupper";
import {
  motsattSkift,
  sjåførMotpartsskiftGrunn,
  sjåførerJobberPåSkift,
} from "@/lib/plan/sjåførTilgjengelighet";
import { byggSkiftOverstyringMap } from "@/lib/plan/skiftTilgjengelighet";
import { byggReserveMap } from "@/lib/plan/reserveTilgjengelighet";
import { sorterMasterSlots, sorterRutekoder } from "@/lib/utils/sort";
import { slotMatcherModulSøk } from "@/lib/utils/søkMatch";
import { ansattErTilgjengeligITurnus, turnusUtilgjengeligGrunn } from "@/lib/utils/turnusUtils";
import { type PlanSkift, overlapperDato, parseISODateInput } from "./planPageUtils";

export type { PlanSkift, EffektivRessurs };

const KVELD_SKIFT_START = "15:00";

export type UsePlanLogikkParams = {
  dato: string;
  skift: PlanSkift;
  modulSøk: string;
  sjåførSøk: string;
  ansatte: Ansatt[];
  fravær: Fravær[];
  biler: Bil[];
  hengere: Henger[];
  bilUtilgjengelig: BilUtilgjengelig[];
  hengerUtilgjengelig: HengerUtilgjengelig[];
  tildelinger: PlanRuteTildeling[];
  masterplan: MasterRuteplan;
  dagEndringer: DagEndring[];
  skiftTilgjengelighet: SkiftTilgjengelighet[];
  reserveTilgjengelighet: ReserveTilgjengelighet[];
};

export function usePlanLogikk({
  dato,
  skift,
  modulSøk,
  sjåførSøk,
  ansatte,
  fravær,
  biler,
  hengere,
  bilUtilgjengelig,
  hengerUtilgjengelig,
  tildelinger,
  masterplan,
  dagEndringer,
  skiftTilgjengelighet,
  reserveTilgjengelighet,
}: UsePlanLogikkParams) {
  const uke = useMemo(() => syklusUkeFraDato(parseISODateInput(dato)), [dato]);

  const dayNo = useMemo(() => ukedag1til7FraDato(parseISODateInput(dato)), [dato]);

  const skiftOverstyringMap = useMemo(
    () => byggSkiftOverstyringMap(skiftTilgjengelighet, dato),
    [skiftTilgjengelighet, dato],
  );

  const reserveMap = useMemo(
    () => byggReserveMap(reserveTilgjengelighet, dato, skift),
    [reserveTilgjengelighet, dato, skift],
  );

  const masterSlotsForDag = useMemo(
    () =>
      masterplan.slots.filter(
        (s) => s.uke === uke && s.dag === dayNo && s.skift === skift,
      ),
    [masterplan.slots, uke, dayNo, skift],
  );

  const dagEndringerForDag = useMemo(
    () => dagEndringer.filter((e) => e.dato === dato && e.skift === skift),
    [dagEndringer, dato, skift],
  );

  const effektiveRuter = useMemo(() => {
    const fjernede = new Set(
      dagEndringerForDag.filter((e) => e.type === "fjernet").map((e) => e.rutekode),
    );
    const fra_master: MasterRuteSlot[] = masterSlotsForDag.filter(
      (s) => !fjernede.has(s.rutekode),
    );
    const lagtTil: MasterRuteSlot[] = dagEndringerForDag
      .filter((e) => e.type === "lagt_til")
      .map((e) => ({
        id: `dag-${e.id}`,
        uke,
        dag: dayNo as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        skift: skift as Skift,
        rutekode: e.rutekode,
        rutenavn: e.rutenavn,
      }));
    return sorterMasterSlots([...fra_master, ...lagtTil]);
  }, [masterSlotsForDag, dagEndringerForDag, uke, dayNo, skift]);

  const koblingsKontekst = useMemo(
    () =>
      byggKoblingsgruppeKontekst({
        koblingsgrupper: masterplan.koblingsgrupper,
        ruter: effektiveRuter,
        dagEndringer,
        dato,
        skift: skift as Skift,
        dag: dayNo,
      }),
    [masterplan.koblingsgrupper, effektiveRuter, dagEndringer, dato, skift, dayNo],
  );

  const tildelingMap = useMemo(() => {
    const m = new Map<string, PlanRuteTildeling>();
    for (const t of tildelinger) {
      if (t.uke === uke && t.dag === dayNo && t.skift === skift) {
        m.set(t.rute, t);
      }
    }
    return m;
  }, [tildelinger, uke, dayNo, skift]);

  const ansattById = useMemo(() => {
    const m = new Map<string, Ansatt>();
    for (const a of ansatte) m.set(a.id, a);
    return m;
  }, [ansatte]);

  const ansattNavnById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of ansatte) m.set(a.id, fullNavn(a));
    return m;
  }, [ansatte]);

  const bilerValgbarePre = useMemo(
    () =>
      [...biler].sort((a, b) =>
        a.kjennemerke.localeCompare(b.kjennemerke, "nb", { numeric: true }),
      ),
    [biler],
  );

  const hengereValgbarePre = useMemo(
    () =>
      [...hengere].sort((a, b) =>
        a.kjennemerke.localeCompare(b.kjennemerke, "nb", { numeric: true }),
      ),
    [hengere],
  );

  const bilById = useMemo(() => new Map(biler.map((b) => [b.id, b] as const)), [biler]);
  const hengerById = useMemo(() => new Map(hengere.map((h) => [h.id, h] as const)), [hengere]);

  const bilPosterPåDato = useMemo(
    () => bilUtilgjengelig.filter((p) => overlapperUtilgjengeligPeriodeDisponibilitet(dato, p)),
    [bilUtilgjengelig, dato],
  );

  const hengerPosterPåDato = useMemo(
    () => hengerUtilgjengelig.filter((p) => overlapperUtilgjengeligPeriodeDisponibilitet(dato, p)),
    [hengerUtilgjengelig, dato],
  );

  const blokkerteAvFlerdagsruter = useMemo(() => {
    const blokkerteAnsatte = new Set<string>();
    const blokkerteBiler = new Set<string>();
    const blokkerteHengere = new Set<string>();

    const datoObj = parseISODateInput(dato);

    for (let offset = 1; offset <= 2; offset++) {
      const prevDate = new Date(datoObj);
      prevDate.setDate(prevDate.getDate() - offset);
      const prevDayNo = ukedag1til7FraDato(prevDate);
      const prevUke = syklusUkeFraDato(prevDate);

      const slotsForPrev = masterplan.slots.filter(
        (s) => s.uke === prevUke && s.dag === prevDayNo && s.varighet && s.varighet > offset,
      );

      for (const slot of slotsForPrev) {
        const erReturdagen = slot.varighet === offset + 1;
        const rutenFerdigFørKveld = erReturdagen && slot.sluttTid && slot.sluttTid <= KVELD_SKIFT_START;

        const prevTil = tildelinger.find(
          (t) =>
            t.uke === prevUke &&
            t.dag === prevDayNo &&
            t.skift === slot.skift &&
            t.rute === slot.rutekode,
        );

        const ansattId = prevTil?.ansattId ?? slot.standardSjåførAnsattId;
        const bilId = prevTil?.bilId ?? slot.standardBilId;
        const hengerId = prevTil?.hengerId ?? slot.standardHengerId;

        if (skift === "Kveld" && rutenFerdigFørKveld) {
          if (ansattId) blokkerteAnsatte.add(ansattId);
        } else {
          if (ansattId) blokkerteAnsatte.add(ansattId);
          if (bilId) blokkerteBiler.add(bilId);
          if (hengerId) blokkerteHengere.add(hengerId);
        }
      }
    }

    return { blokkerteAnsatte, blokkerteBiler, blokkerteHengere };
  }, [masterplan.slots, tildelinger, dato, skift]);

  const planlagteKjøretøy = useMemo(() => {
    const bilTilRute = new Map<string, string>();
    const hengerTilRute = new Map<string, string>();
    for (const slot of effektiveRuter) {
      const til = tildelingMap.get(slot.rutekode);
      if (til?.bilId) bilTilRute.set(til.bilId, slot.rutekode);
      if (til?.hengerId) hengerTilRute.set(til.hengerId, slot.rutekode);
    }
    return { bilTilRute, hengerTilRute };
  }, [effektiveRuter, tildelingMap]);

  const effektivRessursArgs = useMemo(
    () => ({
      dato,
      ansattById,
      fravær,
      skiftOverstyringMap,
      bilUtilgjengelig,
      hengerUtilgjengelig,
      tildelingMap,
      effektiveRuter,
      koblingsKontekst,
    }),
    [
      dato,
      ansattById,
      fravær,
      skiftOverstyringMap,
      bilUtilgjengelig,
      hengerUtilgjengelig,
      tildelingMap,
      effektiveRuter,
      koblingsKontekst,
    ],
  );

  const helpers = useMemo(() => {
    function erKoblingOpphevetForDag(gruppeKey: string, rutekoder: string[]): boolean {
      return koblingErOpphevetForDag(koblingsKontekst, gruppeKey, rutekoder);
    }

    function finnKoblingForRute(
      rutekode: string,
    ): { gruppeKey: string; rutekoder: string[] } | null {
      return finnKoblingForRutePure(rutekode, koblingsKontekst);
    }

    function kobleteMedRute(rutekode: string): string[] {
      return kobleteMedRutePure(rutekode, koblingsKontekst);
    }

    function tildelingKjoretoyForRute(rute: string): PlanRuteTildeling | undefined {
      return tildelingKjoretoyForRutePure(rute, tildelingMap, koblingsKontekst);
    }

    function ansattHarFraværPåDato(ansattId: string): boolean {
      return fravær.some((f) => f.ansattId === ansattId && overlapperDato(f, dato));
    }

    function effektivRessursForSlot(
      slot: MasterRuteSlot,
      til: PlanRuteTildeling | undefined,
    ): EffektivRessurs {
      return effektivRessursForSlotPure(slot, til, effektivRessursArgs);
    }

    function masterplanBilIdForSlot(slot: MasterRuteSlot): string | undefined {
      return masterplanBilIdForSlotPure(slot, koblingsKontekst, effektiveRuter);
    }

    function masterplanHengerIdForSlot(slot: MasterRuteSlot): string | undefined {
      return masterplanHengerIdForSlotPure(slot, koblingsKontekst, effektiveRuter);
    }

    function kobleteRuterSet(rute: string): Set<string> {
      return new Set([rute, ...kobleteMedRute(rute)]);
    }

    function bilValgbareForRute(rute: string): Bil[] {
      const koblet = kobleteRuterSet(rute);
      return bilerValgbarePre.filter((b) => {
        if (!b.aktiv) return false;
        if (erBilUtilgjengeligPåDato(b.id, dato, bilUtilgjengelig)) return false;
        if (blokkerteAvFlerdagsruter.blokkerteBiler.has(b.id)) return false;
        const bruktPå = planlagteKjøretøy.bilTilRute.get(b.id);
        if (bruktPå && !koblet.has(bruktPå)) return false;
        return true;
      });
    }

    function hengerValgbareForRute(rute: string): Henger[] {
      const koblet = kobleteRuterSet(rute);
      return hengereValgbarePre.filter((h) => {
        if (!h.aktiv) return false;
        if (erHengerUtilgjengeligPåDato(h.id, dato, hengerUtilgjengelig)) return false;
        if (blokkerteAvFlerdagsruter.blokkerteHengere.has(h.id)) return false;
        const bruktPå = planlagteKjøretøy.hengerTilRute.get(h.id);
        if (bruktPå && !koblet.has(bruktPå)) return false;
        return true;
      });
    }

    function bilUtilgjengeligGrunn(bilId: string): string | undefined {
      const poster = bilPosterPåDato.filter((p) => p.bilId === bilId);
      if (poster.length === 0) return undefined;
      return poster.map((p) => p.type).join(", ");
    }

    function hengerUtilgjengeligGrunn(hengerId: string): string | undefined {
      const poster = hengerPosterPåDato.filter((p) => p.hengerId === hengerId);
      if (poster.length === 0) return undefined;
      return poster.map((p) => p.type).join(", ");
    }

    function bilIkkeValgbarEtikett(bilId: string): string {
      const grunn = bilUtilgjengeligGrunn(bilId);
      if (grunn) return grunn;
      if (planlagteKjøretøy.bilTilRute.has(bilId)) return "Planlagt";
      if (blokkerteAvFlerdagsruter.blokkerteBiler.has(bilId)) return "Flerdagstur";
      return "Utilgjengelig";
    }

    function hengerIkkeValgbarEtikett(hengerId: string): string {
      const grunn = hengerUtilgjengeligGrunn(hengerId);
      if (grunn) return grunn;
      if (planlagteKjøretøy.hengerTilRute.has(hengerId)) return "Planlagt";
      if (blokkerteAvFlerdagsruter.blokkerteHengere.has(hengerId)) return "Flerdagstur";
      return "Utilgjengelig";
    }

    function bilErLedigForRute(bilId: string, rute: string): boolean {
      return bilValgbareForRute(rute).some((b) => b.id === bilId);
    }

    function hengerErLedigForRute(hengerId: string, rute: string): boolean {
      return hengerValgbareForRute(rute).some((h) => h.id === hengerId);
    }

    function bilSelectVerdi(
      til: PlanRuteTildeling | undefined,
      res: { bilId?: string; bilFraMaster: boolean },
    ): string {
      if (til?.bilId) return til.bilId;
      if (til?.skjulBaselineBil) return "__ingen__";
      if (res.bilId && res.bilFraMaster) return "__baseline__";
      if (res.bilId) return res.bilId;
      return "__ingen__";
    }

    function hengerSelectVerdi(
      til: PlanRuteTildeling | undefined,
      res: { hengerId?: string; hengerFraMaster: boolean },
    ): string {
      if (til?.hengerId) return til.hengerId;
      if (til?.skjulBaselineHenger) return "__ingen__";
      if (res.hengerId && res.hengerFraMaster) return "__baseline__";
      if (res.hengerId) return res.hengerId;
      return "__ingen__";
    }

    function planHarBilTildelt(
      tilKj: PlanRuteTildeling | undefined,
      slot: MasterRuteSlot,
      res: { bilId?: string; bilFraMaster: boolean },
    ): boolean {
      const sel = bilSelectVerdi(tilKj, res);
      if (sel === "__ingen__") return false;
      if (sel === "__baseline__") return Boolean(masterplanBilIdForSlot(slot));
      return true;
    }

    function planHarHengerTildelt(
      tilKj: PlanRuteTildeling | undefined,
      slot: MasterRuteSlot,
      res: { hengerId?: string; hengerFraMaster: boolean },
    ): boolean {
      const sel = hengerSelectVerdi(tilKj, res);
      if (sel === "__ingen__") return false;
      if (sel === "__baseline__") return Boolean(masterplanHengerIdForSlot(slot));
      return true;
    }

    function sjåførVisningNavn(
      selectVal: string,
      res: EffektivRessurs,
      masterSjåførNavn?: string,
    ): string {
      if (selectVal === "__ingen__") return "—";
      if (selectVal === "__baseline__") {
        return masterSjåførNavn ?? "—";
      }
      if (res.sjåfør) return fullNavn(res.sjåfør);
      const a = ansattById.get(selectVal);
      return a ? fullNavn(a) : "—";
    }

    function masterSjåførFraværInfo(
      slot: MasterRuteSlot,
      til: PlanRuteTildeling | undefined,
    ): { påFravær: false } | { påFravær: true; grunn: string } {
      const id = slot.standardSjåførAnsattId;
      if (!id || til?.ansattId || til?.skjulBaselineSjåfør) return { påFravær: false };
      if (!ansattHarFraværPåDato(id)) return { påFravær: false };
      const f = fravær.find((x) => x.ansattId === id && overlapperDato(x, dato));
      return { påFravær: true, grunn: f?.type ?? "Fravær" };
    }

    function sjåførSelectVerdi(
      til: PlanRuteTildeling | undefined,
      slot: MasterRuteSlot,
    ): string {
      if (til?.ansattId) return til.ansattId;
      if (til?.skjulBaselineSjåfør) return "__ingen__";
      if (slot.standardSjåførAnsattId) return "__baseline__";
      return "__ingen__";
    }

    function sjåførDragAnsattIdForRute(
      selectVal: string,
      slot: MasterRuteSlot,
    ): string | undefined {
      return sjåførDragAnsattId(selectVal, slot, ansattById);
    }

    return {
      erKoblingOpphevetForDag,
      finnKoblingForRute,
      koblingLagringsNøkkel,
      kobleteMedRute,
      tildelingKjoretoyForRute,
      ansattHarFraværPåDato,
      effektivRessursForSlot,
      masterplanBilIdForSlot,
      masterplanHengerIdForSlot,
      kobleteRuterSet,
      bilValgbareForRute,
      hengerValgbareForRute,
      bilUtilgjengeligGrunn,
      hengerUtilgjengeligGrunn,
      bilIkkeValgbarEtikett,
      hengerIkkeValgbarEtikett,
      bilErLedigForRute,
      hengerErLedigForRute,
      bilSelectVerdi,
      hengerSelectVerdi,
      planHarBilTildelt,
      planHarHengerTildelt,
      sjåførVisningNavn,
      masterSjåførFraværInfo,
      sjåførSelectVerdi,
      sjåførDragAnsattIdForRute,
    };
  }, [
    koblingsKontekst,
    effektivRessursArgs,
    effektiveRuter,
    tildelingMap,
    ansattById,
    fravær,
    dato,
    bilUtilgjengelig,
    hengerUtilgjengelig,
    bilerValgbarePre,
    hengereValgbarePre,
    blokkerteAvFlerdagsruter,
    planlagteKjøretøy,
    bilPosterPåDato,
    hengerPosterPåDato,
  ]);

  const synligeRuter = useMemo(() => {
    const q = modulSøk.trim();
    if (!q) return effektiveRuter;
    const ctx = { ansattById, bilById, hengerById };
    return effektiveRuter.filter((slot) =>
      slotMatcherModulSøk(slot, q, {
        ...ctx,
        tildeling: tildelingMap.get(slot.rutekode),
      }),
    );
  }, [effektiveRuter, modulSøk, ansattById, bilById, hengerById, tildelingMap]);

  const avspasering = useMemo(
    () =>
      mergeAvspaseringForPlanDag({
        uke,
        dag: dayNo,
        dato,
        ansatte,
        fravær,
      }),
    [uke, dayNo, dato, ansatte, fravær],
  );

  const sjåførerPåMotsattSkift = useMemo(
    () =>
      sjåførerJobberPåSkift({
        uke,
        dag: dayNo,
        dato,
        skift: motsattSkift(skift),
        masterSlots: masterplan.slots,
        dagEndringer,
        tildelinger,
        erAktivSjåfør: (id) => ansattById.get(id)?.aktiv === true,
        harFravær: (id) => fravær.some((f) => f.ansattId === id && overlapperDato(f, dato)),
      }),
    [
      uke,
      dayNo,
      dato,
      skift,
      masterplan.slots,
      dagEndringer,
      tildelinger,
      ansattById,
      fravær,
    ],
  );

  const tilgjengeligeAnsatte = useMemo(() => {
    const { effektivRessursForSlot } = helpers;
    const blocked = new Set<string>();

    for (const slot of effektiveRuter) {
      const til = tildelingMap.get(slot.rutekode);
      const res = effektivRessursForSlot(slot, til);
      if (res.sjåfør) blocked.add(res.sjåfør.id);
    }

    for (const id of sjåførerPåMotsattSkift.keys()) {
      if (skiftOverstyringMap.get(id) === skift) continue;
      blocked.add(id);
    }
    for (const id of blokkerteAvFlerdagsruter.blokkerteAnsatte) blocked.add(id);
    for (const id of avspasering.ansattIds) blocked.add(id);

    return ansatte
      .filter((a) => {
        if (!a.aktiv) return false;
        if (a.selskap && a.selskap !== "Asko") return false;
        if (blocked.has(a.id)) return false;
        const overstyrtSkift = skiftOverstyringMap.get(a.id);
        if (overstyrtSkift && overstyrtSkift !== skift) return false;
        const harFravær = fravær.some(
          (f) => f.ansattId === a.id && overlapperDato(f, dato),
        );
        const bilBlokk =
          Boolean(a.fastBilId) &&
          erBilUtilgjengeligPåDato(a.fastBilId!, dato, bilUtilgjengelig);
        const hengBlokk =
          Boolean(a.fastHengerId) &&
          erHengerUtilgjengeligPåDato(a.fastHengerId!, dato, hengerUtilgjengelig);
        if (harFravær || bilBlokk || hengBlokk) return false;
        if (reserveMap.has(a.id)) return true;
        return ansattErTilgjengeligITurnus(a, dato, skift, overstyrtSkift);
      })
      .slice()
      .sort((a, b) => fullNavn(a).localeCompare(fullNavn(b), "nb"));
  }, [
    helpers,
    ansatte,
    bilUtilgjengelig,
    blokkerteAvFlerdagsruter,
    dato,
    effektiveRuter,
    fravær,
    hengerUtilgjengelig,
    sjåførerPåMotsattSkift,
    avspasering,
    tildelingMap,
    skiftOverstyringMap,
    skift,
    reserveMap,
  ]);

  const tilgjengeligeIdSet = useMemo(
    () => new Set(tilgjengeligeAnsatte.map((a) => a.id)),
    [tilgjengeligeAnsatte],
  );

  const utilgjengeligeGrunner = useMemo(() => {
    const { effektivRessursForSlot } = helpers;
    const map = new Map<string, string>();
    const tildeltPåRute = new Map<string, string>();
    for (const slot of effektiveRuter) {
      const til = tildelingMap.get(slot.rutekode);
      const res = effektivRessursForSlot(slot, til);
      if (res.sjåfør) tildeltPåRute.set(res.sjåfør.id, slot.rutekode);
    }

    for (const a of ansatte) {
      if (tilgjengeligeIdSet.has(a.id)) continue;
      if (a.selskap && a.selskap !== "Asko") continue;
      const grunner: string[] = [];
      if (!a.aktiv) grunner.push("Inaktiv");
      if (fravær.some((f) => f.ansattId === a.id && overlapperDato(f, dato))) {
        const ftype = fravær.find((f) => f.ansattId === a.id && overlapperDato(f, dato))?.type;
        grunner.push(ftype ?? "Fravær");
      }
      if (tildeltPåRute.has(a.id)) grunner.push(`På rute ${tildeltPåRute.get(a.id)}`);
      const motRute = sjåførerPåMotsattSkift.get(a.id);
      if (motRute) {
        grunner.push(sjåførMotpartsskiftGrunn(motsattSkift(skift), motRute));
      }
      if (blokkerteAvFlerdagsruter.blokkerteAnsatte.has(a.id)) grunner.push("Flerdagstur");
      if (avspasering.ansattIds.has(a.id) && !grunner.includes("Avspasering")) {
        grunner.push("Avspasering");
      }
      const turnusGrunn =
        reserveMap.has(a.id)
          ? null
          : turnusUtilgjengeligGrunn(a, dato, skift, skiftOverstyringMap.get(a.id));
      if (turnusGrunn) grunner.push(turnusGrunn);
      if (grunner.length > 0) map.set(a.id, grunner.join(", "));
    }
    return map;
  }, [
    helpers,
    ansatte,
    tilgjengeligeIdSet,
    effektiveRuter,
    tildelingMap,
    fravær,
    dato,
    skift,
    blokkerteAvFlerdagsruter,
    sjåførerPåMotsattSkift,
    avspasering,
    skiftOverstyringMap,
    reserveMap,
  ]);

  const filtrerteAnsatte = useMemo(() => {
    const q = sjåførSøk.trim().toLowerCase();
    if (!q) return { tilgjengelige: tilgjengeligeAnsatte, utilgjengelige: [] as (Ansatt & { grunn: string })[] };

    const tilgjengelige = tilgjengeligeAnsatte.filter((a) =>
      fullNavn(a).toLowerCase().includes(q),
    );

    const utilgjengelige = ansatte
      .filter((a) => {
        if (tilgjengeligeIdSet.has(a.id)) return false;
        if (a.selskap && a.selskap !== "Asko") return false;
        if (!utilgjengeligeGrunner.has(a.id)) return false;
        return fullNavn(a).toLowerCase().includes(q);
      })
      .map((a) => ({ ...a, grunn: utilgjengeligeGrunner.get(a.id)! }))
      .sort((a, b) => fullNavn(a).localeCompare(fullNavn(b), "nb"));

    return { tilgjengelige, utilgjengelige };
  }, [tilgjengeligeAnsatte, sjåførSøk, ansatte, tilgjengeligeIdSet, utilgjengeligeGrunner]);

  const fjernedeRuterForDag = useMemo(
    () => dagEndringerForDag.filter((e) => e.type === "fjernet"),
    [dagEndringerForDag],
  );

  const lagtTilRuterForDag = useMemo(
    () => new Set(dagEndringerForDag.filter((e) => e.type === "lagt_til").map((e) => e.rutekode)),
    [dagEndringerForDag],
  );

  const fraværPåDato = useMemo(
    () => fravær.filter((f) => overlapperDato(f, dato) && f.type !== "Avspasering"),
    [fravær, dato],
  );

  const dagsoversikt = useMemo(
    () =>
      byggDagsFraværOversikt({
        dato,
        uke,
        dag: dayNo,
        ansatte,
        fravær,
        bilUtilgjengelig,
        hengerUtilgjengelig,
        biler,
        hengere,
      }),
    [dato, uke, dayNo, ansatte, fravær, bilUtilgjengelig, hengerUtilgjengelig, biler, hengere],
  );

  const dagsoversiktTotalt = useMemo(
    () => dagsFraværOversiktTotalt(dagsoversikt),
    [dagsoversikt],
  );

  const sammendrag = useMemo(() => {
    const {
      effektivRessursForSlot,
      tildelingKjoretoyForRute,
      bilSelectVerdi,
      hengerSelectVerdi,
      masterplanBilIdForSlot,
      masterplanHengerIdForSlot,
      planHarBilTildelt,
      planHarHengerTildelt,
    } = helpers;

    let ok = 0;
    let rød = 0;
    let gul = 0;
    let blå = 0;
    for (const slot of effektiveRuter) {
      const til = tildelingMap.get(slot.rutekode);
      const res = effektivRessursForSlot(slot, til);
      const tilKj = tildelingKjoretoyForRute(slot.rutekode);
      const bilSel = bilSelectVerdi(tilKj, res);
      const hengSel = hengerSelectVerdi(tilKj, res);
      const mpBil = masterplanBilIdForSlot(slot);
      const mpHeng = masterplanHengerIdForSlot(slot);
      const masterBilV = Boolean(
        mpBil &&
          erBilIUtilgjengeligPeriodePåDato(mpBil, dato, bilUtilgjengelig) &&
          (bilSel === "__ingen__" || bilSel === "__baseline__" || bilSel === mpBil),
      );
      const masterHengV = Boolean(
        mpHeng &&
          erHengerIUtilgjengeligPeriodePåDato(mpHeng, dato, hengerUtilgjengelig) &&
          (hengSel === "__ingen__" || hengSel === "__baseline__" || hengSel === mpHeng),
      );
      const påAnnetSkift = Boolean(res.sjåførPåAnnetSkift);
      const manglerSj = !res.sjåfør && !påAnnetSkift;
      const manglerB = !planHarBilTildelt(tilKj, slot, res);
      const manglerH = !planHarHengerTildelt(tilKj, slot, res);
      const utilgj =
        res.bilUtilgjengelig ||
        res.hengerUtilgjengeligFlag ||
        res.sjåførHarFravær ||
        masterBilV ||
        masterHengV ||
        påAnnetSkift;

      if (!manglerSj && !manglerB && !manglerH && !utilgj) ok++;
      else if (manglerSj || manglerB) rød++;
      else if (utilgj) gul++;
      else blå++;
    }
    return { ok, rød, gul, blå };
  }, [helpers, effektiveRuter, tildelingMap, dato, bilUtilgjengelig, hengerUtilgjengelig]);

  return {
    uke,
    dayNo,
    skiftOverstyringMap,
    reserveMap,
    effektiveRuter,
    tildelingMap,
    ansattById,
    ansattNavnById,
    bilById,
    hengerById,
    synligeRuter,
    bilPosterPåDato,
    hengerPosterPåDato,
    blokkerteAvFlerdagsruter,
    planlagteKjøretøy,
    avspasering,
    sjåførerPåMotsattSkift,
    tilgjengeligeAnsatte,
    tilgjengeligeIdSet,
    utilgjengeligeGrunner,
    filtrerteAnsatte,
    fraværPåDato,
    dagsoversikt,
    dagsoversiktTotalt,
    sammendrag,
    fjernedeRuterForDag,
    lagtTilRuterForDag,
    ...helpers,
  };
}
