"use client";

import { useState } from "react";
import type { Turnus } from "@/lib/domain";
import {
  byggTurnusFraRader,
  raderForFleksibelTurnus,
  TURNUS_DAG_NAVN,
  ukeTilRader,
  type TurnusDagRad,
} from "@/lib/turnus/turnusSkjemaUtils";
import styles from "./TurnusSkjema.module.css";

type TurnusSkjemaProps = {
  value: Turnus;
  onChange: (turnus: Turnus) => void;
};

export default function TurnusSkjema({ value, onChange }: TurnusSkjemaProps) {
  const [visUke, setVisUke] = useState<1 | 2>(1);
  const [fleksibel, setFleksibel] = useState(!!value.fleksibelTilgjengelig);
  const [medRotasjon, setMedRotasjon] = useState(!!value.uke2 && !value.fleksibelTilgjengelig);
  const [skift1, setSkift1] = useState<"Dag" | "Kveld">(value.uke1.skift);
  const [skift2, setSkift2] = useState<"Dag" | "Kveld">(value.uke2?.skift ?? "Kveld");
  const [rader1, setRader1] = useState<TurnusDagRad[]>(() => ukeTilRader(value.uke1));
  const [rader2, setRader2] = useState<TurnusDagRad[]>(() => ukeTilRader(value.uke2));

  function emit(
    patch: Partial<{
      fleksibel: boolean;
      medRotasjon: boolean;
      skift1: "Dag" | "Kveld";
      skift2: "Dag" | "Kveld";
      rader1: TurnusDagRad[];
      rader2: TurnusDagRad[];
    }>,
  ) {
    const nesteFleksibel = patch.fleksibel ?? fleksibel;
    const neste = {
      medRotasjon: nesteFleksibel ? false : (patch.medRotasjon ?? medRotasjon),
      skift1: patch.skift1 ?? skift1,
      skift2: patch.skift2 ?? skift2,
      rader1: patch.rader1 ?? rader1,
      rader2: patch.rader2 ?? rader2,
    };
    onChange(
      byggTurnusFraRader({
        basis: value,
        fleksibelTilgjengelig: nesteFleksibel,
        ...neste,
      }),
    );
  }

  const aktivRader = visUke === 1 ? rader1 : rader2;
  const aktivSkift = visUke === 1 ? skift1 : skift2;
  const erDag = aktivSkift === "Dag";

  function oppdaterRad(dagNr: string, felt: Partial<TurnusDagRad>) {
    if (visUke === 1) {
      const neste = rader1.map((r) => (r.dagNr === dagNr ? { ...r, ...felt } : r));
      setRader1(neste);
      emit({ rader1: neste });
    } else {
      const neste = rader2.map((r) => (r.dagNr === dagNr ? { ...r, ...felt } : r));
      setRader2(neste);
      emit({ rader2: neste });
    }
  }

  return (
    <div className={styles.turnusSkjema}>
      <label className={styles.fleksibelRad}>
        <input
          type="checkbox"
          checked={fleksibel}
          onChange={(e) => {
            const på = e.target.checked;
            setFleksibel(på);
            if (på) {
              setMedRotasjon(false);
              setVisUke(1);
              const nesteRader = raderForFleksibelTurnus(rader1);
              setRader1(nesteRader);
              emit({ fleksibel: på, medRotasjon: false, rader1: nesteRader });
            } else {
              emit({ fleksibel: på });
            }
          }}
        />
        Fleksibel tilgjengelig (dag og kveld)
      </label>
      {fleksibel ? (
        <p className={styles.fleksibelHint}>
          Sjåføren vises som tilgjengelig på både dag- og kveldsskift i plan. Sett arbeidstid per dag
          — standard er tidlig til sent (05:00–23:00).
        </p>
      ) : null}

      <label className={styles.rotasjonRad}>
        <input
          type="checkbox"
          checked={medRotasjon}
          disabled={fleksibel}
          onChange={(e) => {
            const på = e.target.checked;
            setMedRotasjon(på);
            if (på) setVisUke(1);
            emit({ medRotasjon: på });
          }}
        />
        2-ukers rotasjon (tidlig/sent annenhver uke)
      </label>

      {medRotasjon && !fleksibel ? (
        <div className={styles.ukeTabs}>
          {([1, 2] as const).map((uke) => (
            <button
              key={uke}
              type="button"
              className={`${styles.ukeTab} ${visUke === uke ? styles.ukeTabActive : ""}`}
              onClick={() => setVisUke(uke)}
            >
              Uke {uke}
            </button>
          ))}
        </div>
      ) : null}

      {!fleksibel ? (
      <div className={styles.skiftRad}>
        <span className={styles.skiftLabel}>Skift:</span>
        {(["Dag", "Kveld"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={
              aktivSkift === s
                ? s === "Dag"
                  ? styles.skiftBtnDag
                  : styles.skiftBtnKveld
                : s === "Dag"
                  ? styles.skiftBtnDagInaktiv
                  : styles.skiftBtnKveldInaktiv
            }
            onClick={() => {
              if (visUke === 1) {
                setSkift1(s);
                emit({ skift1: s });
              } else {
                setSkift2(s);
                emit({ skift2: s });
              }
            }}
          >
            {s}
          </button>
        ))}
      </div>
      ) : null}

      <div className={styles.dagListe}>
        {aktivRader.map((rad) => (
          <div
            key={rad.dagNr}
            className={`${styles.dagRad} ${rad.aktiv ? (fleksibel ? styles.dagRadAktivFleksibel : erDag ? styles.dagRadAktivDag : styles.dagRadAktivKveld) : ""}`}
          >
            <span className={styles.dagNavn}>{TURNUS_DAG_NAVN[rad.dagNr]}</span>
            <input
              type="checkbox"
              checked={rad.aktiv}
              onChange={(e) => oppdaterRad(rad.dagNr, { aktiv: e.target.checked })}
              aria-label={`Aktiv ${TURNUS_DAG_NAVN[rad.dagNr]}`}
            />
            <div className={styles.tidFelt}>
              <span className={styles.tidLabel}>Start</span>
              <input
                type="time"
                className={styles.tidInput}
                value={rad.startTid}
                disabled={!rad.aktiv}
                onChange={(e) => oppdaterRad(rad.dagNr, { startTid: e.target.value })}
              />
            </div>
            <div className={styles.tidFelt}>
              <span className={styles.tidLabel}>Slutt</span>
              <input
                type="time"
                className={styles.tidInput}
                value={rad.sluttTid}
                disabled={!rad.aktiv}
                onChange={(e) => oppdaterRad(rad.dagNr, { sluttTid: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      <p className={styles.hint}>
        Lørdag: sett arbeidstid for arbeidshelg. Hvilke lørdager som faktisk gjelder defineres i
        masterplan.
      </p>
    </div>
  );
}
