"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { BilPerioderTab } from "./BilPerioderTab";
import { HengerPerioderTab } from "./HengerPerioderTab";
import styles from "./page.module.css";
import { VerkstedKalenderTab } from "./VerkstedKalenderTab";

const TABS = [
  { id: "kalender", label: "Kalender" },
  { id: "biler", label: "Perioder · biler" },
  { id: "hengere", label: "Hengere" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(raw: string | null): TabId {
  if (raw === "biler" || raw === "hengere" || raw === "kalender") return raw;
  return "kalender";
}

function VerkstedPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const setTab = useCallback(
    (id: TabId) => {
      router.push(id === "kalender" ? "/verksted" : `/verksted?tab=${id}`);
    },
    [router],
  );

  return (
    <div className={styles.page}>
      <header className={styles.shellHeader}>
        <h1 className={styles.title}>Verksted</h1>
        <nav className={styles.tabs} aria-label="Verksted">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {tab === "kalender" ? <VerkstedKalenderTab /> : null}
      {tab === "biler" ? <BilPerioderTab /> : null}
      {tab === "hengere" ? <HengerPerioderTab /> : null}
    </div>
  );
}

export default function VerkstedPage() {
  return (
    <Suspense fallback={<div className={styles.page}>Laster …</div>}>
      <VerkstedPageInner />
    </Suspense>
  );
}
