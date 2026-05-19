"use client";

import { useAuth } from "@/lib/state/authStore";
import { usePathname } from "next/navigation";
import styles from "./DataReadyGate.module.css";

const PUBLIC_PREFIXES = ["/login", "/auth"];

export default function DataReadyGate({ children }: { children: React.ReactNode }) {
  const { configured, loading, dataReady } = useAuth();
  const pathname = usePathname();
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isPublic) {
    return <>{children}</>;
  }

  if (configured && (loading || !dataReady)) {
    return (
      <div className={styles.wrap} role="status" aria-live="polite">
        <p className={styles.text}>Laster data …</p>
      </div>
    );
  }

  return <>{children}</>;
}
