"use client";

import { compareNb } from "@/lib/utils/sort";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SokbarVelger.module.css";

export type SokbarVelgerValg = {
  value: string;
  label: string;
  søkTekst?: string;
  hint?: string;
};

type SokbarVelgerProps = {
  value: string;
  onChange: (value: string) => void;
  options: SokbarVelgerValg[];
  ariaLabel: string;
  tomVerdi?: string;
  tomLabel?: string;
  søkPlaceholder?: string;
  tomTreffTekst?: string;
  compact?: boolean;
  className?: string;
  /** Vis «—» / tom-rad øverst i listen (default true). */
  visTom?: boolean;
};

export default function SokbarVelger({
  value,
  onChange,
  options,
  ariaLabel,
  tomVerdi = "",
  tomLabel = "—",
  søkPlaceholder = "Søk…",
  tomTreffTekst = "Ingen treff",
  compact = false,
  className,
  visTom = true,
}: SokbarVelgerProps) {
  const [åpen, setÅpen] = useState(false);
  const [søk, setSøk] = useState("");
  const rotRef = useRef<HTMLDivElement>(null);
  const søkRef = useRef<HTMLInputElement>(null);

  const sorterte = useMemo(
    () => [...options].sort((a, b) => compareNb(a.label, b.label)),
    [options],
  );

  const filtrert = useMemo(() => {
    const q = søk.trim().toLowerCase();
    if (!q) return sorterte;
    const qKompakt = q.replace(/\s+/g, "");
    return sorterte.filter((o) => {
      const label = o.label.toLowerCase();
      const ekstra = (o.søkTekst ?? o.label).toLowerCase();
      return (
        label.includes(q) ||
        ekstra.includes(q) ||
        label.replace(/\s+/g, "").includes(qKompakt) ||
        ekstra.replace(/\s+/g, "").includes(qKompakt)
      );
    });
  }, [sorterte, søk]);

  const visningLabel = useMemo(() => {
    if (value === tomVerdi) return tomLabel;
    return sorterte.find((o) => o.value === value)?.label ?? tomLabel;
  }, [value, sorterte, tomVerdi, tomLabel]);

  useEffect(() => {
    if (!åpen) return;
    const t = window.setTimeout(() => søkRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [åpen]);

  useEffect(() => {
    if (!åpen) return;
    function lukk(e: MouseEvent) {
      if (rotRef.current && !rotRef.current.contains(e.target as Node)) {
        setÅpen(false);
        setSøk("");
      }
    }
    document.addEventListener("mousedown", lukk);
    return () => document.removeEventListener("mousedown", lukk);
  }, [åpen]);

  function lukkOgNullstill() {
    setÅpen(false);
    setSøk("");
  }

  function velg(nyVerdi: string) {
    onChange(nyVerdi);
    lukkOgNullstill();
  }

  return (
    <div className={`${styles.wrap} ${className ?? ""}`} ref={rotRef}>
      <button
        type="button"
        className={`${styles.trigger} ${åpen ? styles.triggerOpen : ""} ${compact ? styles.triggerCompact : ""}`}
        aria-haspopup="listbox"
        aria-expanded={åpen}
        aria-label={ariaLabel}
        onClick={() => setÅpen((o) => !o)}
      >
        <span className={styles.value}>{visningLabel}</span>
        <span className={styles.chevron} aria-hidden>
          ▾
        </span>
      </button>

      {åpen ? (
        <div className={styles.panel} role="listbox">
          <div className={styles.søkWrap}>
            <input
              ref={søkRef}
              type="search"
              className={styles.søk}
              value={søk}
              onChange={(e) => setSøk(e.target.value)}
              placeholder={søkPlaceholder}
              aria-label={ariaLabel}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") lukkOgNullstill();
              }}
            />
          </div>

          <div className={styles.liste}>
            {visTom ? (
              <button
                type="button"
                role="option"
                aria-selected={value === tomVerdi}
                className={`${styles.item} ${value === tomVerdi ? styles.itemSelected : ""}`}
                onClick={() => velg(tomVerdi)}
              >
                <span className={styles.label}>{tomLabel}</span>
              </button>
            ) : null}

            {filtrert.length === 0 ? (
              <div className={styles.tom}>{tomTreffTekst}</div>
            ) : (
              filtrert.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  className={`${styles.item} ${value === o.value ? styles.itemSelected : ""}`}
                  onClick={() => velg(o.value)}
                >
                  <span className={styles.label}>{o.label}</span>
                  {o.hint ? <span className={styles.hint}>{o.hint}</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
