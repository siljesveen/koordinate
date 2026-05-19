"use client";

import { useAuth } from "@/lib/state/authStore";
import styles from "./DataReadyGate.module.css";

export default function DataReadyGate({ children }: { children: React.ReactNode }) {
  const { configured, loading, dataReady } = useAuth();

  if (configured && (loading || !dataReady)) {
    return (
      <div className={styles.wrap} role="status" aria-live="polite">
        <p className={styles.text}>Laster data …</p>
      </div>
    );
  }

  return <>{children}</>;
}
