"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useModulSøkFraUrl } from "@/lib/hooks/useModulSøkFraUrl";
import { useAnsattStore } from "@/lib/state/ansattStore";
import {
  fullNavn,
  type BilUtilgjengelig,
  type Fravær,
  type HengerUtilgjengelig,
  type PlanRuteTildeling,
  type Skift,
} from "@/lib/domain";
import { useBilStore } from "@/lib/state/bilStore";
import { useBilUtilgjengeligStore } from "@/lib/state/bilUtilgjengeligStore";
import {
  dagEndringId,
  dagKoblingOpphevetId,
  useDagEndringStore,
} from "@/lib/state/dagEndringStore";
import { useFraværStore } from "@/lib/state/fravaerStore";
import { useHengerStore } from "@/lib/state/hengerStore";
import { useHengerUtilgjengeligStore } from "@/lib/state/hengerUtilgjengeligStore";
import { useMasterplanStore } from "@/lib/state/masterplanStore";
import {
  planRuteSlotId,
  usePlanRuteTildelingStore,
} from "@/lib/state/planRuteTildelingStore";
import {
  skiftTilgjengelighetId,
  useSkiftTilgjengelighetStore,
} from "@/lib/state/skiftTilgjengelighetStore";
import {
  reserveTilgjengelighetId,
  useReserveTilgjengelighetStore,
} from "@/lib/state/reserveTilgjengelighetStore";
import PlanSkiftMenu from "./PlanSkiftMenu";
import PlanReserveMenu from "./PlanReserveMenu";
import DagsFraværOversiktModal from "./DagsFraværOversiktModal";
import { type PlanSjåførVelg } from "./PlanSjåførVelger";
import { sorterRutekoder } from "@/lib/utils/sort";
import PlanRuteRad, { type PlanRuteRadLogikk } from "./PlanRuteRad";
import { useBekreftDialog } from "@/components/useBekreftDialog";
import { finnSjåførRuterPåDag } from "@/lib/plan/avspasering";
import { fraværForAnsattPåDato } from "@/lib/plan/fraværPlan";
import { isoDato, overlapperDato, parseISODateInput, type PlanSkift } from "./planPageUtils";
import { usePlanLogikk } from "./usePlanLogikk";
import { reserveTilgjengeligTekst } from "@/lib/plan/reserveTilgjengelighet";
import styles from "./page.module.css";

const DRAG_MIME = "application/x-bemanning-plan-ansatt";

type DragAnsattPayload = { ansattId: string; fraRute?: string };

export default function PlanPage() {
  const { requestBekreft, dialog: bekreftDialog } = useBekreftDialog();
  const [skift, setSkift] = useState<PlanSkift>("Dag");
  const [dato, setDato] = useState<string>(() => isoDato(new Date()));

  const { ansatte } = useAnsattStore();
  const { fravær, lagre: lagreFravær } = useFraværStore();
  const { biler } = useBilStore();
  const { hengere } = useHengerStore();
  const { poster: bilUtilgjengelig } = useBilUtilgjengeligStore();
  const { poster: hengerUtilgjengelig } = useHengerUtilgjengeligStore();
  const { tildelinger, lagre: lagreTildeling, lagreFlere } = usePlanRuteTildelingStore();
  const { masterplan } = useMasterplanStore();
  const { endringer: dagEndringer, lagre: lagreDagEndring, fjern: fjernDagEndring } = useDagEndringStore();
  const {
    poster: skiftTilgjengelighet,
    lagre: lagreSkiftTilgjengelighet,
    fjern: fjernSkiftTilgjengelighet,
  } = useSkiftTilgjengelighetStore();
  const {
    poster: reserveTilgjengelighet,
    lagre: lagreReserveTilgjengelighet,
    fjern: fjernReserveTilgjengelighet,
  } = useReserveTilgjengelighetStore();
  const [leggTilRuteInput, setLeggTilRuteInput] = useState("");
  const [modulSøk, setModulSøk] = useModulSøkFraUrl();
  const [sjåførSøk, setSjåførSøk] = useState("");
  const [draOverTilgjengelig, setDraOverTilgjengelig] = useState(false);
  const [draOverFravær, setDraOverFravær] = useState(false);
  const [draOverAvspasering, setDraOverAvspasering] = useState(false);
  const [visAvspasering, setVisAvspasering] = useState(false);
  const [visFravær, setVisFravær] = useState(false);
  const [visDagsoversikt, setVisDagsoversikt] = useState(false);

  const {
    uke,
    dayNo,
    skiftOverstyringMap,
    reserveMap,
    effektiveRuter,
    tildelingMap,
    ansattNavnById,
    bilById,
    hengerById,
    synligeRuter,
    bilPosterPåDato,
    hengerPosterPåDato,
    avspasering,
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
    finnKoblingForRute,
    koblingLagringsNøkkel,
    kobleteMedRute,
    erKoblingOpphevetForDag,
    effektivRessursForSlot,
    tildelingKjoretoyForRute,
    masterplanBilIdForSlot,
    masterplanHengerIdForSlot,
    bilValgbareForRute,
    hengerValgbareForRute,
    bilSelectVerdi,
    hengerSelectVerdi,
    planHarBilTildelt,
    planHarHengerTildelt,
    sjåførSelectVerdi,
    sjåførDragAnsattIdForRute,
    sjåførVisningNavn,
    masterSjåførFraværInfo,
    bilErLedigForRute,
    hengerErLedigForRute,
    bilIkkeValgbarEtikett,
    hengerIkkeValgbarEtikett,
    bilUtilgjengeligGrunn,
    hengerUtilgjengeligGrunn,
  } = usePlanLogikk({
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
  });

  function settSkiftForAnsatt(
    ansattId: string,
    nyttSkift: PlanSkift,
    omfang: "dag" | "uke",
  ) {
    fjernSkiftForAnsatt(ansattId);
    if (omfang === "uke") {
      const mandag = parseISODateInput(dato);
      mandag.setDate(mandag.getDate() - (dayNo - 1));
      const søndag = new Date(mandag);
      søndag.setDate(mandag.getDate() + 6);
      const fraDato = isoDato(mandag);
      lagreSkiftTilgjengelighet({
        id: skiftTilgjengelighetId(ansattId, fraDato),
        ansattId,
        fraDato,
        tilDato: isoDato(søndag),
        skift: nyttSkift,
      });
    } else {
      lagreSkiftTilgjengelighet({
        id: skiftTilgjengelighetId(ansattId, dato),
        ansattId,
        fraDato: dato,
        skift: nyttSkift,
      });
    }
  }

  function fjernSkiftForAnsatt(ansattId: string) {
    for (const p of skiftTilgjengelighet) {
      if (p.ansattId !== ansattId) continue;
      const dekker = p.tilDato ? dato >= p.fraDato && dato <= p.tilDato : dato === p.fraDato;
      if (dekker) fjernSkiftTilgjengelighet(p.id);
    }
  }

  function settReserveForAnsatt(ansattId: string, fraKl: string) {
    lagreReserveTilgjengelighet({
      id: reserveTilgjengelighetId(ansattId, dato, skift as Skift),
      ansattId,
      fraDato: dato,
      skift: skift as Skift,
      fraKl,
    });
  }

  function fjernReserveForAnsatt(ansattId: string) {
    const post = reserveMap.get(ansattId);
    if (post) fjernReserveTilgjengelighet(post.id);
  }

  useEffect(() => {
    setVisAvspasering(false);
    setVisFravær(false);
  }, [dato, skift]);

  async function opphevKoblingForDag(rutekode: string) {
    const info = finnKoblingForRute(rutekode);
    if (!info) return;
    const nøkkel = koblingLagringsNøkkel(info);
    const liste = sorterRutekoder(info.rutekoder).join(", ");
    const ok = await requestBekreft(
      `Oppheve kobling mellom ${liste} for ${dato} (${skift})?\n\nRutene kan planlegges separat denne dagen. Masterplan endres ikke.`,
    );
    if (!ok) return;
    lagreDagEndring({
      id: dagKoblingOpphevetId(dato, skift as Skift, nøkkel),
      dato,
      skift: skift as Skift,
      type: "kobling_opphevet",
      rutekode: info.rutekoder[0],
      koblingsgruppe: info.gruppeKey || undefined,
      rutekoder: info.rutekoder,
    });
  }

  async function gjenopprettKoblingForDag(rutekode: string) {
    const info = finnKoblingForRute(rutekode);
    if (!info) return;
    const nøkkel = koblingLagringsNøkkel(info);
    const liste = sorterRutekoder(info.rutekoder).join(", ");
    const ok = await requestBekreft(
      `Gjenopprette kobling mellom ${liste} for ${dato} (${skift})?\n\nSjåfør, bil og henger deles igjen mellom rutene.`,
    );
    if (!ok) return;
    fjernDagEndring(dagKoblingOpphevetId(dato, skift as Skift, nøkkel));
  }

  /* ── Slot-hjelpere og DnD ── */

  function slotForRute(
    rute: string,
    patch: Partial<
      Pick<
        PlanRuteTildeling,
        "bilId" | "hengerId" | "skjulBaselineSjåfør" | "skjulBaselineBil" | "skjulBaselineHenger"
      >
    > & { ansattId?: string | null },
  ): PlanRuteTildeling {
    const cur = tildelingMap.get(rute);
    const harAnsattPatch = "ansattId" in patch;
    const harBilPatch = "bilId" in patch;
    const harHengerPatch = "hengerId" in patch;
    return {
      id: planRuteSlotId(uke, dayNo, skift as Skift, rute),
      uke,
      dag: dayNo as PlanRuteTildeling["dag"],
      skift: skift as Skift,
      rute,
      ansattId: harAnsattPatch ? (patch.ansattId || undefined) : cur?.ansattId,
      bilId: harBilPatch ? patch.bilId || undefined : cur?.bilId,
      hengerId: harHengerPatch ? patch.hengerId || undefined : cur?.hengerId,
      skjulBaselineSjåfør:
        "skjulBaselineSjåfør" in patch ? patch.skjulBaselineSjåfør : cur?.skjulBaselineSjåfør,
      skjulBaselineBil: "skjulBaselineBil" in patch ? patch.skjulBaselineBil : cur?.skjulBaselineBil,
      skjulBaselineHenger:
        "skjulBaselineHenger" in patch ? patch.skjulBaselineHenger : cur?.skjulBaselineHenger,
    };
  }

  function slotForRuteOnSkift(
    rute: string,
    targetSkift: PlanSkift,
    patch: Partial<
      Pick<
        PlanRuteTildeling,
        "bilId" | "hengerId" | "skjulBaselineSjåfør" | "skjulBaselineBil" | "skjulBaselineHenger"
      >
    > & { ansattId?: string | null },
  ): PlanRuteTildeling {
    const cur = tildelinger.find(
      (t) => t.uke === uke && t.dag === dayNo && t.skift === targetSkift && t.rute === rute,
    );
    const harAnsattPatch = "ansattId" in patch;
    const harBilPatch = "bilId" in patch;
    const harHengerPatch = "hengerId" in patch;
    return {
      id: planRuteSlotId(uke, dayNo, targetSkift as Skift, rute),
      uke,
      dag: dayNo as PlanRuteTildeling["dag"],
      skift: targetSkift as Skift,
      rute,
      ansattId: harAnsattPatch ? (patch.ansattId || undefined) : cur?.ansattId,
      bilId: harBilPatch ? patch.bilId || undefined : cur?.bilId,
      hengerId: harHengerPatch ? patch.hengerId || undefined : cur?.hengerId,
      skjulBaselineSjåfør:
        "skjulBaselineSjåfør" in patch ? patch.skjulBaselineSjåfør : cur?.skjulBaselineSjåfør,
      skjulBaselineBil: "skjulBaselineBil" in patch ? patch.skjulBaselineBil : cur?.skjulBaselineBil,
      skjulBaselineHenger:
        "skjulBaselineHenger" in patch ? patch.skjulBaselineHenger : cur?.skjulBaselineHenger,
    };
  }

  function fjernSjåførFraAlleRuterPåDag(ansattId: string) {
    const treff = finnSjåførRuterPåDag({
      uke,
      dag: dayNo,
      dato,
      ansattId,
      masterSlots: masterplan.slots,
      dagEndringer,
      tildelinger,
    });
    const items: PlanRuteTildeling[] = [];
    const seen = new Set<string>();

    for (const { skift: targetSkift, rutekode } of treff) {
      const key = `${targetSkift}:${rutekode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(
        slotForRuteOnSkift(rutekode, targetSkift, {
          ansattId: undefined,
          skjulBaselineSjåfør: true,
        }),
      );
    }

    if (items.length > 0) lagreFlere(items);
  }

  function registrerManuellAvspasering(ansattId: string, kilde: string) {
    const finnes = fraværForAnsattPåDato(fravær, ansattId, dato, "Avspasering");
    if (!finnes) {
      const ny: Fravær = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `f-${Date.now()}`,
        ansattId,
        type: "Avspasering",
        fraDato: dato,
        tilDato: dato,
        planlagt: true,
        kommentar: `Registrert fra Plan (${kilde}, ${dato})`,
      };
      lagreFravær(ny);
    }
    fjernSjåførFraAlleRuterPåDag(ansattId);
  }

  function lagreSlot(
    rute: string,
    patch: Partial<
      Pick<
        PlanRuteTildeling,
        | "ansattId"
        | "bilId"
        | "hengerId"
        | "skjulBaselineSjåfør"
        | "skjulBaselineBil"
        | "skjulBaselineHenger"
      >
    >,
  ) {
    lagreTildeling(slotForRute(rute, patch));
  }

  function handleDragStartAnsatt(e: DragEvent, payload: DragAnsattPayload) {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOverSlot(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDragLeaveSection(e: DragEvent, clear: () => void) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    clear();
  }

  async function applySjåførOnRute(
    ruteKode: string,
    valg: PlanSjåførVelg,
    options?: { fraRute?: string; skipConfirm?: boolean },
  ) {
    const fraRute = options?.fraRute;
    if (fraRute === ruteKode && valg !== "__ingen__" && valg !== "__baseline__") return;

    if (valg !== "__ingen__" && valg !== "__baseline__") {
      const grunn = utilgjengeligeGrunner.get(valg.ansattId);
      if (grunn && !options?.skipConfirm) {
        const a = ansatte.find((x) => x.id === valg.ansattId);
        const navn = a ? fullNavn(a) : valg.ansattId;
        const ok = await requestBekreft(
          `${navn} er ikke tilgjengelig (${grunn}). Vil du sette inn likevel?`,
        );
        if (!ok) return;
      }
    }

    const målRuter = [ruteKode, ...kobleteMedRute(ruteKode)];
    const målSet = new Set(målRuter);
    const items: PlanRuteTildeling[] = [];

    if (valg === "__ingen__") {
      for (const mål of målRuter) {
        items.push(slotForRute(mål, { ansattId: undefined, skjulBaselineSjåfør: true }));
      }
      lagreFlere(items);
      return;
    }

    if (valg === "__baseline__") {
      for (const mål of målRuter) {
        items.push(slotForRute(mål, { ansattId: undefined, skjulBaselineSjåfør: false }));
      }
      lagreFlere(items);
      return;
    }

    const { ansattId } = valg;

    for (const slot of effektiveRuter) {
      if (målSet.has(slot.rutekode)) continue;
      const t = tildelingMap.get(slot.rutekode);
      if (t?.ansattId !== ansattId) continue;
      if (fraRute && slot.rutekode === fraRute) continue;
      items.push(slotForRute(slot.rutekode, { ansattId: undefined }));
    }

    if (fraRute && !målSet.has(fraRute)) {
      items.push(slotForRute(fraRute, { ansattId: undefined, skjulBaselineSjåfør: true }));
    }

    for (const mål of målRuter) {
      items.push(slotForRute(mål, { ansattId, skjulBaselineSjåfør: false }));
    }

    lagreFlere(items);
  }

  async function handleDropPåRute(e: DragEvent, ruteKode: string) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: DragAnsattPayload;
    try {
      payload = JSON.parse(raw) as DragAnsattPayload;
    } catch {
      return;
    }
    const { ansattId, fraRute } = payload;
    if (!ansattId) return;
    await applySjåførOnRute(ruteKode, { ansattId }, { fraRute, skipConfirm: false });
  }

  function handleDropFjernSjåfør(e: DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: DragAnsattPayload;
    try {
      payload = JSON.parse(raw) as DragAnsattPayload;
    } catch {
      return;
    }
    const { fraRute } = payload;
    if (!fraRute) return;
    const ruter = [fraRute, ...kobleteMedRute(fraRute)];
    lagreFlere(ruter.map((r) => slotForRute(r, { ansattId: undefined, skjulBaselineSjåfør: true })));
  }

  function handleDropRegistrerAvspasering(e: DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: DragAnsattPayload;
    try {
      payload = JSON.parse(raw) as DragAnsattPayload;
    } catch {
      return;
    }
    const { ansattId, fraRute } = payload;
    if (!ansattId) return;
    registrerManuellAvspasering(ansattId, fraRute ? `rute ${fraRute}` : "tilgjengelig");
  }

  function handleDropRegistrerFravær(e: DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: DragAnsattPayload;
    try {
      payload = JSON.parse(raw) as DragAnsattPayload;
    } catch {
      return;
    }
    const { ansattId, fraRute } = payload;
    if (!ansattId) return;

    const harOverlapAllerede = fravær.some(
      (f) => f.ansattId === ansattId && overlapperDato(f, dato),
    );
    if (!harOverlapAllerede) {
      const kilde = fraRute ? `rute ${fraRute}` : "tilgjengelig";
      const ny: Fravær = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `f-${Date.now()}`,
        ansattId,
        type: "Syk",
        fraDato: dato,
        tilDato: dato,
        planlagt: false,
        kommentar: `Registrert fra Plan (${kilde}, ${dato})`,
      };
      lagreFravær(ny);
    }

    if (fraRute) {
      lagreSlot(fraRute, { ansattId: undefined, skjulBaselineSjåfør: true });
    }
  }

  function oppdaterTildeling(
    rute: string,
    felt: "bilId" | "hengerId",
    verdi: string,
  ) {
    let patch: Partial<
      Pick<PlanRuteTildeling, "bilId" | "hengerId" | "skjulBaselineBil" | "skjulBaselineHenger">
    >;
    if (felt === "bilId") {
      if (!verdi || verdi === "__ingen__") {
        patch = { bilId: undefined, skjulBaselineBil: true };
      } else if (verdi === "__baseline__") {
        patch = { bilId: undefined, skjulBaselineBil: false };
      } else {
        patch = { bilId: verdi, skjulBaselineBil: false };
      }
    } else if (!verdi || verdi === "__ingen__") {
      patch = { hengerId: undefined, skjulBaselineHenger: true };
    } else if (verdi === "__baseline__") {
      patch = { hengerId: undefined, skjulBaselineHenger: false };
    } else {
      patch = { hengerId: verdi, skjulBaselineHenger: false };
    }

    const målRuter = [rute, ...kobleteMedRute(rute)];
    const items = målRuter.map((r) => slotForRute(r, patch));
    lagreFlere(items);
  }


  /* ── Dynamisk: fjern/legg til rute for denne dagen ── */

  function fjernRuteFraDag(rutekode: string, rutenavn?: string) {
    if (lagtTilRuterForDag.has(rutekode)) {
      // Ruten var dynamisk lagt til — bare fjern den "lagt_til"-oppføringen
      const lagtTilId = dagEndringId(dato, skift as Skift, rutekode);
      fjernDagEndring(lagtTilId);
    } else {
      // Ruten er fra master — opprett en "fjernet"-oppføring
      const id = `${dagEndringId(dato, skift as Skift, rutekode)}-fjernet`;
      lagreDagEndring({
        id,
        dato,
        skift: skift as Skift,
        type: "fjernet",
        rutekode,
        rutenavn,
      });
    }
  }

  function angreFjernRute(rutekode: string) {
    const id = `${dagEndringId(dato, skift as Skift, rutekode)}-fjernet`;
    fjernDagEndring(id);
  }

  function leggTilRuteForDag() {
    const kode = leggTilRuteInput.trim();
    if (!kode) return;
    const id = dagEndringId(dato, skift as Skift, kode);
    lagreDagEndring({
      id,
      dato,
      skift: skift as Skift,
      type: "lagt_til",
      rutekode: kode,
    });
    setLeggTilRuteInput("");
  }

  const planRuteRadLogikk = useMemo(
    (): PlanRuteRadLogikk => ({
      effektivRessursForSlot,
      masterplanBilIdForSlot,
      masterplanHengerIdForSlot,
      tildelingKjoretoyForRute,
      bilSelectVerdi,
      hengerSelectVerdi,
      planHarBilTildelt,
      planHarHengerTildelt,
      finnKoblingForRute,
      erKoblingOpphevetForDag,
      kobleteMedRute,
      bilValgbareForRute,
      hengerValgbareForRute,
      sjåførSelectVerdi,
      sjåførDragAnsattIdForRute,
      sjåførVisningNavn,
      masterSjåførFraværInfo,
      bilErLedigForRute,
      hengerErLedigForRute,
      bilIkkeValgbarEtikett,
      hengerIkkeValgbarEtikett,
      bilUtilgjengeligGrunn,
      hengerUtilgjengeligGrunn,
    }),
    [
      effektivRessursForSlot,
      masterplanBilIdForSlot,
      masterplanHengerIdForSlot,
      tildelingKjoretoyForRute,
      bilSelectVerdi,
      hengerSelectVerdi,
      planHarBilTildelt,
      planHarHengerTildelt,
      finnKoblingForRute,
      erKoblingOpphevetForDag,
      kobleteMedRute,
      bilValgbareForRute,
      hengerValgbareForRute,
      sjåførSelectVerdi,
      sjåførDragAnsattIdForRute,
      sjåførVisningNavn,
      masterSjåførFraværInfo,
      bilErLedigForRute,
      hengerErLedigForRute,
      bilIkkeValgbarEtikett,
      hengerIkkeValgbarEtikett,
      bilUtilgjengeligGrunn,
      hengerUtilgjengeligGrunn,
    ],
  );

  /* ── Render ── */

  return (
    <div className={styles.page}>
      {/* ── Topplinje ── */}
      <header className={styles.header}>
        <h1 className={styles.title}>Plan</h1>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.dayNavBtn}
            onClick={() => {
              const d = parseISODateInput(dato);
              d.setDate(d.getDate() - 1);
              setDato(isoDato(d));
            }}
            aria-label="Forrige dag"
            title="Forrige dag"
          >
            ‹
          </button>
          <input
            className={styles.input}
            type="date"
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            aria-label="Dato"
          />
          <button
            type="button"
            className={styles.dayNavBtn}
            onClick={() => {
              const d = parseISODateInput(dato);
              d.setDate(d.getDate() + 1);
              setDato(isoDato(d));
            }}
            aria-label="Neste dag"
            title="Neste dag"
          >
            ›
          </button>
          <button
            type="button"
            className={`${styles.dayShortcut}${dato === isoDato(new Date()) ? ` ${styles.dayShortcutActive}` : ""}`}
            onClick={() => setDato(isoDato(new Date()))}
          >
            I dag
          </button>
          <button
            type="button"
            className={`${styles.dayShortcut}${dato === isoDato((() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })()) ? ` ${styles.dayShortcutActive}` : ""}`}
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              setDato(isoDato(d));
            }}
          >
            I morgen
          </button>
          <span className={styles.ukeBadge} title="Beregnet automatisk fra dato">
            Uke {uke}
          </span>
          <div className={styles.tabs} role="tablist" aria-label="Skift">
            <button
              type="button"
              role="tab"
              aria-selected={skift === "Dag"}
              className={`${styles.tabBtn} ${skift === "Dag" ? styles.tabBtnActive : ""}`}
              onClick={() => setSkift("Dag")}
            >
              Dag
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={skift === "Kveld"}
              className={`${styles.tabBtn} ${skift === "Kveld" ? styles.tabBtnActive : ""}`}
              onClick={() => setSkift("Kveld")}
            >
              Kveld
            </button>
          </div>
          <input
            className={styles.input}
            type="search"
            value={modulSøk}
            onChange={(e) => setModulSøk(e.target.value)}
            placeholder="Søk rute, navn, bil, henger…"
            aria-label="Søk i ruter"
          />
        </div>
      </header>

      {/* ── Sammendrag ── */}
      <div className={styles.summary}>
        <span>
          {modulSøk.trim()
            ? `${synligeRuter.length} av ${effektiveRuter.length} ruter`
            : `${effektiveRuter.length} ruter`}
        </span>
        <span className={styles.summaryOk}>{sammendrag.ok} OK</span>
        {sammendrag.rød > 0 && (
          <span className={styles.summaryBad}>{sammendrag.rød} mangler sjåfør/bil</span>
        )}
        {sammendrag.gul > 0 && (
          <span className={styles.summaryWarn}>{sammendrag.gul} utilgjengelig</span>
        )}
        {sammendrag.blå > 0 && (
          <span>{sammendrag.blå} uten henger</span>
        )}
        <span>{tilgjengeligeAnsatte.length} tilgjengelige</span>
        <span>{fraværPåDato.length} fraværende</span>
        <button
          type="button"
          className={styles.summaryDagsoversikt}
          onClick={() => setVisDagsoversikt(true)}
          title="Fravær, avspasering og kjøretøy ute for valgt dag"
        >
          Dagsoversikt{dagsoversiktTotalt > 0 ? ` · ${dagsoversiktTotalt}` : ""}
        </button>
      </div>

      {/* ── Hovedområde ── */}
      <div className={styles.layout}>
        {/* ── Tabell (venstre) ── */}
        <div className={styles.tableArea}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rute</th>
                <th>Navn</th>
                <th>Sjåfør</th>
                <th>Bil</th>
                <th>Henger</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {synligeRuter.map((slot) => (
                <PlanRuteRad
                  key={slot.rutekode}
                  slot={slot}
                  til={tildelingMap.get(slot.rutekode)}
                  dato={dato}
                  ansatte={ansatte}
                  ansattNavnById={ansattNavnById}
                  bilById={bilById}
                  hengerById={hengerById}
                  tilgjengeligeIdSet={tilgjengeligeIdSet}
                  utilgjengeligeGrunner={utilgjengeligeGrunner}
                  bilUtilgjengelig={bilUtilgjengelig}
                  hengerUtilgjengelig={hengerUtilgjengelig}
                  logikk={planRuteRadLogikk}
                  handlers={{
                    opphevKoblingForDag,
                    gjenopprettKoblingForDag,
                    applySjåførOnRute,
                    oppdaterTildeling,
                    fjernRuteFraDag,
                    handleDragOverSlot,
                    handleDropPåRute,
                    handleDragStartAnsatt,
                  }}
                />
              ))}
              {synligeRuter.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.note}>
                    {modulSøk.trim()
                      ? `Ingen treff på «${modulSøk.trim()}».`
                      : "Ingen ruter for valgt uke/dag/skift."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className={styles.addRouteRow}>
            <input
              className={styles.addRouteInput}
              type="text"
              placeholder="Rutekode (f.eks. 1150)"
              value={leggTilRuteInput}
              onChange={(e) => setLeggTilRuteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && leggTilRuteForDag()}
            />
            <button
              type="button"
              className={styles.addRouteBtn}
              onClick={leggTilRuteForDag}
              disabled={!leggTilRuteInput.trim()}
            >
              + Legg til rute for dagen
            </button>
          </div>
        </div>

        {/* ── Sidebar (høyre) ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarInner}>
            {/* Tilgjengelige */}
            <div
              className={`${styles.tilgjengeligSection} ${draOverTilgjengelig ? styles.tilgjengeligDragOver : ""}`}
              onDragOver={(e) => { handleDragOverSlot(e); setDraOverTilgjengelig(true); }}
              onDragLeave={(e) => handleDragLeaveSection(e, () => setDraOverTilgjengelig(false))}
              onDrop={(e) => { handleDropFjernSjåfør(e); setDraOverTilgjengelig(false); }}
            >
              <div className={styles.sectionLabel}>Tilgjengelige ({tilgjengeligeAnsatte.length})</div>
              <input
                className={styles.sidebarSøk}
                type="search"
                value={sjåførSøk}
                onChange={(e) => setSjåførSøk(e.target.value)}
                placeholder="Søk sjåfør…"
                aria-label="Søk blant tilgjengelige sjåfører"
              />
              <div className={styles.driverList}>
                {filtrerteAnsatte.tilgjengelige.map((a) => {
                  const reserve = reserveMap.get(a.id);
                  return (
                  <div
                    key={a.id}
                    className={`${styles.driverRow}${reserve ? ` ${styles.driverRowReserve}` : ""}`}
                    draggable
                    onDragStart={(e) => handleDragStartAnsatt(e, { ansattId: a.id })}
                    title={
                      reserve
                        ? `Dra ${fullNavn(a)} til en rute — ${reserveTilgjengeligTekst(reserve.fraKl)}`
                        : `Dra ${fullNavn(a)} til en rute`
                    }
                  >
                    <span className={styles.driverName}>
                      {fullNavn(a)}
                      {reserve ? (
                        <span className={styles.reserveBadge}>{reserve.fraKl}</span>
                      ) : null}
                    </span>
                    <PlanReserveMenu
                      navn={fullNavn(a)}
                      skift={skift as Skift}
                      reserve={reserve ? { fraKl: reserve.fraKl } : undefined}
                      onSett={(kl) => settReserveForAnsatt(a.id, kl)}
                      onFjern={() => fjernReserveForAnsatt(a.id)}
                    />
                    <PlanSkiftMenu
                      navn={fullNavn(a)}
                      overstyrtSkift={skiftOverstyringMap.get(a.id)}
                      onSett={(s, omfang) => settSkiftForAnsatt(a.id, s, omfang)}
                      onFjern={() => fjernSkiftForAnsatt(a.id)}
                    />
                  </div>
                );
                })}
                {filtrerteAnsatte.utilgjengelige.length > 0 && (
                  <>
                    <div className={styles.driverDivider}>Utilgjengelige</div>
                    {filtrerteAnsatte.utilgjengelige.map((a) => (
                      <div
                        key={a.id}
                        className={`${styles.driverRow} ${styles.driverRowUnavail}`}
                        draggable
                        onDragStart={(e) => handleDragStartAnsatt(e, { ansattId: a.id })}
                        title={`${fullNavn(a)} — ${a.grunn}`}
                      >
                        <span className={styles.driverName}>{fullNavn(a)}</span>
                        <span className={styles.driverGrunn}>{a.grunn}</span>
                        <PlanReserveMenu
                          navn={fullNavn(a)}
                          skift={skift as Skift}
                          reserve={reserveMap.get(a.id) ? { fraKl: reserveMap.get(a.id)!.fraKl } : undefined}
                          onSett={(kl) => settReserveForAnsatt(a.id, kl)}
                          onFjern={() => fjernReserveForAnsatt(a.id)}
                        />
                        <PlanSkiftMenu
                          navn={fullNavn(a)}
                          overstyrtSkift={skiftOverstyringMap.get(a.id)}
                          onSett={(s, omfang) => settSkiftForAnsatt(a.id, s, omfang)}
                          onFjern={() => fjernSkiftForAnsatt(a.id)}
                        />
                      </div>
                    ))}
                  </>
                )}
                {tilgjengeligeAnsatte.length === 0 && !sjåførSøk.trim() && (
                  <span className={styles.note}>Alle tildelt / utilgjengelige</span>
                )}
                {sjåførSøk.trim() && filtrerteAnsatte.tilgjengelige.length === 0 && filtrerteAnsatte.utilgjengelige.length === 0 && (
                  <span className={styles.note}>Ingen treff på «{sjåførSøk.trim()}»</span>
                )}
              </div>
            </div>

            <hr className={styles.divider} />

            <div
              className={`${styles.avspaseringSection} ${draOverAvspasering ? styles.avspaseringDragOver : ""}`}
              onDragOver={(e) => { handleDragOverSlot(e); setDraOverAvspasering(true); }}
              onDragLeave={(e) => handleDragLeaveSection(e, () => setDraOverAvspasering(false))}
              onDrop={(e) => { handleDropRegistrerAvspasering(e); setDraOverAvspasering(false); }}
              aria-label="Avspasering"
            >
              <button
                type="button"
                className={styles.avspaseringToggle}
                onClick={() => setVisAvspasering((v) => !v)}
                aria-expanded={visAvspasering}
                aria-controls="plan-avspasering-liste"
                disabled={avspasering.entries.length === 0}
              >
                <span>Avspasering ({avspasering.entries.length})</span>
                <span className={styles.avspaseringToggleIcon} aria-hidden>
                  {visAvspasering ? "▾" : "▸"}
                </span>
              </button>

              {visAvspasering && avspasering.entries.length > 0 && (
                <div id="plan-avspasering-liste" className={styles.avspaseringList}>
                  {avspasering.entries.map((e) => (
                    <div key={e.entryId} className={styles.avspaseringRow}>
                      <span className={styles.avspaseringNavn}>{e.visningsnavn}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <hr className={styles.divider} />

            <div
              className={`${styles.fraværBlock} ${draOverFravær ? styles.fraværDragOver : ""}`}
              onDragOver={(e) => { handleDragOverSlot(e); setDraOverFravær(true); }}
              onDragLeave={(e) => handleDragLeaveSection(e, () => setDraOverFravær(false))}
              onDrop={(e) => { handleDropRegistrerFravær(e); setDraOverFravær(false); }}
              aria-label="Fravær"
            >
              <button
                type="button"
                className={styles.avspaseringToggle}
                onClick={() => setVisFravær((v) => !v)}
                aria-expanded={visFravær}
                aria-controls="plan-fravær-liste"
                disabled={fraværPåDato.length === 0}
              >
                <span>Fravær ({fraværPåDato.length})</span>
                <span className={styles.avspaseringToggleIcon} aria-hidden>
                  {visFravær ? "▾" : "▸"}
                </span>
              </button>

              {visFravær && fraværPåDato.length > 0 && (
                <div id="plan-fravær-liste" className={styles.avspaseringList}>
                  {fraværPåDato.map((f) => (
                    <div key={f.id} className={styles.avspaseringRow}>
                      <span className={styles.avspaseringNavn}>
                        {ansattNavnById.get(f.ansattId) ?? f.ansattId}
                      </span>
                      <span className={styles.avspaseringKildeTag}>{f.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <hr className={styles.divider} />

            {/* Fjernede ruter */}
            {fjernedeRuterForDag.length > 0 && (
              <div>
                <div className={styles.sectionLabel}>Fjernet i dag ({fjernedeRuterForDag.length})</div>
                {fjernedeRuterForDag.map((e) => (
                  <div key={e.id} className={styles.removedRoute}>
                    <span className={styles.removedRouteName}>{e.rutenavn ?? e.rutekode}</span>
                    <button
                      type="button"
                      className={styles.undoBtn}
                      onClick={() => angreFjernRute(e.rutekode)}
                      title="Angre — legg ruten tilbake"
                    >
                      Angre
                    </button>
                  </div>
                ))}
              </div>
            )}

            <hr className={styles.divider} />

            {/* Biler ute */}
            {bilPosterPåDato.length > 0 && (
              <div>
                <div className={styles.sectionLabel}>Bil ute ({bilPosterPåDato.length})</div>
                {bilPosterPåDato.map((p: BilUtilgjengelig) => {
                  const b = bilById.get(p.bilId);
                  return (
                    <span key={p.id} className={styles.tag}>
                      {b ? b.kjennemerke : p.bilId} · {p.type}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Henger ute */}
            {hengerPosterPåDato.length > 0 && (
              <div>
                <div className={styles.sectionLabel}>Henger ute ({hengerPosterPåDato.length})</div>
                {hengerPosterPåDato.map((p: HengerUtilgjengelig) => {
                  const h = hengerById.get(p.hengerId);
                  return (
                    <span key={p.id} className={styles.tag}>
                      {h ? h.kjennemerke : p.hengerId} · {p.type}
                    </span>
                  );
                })}
              </div>
            )}

          </div>
        </aside>
      </div>
      {bekreftDialog}
      <DagsFraværOversiktModal
        open={visDagsoversikt}
        onClose={() => setVisDagsoversikt(false)}
        dato={dato}
        oversikt={dagsoversikt}
      />
    </div>
  );
}
