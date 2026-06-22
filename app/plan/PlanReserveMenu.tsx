"use client";

import { useEffect, useRef, useState } from "react";
import type { Skift } from "@/lib/domain";
import { standardReserveFraKl } from "@/lib/plan/reserveTilgjengelighet";
import styles from "./PlanReserveMenu.module.css";

type Props = {
  navn: string;
  skift: Skift;
  /** Aktiv reserve på valgt dato, hvis satt. */
  reserve?: { fraKl: string };
  onSett: (fraKl: string) => void;
  onFjern: () => void;
};

export default function PlanReserveMenu({ navn, skift, reserve, onSett, onFjern }: Props) {
  const [open, setOpen] = useState(false);
  const [fraKl, setFraKl] = useState(reserve?.fraKl ?? standardReserveFraKl(skift));
  const rotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reserve?.fraKl) setFraKl(reserve.fraKl);
  }, [reserve?.fraKl]);

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

  function lagre() {
    onSett(fraKl);
    setOpen(false);
  }

  return (
    <div className={styles.rot} ref={rotRef}>
      <button
        type="button"
        className={`${styles.trigger}${reserve ? ` ${styles.triggerAktiv}` : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          reserve
            ? `${navn} er reserve fra ${reserve.fraKl} – endre`
            : `Sett ${navn} som reserve`
        }
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      >
        R
      </button>

      {open && (
        <div className={styles.meny} role="dialog" aria-label={`Reserve for ${navn}`}>
          <div className={styles.menyTittel}>{navn}</div>
          <label className={styles.felt}>
            <span className={styles.feltEtikett}>Tilgjengelig fra</span>
            <input
              className={styles.tidInput}
              type="time"
              value={fraKl}
              onChange={(e) => setFraKl(e.target.value)}
            />
          </label>
          <button type="button" className={styles.lagre} onClick={lagre}>
            {reserve ? "Oppdater reserve" : "Sett som reserve"}
          </button>
          {reserve && (
            <button
              type="button"
              className={styles.fjern}
              onClick={() => {
                onFjern();
                setOpen(false);
              }}
            >
              Fjern reserve
            </button>
          )}
        </div>
      )}
    </div>
  );
}
