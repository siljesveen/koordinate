"use client";

import { useEffect } from "react";
import {
  dagsFraværOversiktTotalt,
  formatPlanDato,
  type DagsFraværOversikt,
} from "@/lib/plan/dagsFraværOversikt";
import styles from "./DagsFraværOversiktModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  dato: string;
  oversikt: DagsFraværOversikt;
};

export default function DagsFraværOversiktModal({ open, onClose, dato, oversikt }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const totalt = dagsFraværOversiktTotalt(oversikt);
  const { ansatte, biler, hengere } = oversikt;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Fravær og utilgjengelighet ${dato}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>Dagsoversikt</h2>
            <p className={styles.subtitle}>{formatPlanDato(dato)}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Lukk">
            ×
          </button>
        </header>

        <div className={styles.summary}>
          <span>{totalt} registrert utilgjengelig</span>
          <span>{ansatte.length} sjåfør</span>
          <span>{biler.length} bil</span>
          <span>{hengere.length} henger</span>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Sjåfører ({ansatte.length})</h3>
            {ansatte.length === 0 ? (
              <p className={styles.empty}>Ingen registrert fravær eller avspasering.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Navn</th>
                    <th>Type</th>
                    <th>Periode</th>
                    <th>Kommentar</th>
                  </tr>
                </thead>
                <tbody>
                  {ansatte.map((r) => (
                    <tr key={r.id}>
                      <td>{r.navn}</td>
                      <td>{r.type}</td>
                      <td className={styles.muted}>{r.periode}</td>
                      <td className={styles.muted}>{r.kommentar ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Biler ute ({biler.length})</h3>
            {biler.length === 0 ? (
              <p className={styles.empty}>Ingen bil utilgjengelig denne dagen.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Kjøretøy</th>
                    <th>Årsak</th>
                    <th>Periode</th>
                    <th>Planlagt</th>
                  </tr>
                </thead>
                <tbody>
                  {biler.map((r) => (
                    <tr key={r.id}>
                      <td>{r.etikett}</td>
                      <td>{r.type}</td>
                      <td className={styles.muted}>{r.periode}</td>
                      <td>{r.planlagt ? "Ja" : "Nei"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Hengere ute ({hengere.length})</h3>
            {hengere.length === 0 ? (
              <p className={styles.empty}>Ingen henger utilgjengelig denne dagen.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Kjøretøy</th>
                    <th>Årsak</th>
                    <th>Periode</th>
                    <th>Planlagt</th>
                  </tr>
                </thead>
                <tbody>
                  {hengere.map((r) => (
                    <tr key={r.id}>
                      <td>{r.etikett}</td>
                      <td>{r.type}</td>
                      <td className={styles.muted}>{r.periode}</td>
                      <td>{r.planlagt ? "Ja" : "Nei"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.okBtn} onClick={onClose}>
            Lukk
          </button>
        </footer>
      </div>
    </div>
  );
}
