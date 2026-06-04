"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./BekreftDialog.module.css";

type Props = {
  melding: string;
  bekreftTekst?: string;
  avbrytTekst?: string;
  onBekreft: () => void;
  onAvbryt: () => void;
};

export default function BekreftDialog({
  melding,
  bekreftTekst = "OK",
  avbrytTekst = "Avbryt",
  onBekreft,
  onAvbryt,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const bekreftRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    bekreftRef.current?.focus();
  }, [mounted]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onAvbryt();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onAvbryt]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onAvbryt();
      }}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bekreft-dialog-melding"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            onBekreft();
          }}
        >
          <p id="bekreft-dialog-melding" className={styles.melding}>
            {melding}
          </p>
          <div className={styles.knapper}>
            <button type="button" onClick={onAvbryt} className={styles.avbryt}>
              {avbrytTekst}
            </button>
            <button ref={bekreftRef} type="submit" className={styles.bekreft}>
              {bekreftTekst}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
