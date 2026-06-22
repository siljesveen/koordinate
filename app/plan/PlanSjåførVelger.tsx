"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { fullNavn, type Ansatt } from "@/lib/domain";
import { sjåførValgtErOverstyring } from "@/lib/plan/sjåførTilgjengelighet";
import styles from "./page.module.css";

export type PlanSjåførVelg =
  | "__ingen__"
  | "__baseline__"
  | { ansattId: string };

type PlanSjåførVelgerProps = {
  rute: string;
  selectValue: string;
  visningNavn: string;
  sjåførFraMaster: boolean;
  sjåførHarFravær: boolean;
  manueltInnsatt: boolean;
  masterSjåførNavn?: string;
  masterPåFravær?: boolean;
  masterFraværGrunn?: string;
  /** Satt (f.eks. "kveld") når master-sjåføren er flyttet til motsatt skift. */
  påAnnetSkift?: string;
  dragAnsattId?: string;
  onDragStart: (e: DragEvent, ansattId: string) => void;
  ansatte: Ansatt[];
  tilgjengeligeIdSet: ReadonlySet<string>;
  utilgjengeligeGrunner: ReadonlyMap<string, string>;
  onVelg: (valg: PlanSjåførVelg) => void | Promise<void>;
  ariaLabel: string;
};

type ListeValg =
  | { kind: "ingen" }
  | { kind: "baseline" }
  | { kind: "ansatt"; id: string; label: string; ledig: boolean; status: string };

export default function PlanSjåførVelger({
  rute,
  selectValue,
  visningNavn,
  sjåførFraMaster,
  sjåførHarFravær,
  manueltInnsatt,
  masterSjåførNavn,
  masterPåFravær = false,
  masterFraværGrunn,
  påAnnetSkift,
  dragAnsattId,
  onDragStart,
  ansatte,
  tilgjengeligeIdSet,
  utilgjengeligeGrunner,
  onVelg,
  ariaLabel,
}: PlanSjåførVelgerProps) {
  const [åpen, setÅpen] = useState(false);
  const [søk, setSøk] = useState("");
  const rotRef = useRef<HTMLDivElement>(null);
  const søkRef = useRef<HTMLInputElement>(null);

  const askoAnsatte = useMemo(
    () =>
      ansatte
        .filter((a) => a.aktiv && (!a.selskap || a.selskap === "Asko"))
        .slice()
        .sort((a, b) => fullNavn(a).localeCompare(fullNavn(b), "nb")),
    [ansatte],
  );

  function statusForAnsatt(id: string): { ledig: boolean; status: string } {
    if (tilgjengeligeIdSet.has(id)) return { ledig: true, status: "Ledig" };
    const grunn = utilgjengeligeGrunner.get(id);
    return { ledig: false, status: grunn ?? "Utilgjengelig" };
  }

  const søkTreff = useMemo((): ListeValg[] => {
    const q = søk.trim().toLowerCase();
    if (!q) return [];
    return askoAnsatte
      .filter((a) => fullNavn(a).toLowerCase().includes(q))
      .map((a) => {
        const { ledig, status } = statusForAnsatt(a.id);
        return {
          kind: "ansatt" as const,
          id: a.id,
          label: fullNavn(a),
          ledig,
          status,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [søk, askoAnsatte, tilgjengeligeIdSet, utilgjengeligeGrunner]);

  const standardValg = useMemo((): ListeValg[] => {
    const liste: ListeValg[] = [];
    if (masterSjåførNavn) {
      liste.push({ kind: "baseline" });
    }
    liste.push({ kind: "ingen" });
    for (const a of askoAnsatte) {
      if (!tilgjengeligeIdSet.has(a.id)) continue;
      liste.push({
        kind: "ansatt",
        id: a.id,
        label: fullNavn(a),
        ledig: true,
        status: "Ledig",
      });
    }
    if (
      selectValue !== "__ingen__" &&
      selectValue !== "__baseline__" &&
      !tilgjengeligeIdSet.has(selectValue) &&
      askoAnsatte.some((a) => a.id === selectValue)
    ) {
      const a = askoAnsatte.find((x) => x.id === selectValue)!;
      liste.push({
        kind: "ansatt",
        id: a.id,
        label: fullNavn(a),
        ledig: false,
        status: utilgjengeligeGrunner.get(a.id) ?? "Utilgjengelig",
      });
    }
    return liste;
  }, [
    masterSjåførNavn,
    askoAnsatte,
    tilgjengeligeIdSet,
    selectValue,
    utilgjengeligeGrunner,
  ]);

  const visSøk = søk.trim().length > 0;

  const visningFraMaster =
    selectValue === "__baseline__" || (sjåførFraMaster && selectValue !== "__ingen__");

  const valgtViserFravær = Boolean(masterPåFravær && selectValue === "__baseline__");

  const valgtErOverstyring = sjåførValgtErOverstyring(
    dragAnsattId,
    sjåførHarFravær,
    utilgjengeligeGrunner,
    manueltInnsatt,
  );

  const valgtViserAdvarsel = valgtViserFravær || valgtErOverstyring || Boolean(påAnnetSkift);

  const masterFraværTittel = valgtViserFravær
    ? `Mastersjåfør fraværende${masterFraværGrunn ? ` (${masterFraværGrunn})` : ""}`
    : påAnnetSkift
      ? `Sjåfør flyttet til ${påAnnetSkift}`
      : undefined;

  const kanDra = Boolean(dragAnsattId);

  const dragTittel = kanDra
    ? sjåførHarFravær || masterPåFravær
      ? "Dra — har fravær"
      : påAnnetSkift
        ? `Dra — flyttet til ${påAnnetSkift}`
        : sjåførFraMaster
          ? "Dra — fra master"
          : "Dra til annen rute eller drop-sone"
    : masterFraværTittel;

  useEffect(() => {
    if (!åpen) return;
    const t = window.setTimeout(() => søkRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [åpen]);

  useEffect(() => {
    if (!åpen) return;
    function lukk(e: MouseEvent) {
      if (rotRef.current && !rotRef.current.contains(e.target as Node)) {
        setÅpen(false);
        setSøk("");
      }
    }
    document.addEventListener("mousedown", lukk);
    return () => document.removeEventListener("mousedown", lukk);
  }, [åpen]);

  function lukkOgNullstill() {
    setÅpen(false);
    setSøk("");
  }

  async function velgAnsatt(id: string) {
    await onVelg({ ansattId: id });
    lukkOgNullstill();
  }

  async function velgFraListe(valg: ListeValg) {
    if (valg.kind === "ingen") {
      await onVelg("__ingen__");
      lukkOgNullstill();
      return;
    }
    if (valg.kind === "baseline") {
      await onVelg("__baseline__");
      lukkOgNullstill();
      return;
    }
    await velgAnsatt(valg.id);
  }

  function renderValg(valg: ListeValg) {
    if (valg.kind === "ingen") {
      return (
        <button
          key="ingen"
          type="button"
          role="option"
          aria-selected={selectValue === "__ingen__"}
          className={styles.kjoretoyComboItem}
          onClick={() => velgFraListe(valg)}
        >
          <span className={styles.kjoretoyComboReg}>—</span>
        </button>
      );
    }
    if (valg.kind === "baseline") {
      return (
        <button
          key="baseline"
          type="button"
          role="option"
          aria-selected={selectValue === "__baseline__"}
          title={masterFraværTittel ?? "Fra masterplan"}
          className={`${styles.kjoretoyComboItem} ${styles.kjoretoyComboItemMaster} ${masterPåFravær ? styles.kjoretoyComboItemWarn : ""}`}
          onClick={() => velgFraListe(valg)}
        >
          <span className={`${styles.kjoretoyComboReg} ${styles.kjoretoyComboRegMaster}`}>
            {masterSjåførNavn}
          </span>
          {masterPåFravær && (
            <span className={styles.kjoretoyComboStatusWarn}>
              {masterFraværGrunn ?? "Fravær"}
            </span>
          )}
        </button>
      );
    }
    return (
      <button
        key={valg.id}
        type="button"
        role="option"
        aria-selected={selectValue === valg.id}
        className={`${styles.kjoretoyComboItem} ${!valg.ledig ? styles.kjoretoyComboItemWarn : ""}`}
        onClick={() => velgFraListe(valg)}
      >
        <span className={styles.kjoretoyComboReg}>{valg.label}</span>
        <span
          className={valg.ledig ? styles.kjoretoyComboStatusOk : styles.kjoretoyComboStatusWarn}
        >
          {valg.status}
        </span>
      </button>
    );
  }

  return (
    <div className={styles.kjoretoyCombo} ref={rotRef}>
      <div
        className={`${styles.kjoretoyComboTrigger} ${styles.sjåførComboTrigger} ${åpen ? styles.kjoretoyComboTriggerOpen : ""} ${visningFraMaster ? styles.kjoretoyComboTriggerMaster : ""} ${valgtViserAdvarsel ? styles.kjoretoyComboTriggerMasterWarn : ""} ${kanDra ? styles.dragChip : ""}`}
        title={dragTittel ?? (visningFraMaster ? "Sjåfør fra masterplan" : undefined)}
        draggable={kanDra}
        onDragStart={(e) => {
          if (!dragAnsattId) return;
          onDragStart(e, dragAnsattId);
        }}
      >
        <span
          className={`${styles.kjoretoyComboValue} ${styles.sjåførComboValue} ${visningFraMaster ? styles.kjoretoyComboValueMaster : ""}`}
        >
          <span className={styles.sjåførComboNavn}>{visningNavn}</span>
          {påAnnetSkift && (
            <span className={styles.sjåførPåAnnetSkift}>på {påAnnetSkift}</span>
          )}
        </span>
        <button
          type="button"
          className={styles.sjåførComboChevronBtn}
          aria-haspopup="listbox"
          aria-expanded={åpen}
          aria-label={ariaLabel}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onClick={() => setÅpen((o) => !o)}
        >
          <span className={styles.kjoretoyComboChevron} aria-hidden>
            ▾
          </span>
        </button>
      </div>

      {åpen && (
        <div className={styles.kjoretoyComboPanel} role="listbox">
          <div className={styles.kjoretoyComboSøkWrap}>
            <input
              ref={søkRef}
              type="search"
              className={styles.kjoretoyComboSøk}
              value={søk}
              onChange={(e) => setSøk(e.target.value)}
              placeholder="Søk sjåfør…"
              aria-label={`Søk sjåfør for rute ${rute}`}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") lukkOgNullstill();
              }}
            />
          </div>

          <div className={styles.kjoretoyComboListe}>
            {visSøk ? (
              søkTreff.length === 0 ? (
                <div className={styles.kjoretoyComboTom}>Ingen sjåfør funnet</div>
              ) : (
                søkTreff.map((valg) => renderValg(valg))
              )
            ) : (
              <>
                {standardValg.map((valg) => renderValg(valg))}
                <div className={styles.kjoretoyComboTom}>
                  Søk for å finne utilgjengelige sjåfører
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
