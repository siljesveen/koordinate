"use client";

import { useEffect, useRef, useState } from "react";
import type { Skift } from "@/lib/domain";
import styles from "./PlanSkiftMenu.module.css";

type Props = {
  navn: string;
  /** Skift sjåføren er overstyrt til på valgt dato (hvis noen). */
  overstyrtSkift?: Skift;
  onSett: (skift: Skift, omfang: "dag" | "uke") => void;
  onFjern: () => void;
};

export default function PlanSkiftMenu({ navn, overstyrtSkift, onSett, onFjern }: Props) {
  const [open, setOpen] = useState(false);
  const rotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rotRef.current && !rotRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function velg(skift: Skift, omfang: "dag" | "uke") {
    onSett(skift, omfang);
    setOpen(false);
  }

  return (
    <div className={styles.rot} ref={rotRef}>
      <button
        type="button"
        className={`${styles.trigger}${overstyrtSkift ? ` ${styles.triggerAktiv}` : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          overstyrtSkift
            ? `${navn} er satt til ${overstyrtSkift} – endre skift`
            : `Sett skift for ${navn}`
        }
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      >
        {overstyrtSkift ? (overstyrtSkift === "Dag" ? "D" : "K") : "⇄"}
      </button>

      {open && (
        <div className={styles.meny} role="menu">
          <div className={styles.menyTittel}>{navn}</div>
          <div className={styles.menyGruppe}>
            <span className={styles.menyEtikett}>I dag</span>
            <div className={styles.menyRad}>
              <button
                type="button"
                className={`${styles.valg}${overstyrtSkift === "Dag" ? ` ${styles.valgAktiv}` : ""}`}
                onClick={() => velg("Dag", "dag")}
              >
                Dag
              </button>
              <button
                type="button"
                className={`${styles.valg}${overstyrtSkift === "Kveld" ? ` ${styles.valgAktiv}` : ""}`}
                onClick={() => velg("Kveld", "dag")}
              >
                Kveld
              </button>
            </div>
          </div>
          <div className={styles.menyGruppe}>
            <span className={styles.menyEtikett}>Hele uken</span>
            <div className={styles.menyRad}>
              <button type="button" className={styles.valg} onClick={() => velg("Dag", "uke")}>
                Dag
              </button>
              <button type="button" className={styles.valg} onClick={() => velg("Kveld", "uke")}>
                Kveld
              </button>
            </div>
          </div>
          {overstyrtSkift && (
            <button
              type="button"
              className={styles.fjern}
              onClick={() => {
                onFjern();
                setOpen(false);
              }}
            >
              Fjern overstyring
            </button>
          )}
        </div>
      )}
    </div>
  );
}
