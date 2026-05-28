"use client";

import { useEffect, useRef } from "react";
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    el?.showModal();
    return () => {
      el?.close();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onAvbryt}>
      <p className={styles.melding}>{melding}</p>
      <div className={styles.knapper}>
        <button type="button" onClick={onAvbryt} className={styles.avbryt}>
          {avbrytTekst}
        </button>
        <button type="button" onClick={onBekreft} className={styles.bekreft}>
          {bekreftTekst}
        </button>
      </div>
    </dialog>
  );
}
