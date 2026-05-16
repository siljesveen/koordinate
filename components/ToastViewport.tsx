"use client";

import { useToastStore } from "@/lib/state/toastStore";
import styles from "./ToastViewport.module.css";

export default function ToastViewport() {
  const { toasts, fjern } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.viewport} aria-live="polite" aria-label="Varsler">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${t.variant === "success" ? styles.toastSuccess : ""}`}
          role="status"
        >
          <span className={styles.message}>{t.message}</span>
          <button
            type="button"
            className={styles.close}
            onClick={() => fjern(t.id)}
            aria-label="Lukk varsel"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
