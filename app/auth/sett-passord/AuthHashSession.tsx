"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "../../login/page.module.css";

type Status = "idle" | "working" | "error";

/**
 * Noen nettlesere får access_token i URL-hash etter e-postlenke.
 * Serveren ser ikke hashen — den må behandles her i nettleseren.
 */
export function AuthHashSession() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const token_hash = query.get("token_hash");
    const type = query.get("type");
    if (token_hash && type) {
      const params = query.toString();
      window.location.replace(`/auth/aktiver?${params}`);
      return;
    }

    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return;

    const params = new URLSearchParams(hash.substring(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;

    setStatus("working");
    const supabase = createClient();
    void supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setStatus("error");
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
        router.refresh();
      });
  }, [router]);

  if (status === "working") {
    return <p className={styles.hint}>Aktiverer lenken …</p>;
  }
  if (status === "error") {
    return (
      <p className={styles.error}>
        Lenken kunne ikke aktiveres. Be administrator om ny invitasjon eller passordlenke.
      </p>
    );
  }
  return null;
}
