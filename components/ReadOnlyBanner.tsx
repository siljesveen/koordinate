"use client";

import { useAuth } from "@/lib/state/authStore";
import styles from "./SkySaveBanner.module.css";

export default function ReadOnlyBanner() {
  const { profile, configured, canEdit } = useAuth();

  if (!configured || !profile || canEdit) return null;

  return (
    <div className={styles.ok} role="status">
      Kun visning — du kan se data, men ikke lagre endringer.
    </div>
  );
}
