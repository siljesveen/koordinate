"use client";

import { fullNavn, type Ansatt } from "@/lib/domain";
import {
  byggSjåførNavnPerKjoretoy,
  navnMatcherSøk,
} from "@/lib/utils/kjoretoySjaførSøk";
import { compareNb } from "@/lib/utils/sort";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import styles from "./SokbarVelger.module.css";

/** Når satt: søk på sjåførnavn finner vedkommendes faste bil/henger. */
export type KjoretoySøkMedAnsatte = {
  ansatte: Ansatt[];
  fastIdFraAnsatt: (a: Ansatt) => string | undefined;
  /** F.eks. masterplan: standardSjåfør + standardBil på samme rute. */
  ekstraSjåførPerKjoretoy?: ReadonlyMap<string, string> | Record<string, string>;
  /** Vis reg.nr for treff som ikke er i options-listen (f.eks. inaktiv bil). */
  etikettForId?: (kjoretoyId: string) => string | undefined;
};

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
  /** Søk på sjåførnavn finner vedkommendes faste bil/henger. */
  kjoretoySøkMedAnsatte?: KjoretoySøkMedAnsatte;
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
  kjoretoySøkMedAnsatte,
}: SokbarVelgerProps) {
  const [åpen, setÅpen] = useState(false);
  const [søk, setSøk] = useState("");
  const [panelRect, setPanelRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const rotRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const søkRef = useRef<HTMLInputElement>(null);

  const ansatteForSøk = kjoretoySøkMedAnsatte?.ansatte;
  const ekstraSjåførKob = kjoretoySøkMedAnsatte?.ekstraSjåførPerKjoretoy;

  const sjåførNavnPerKjoretoy = useMemo(() => {
    if (!kjoretoySøkMedAnsatte || !ansatteForSøk) return new Map<string, string>();
    return byggSjåførNavnPerKjoretoy(
      ansatteForSøk,
      kjoretoySøkMedAnsatte.fastIdFraAnsatt,
      ekstraSjåførKob,
    );
  }, [kjoretoySøkMedAnsatte, ansatteForSøk, ekstraSjåførKob]);

  const sorterte = useMemo(
    () => [...options].sort((a, b) => compareNb(a.label, b.label)),
    [options],
  );

  const filtrert = useMemo(() => {
    const q = søk.trim().toLowerCase();
    if (!q) return sorterte;
    const qKompakt = q.replace(/\s+/g, "");
    const treffIds = new Set<string>();

    for (const o of sorterte) {
      const label = o.label.toLowerCase();
      const ekstra = (o.søkTekst ?? o.label).toLowerCase();
      const sjåfør = (sjåførNavnPerKjoretoy.get(o.value) ?? "").toLowerCase();
      if (
        label.includes(q) ||
        ekstra.includes(q) ||
        sjåfør.includes(q) ||
        label.replace(/\s+/g, "").includes(qKompakt) ||
        ekstra.replace(/\s+/g, "").includes(qKompakt) ||
        sjåfør.replace(/\s+/g, "").includes(qKompakt)
      ) {
        treffIds.add(o.value);
      }
    }

    if (kjoretoySøkMedAnsatte) {
      for (const a of kjoretoySøkMedAnsatte.ansatte) {
        if (a.aktiv === false) continue;
        if (!navnMatcherSøk(a, søk)) continue;
        const id = kjoretoySøkMedAnsatte.fastIdFraAnsatt(a);
        if (id) treffIds.add(id);
      }

      const ekstra = kjoretoySøkMedAnsatte.ekstraSjåførPerKjoretoy;
      if (ekstra) {
        const entries =
          ekstra instanceof Map ? ekstra.entries() : Object.entries(ekstra);
        for (const [id, navn] of entries) {
          const nl = navn.toLowerCase();
          if (
            nl.includes(q) ||
            nl.replace(/\s+/g, "").includes(qKompakt) ||
            q.split(/\s+/).every((o) => o && nl.includes(o))
          ) {
            treffIds.add(id);
          }
        }
      }
    }

    const fraOptions = sorterte.filter((o) => treffIds.has(o.value));
    const med = new Set(fraOptions.map((o) => o.value));

    if (kjoretoySøkMedAnsatte?.etikettForId) {
      for (const id of treffIds) {
        if (med.has(id)) continue;
        const label = kjoretoySøkMedAnsatte.etikettForId(id);
        if (label) {
          fraOptions.push({ value: id, label });
          med.add(id);
        }
      }
    }

    return fraOptions.sort((a, b) => compareNb(a.label, b.label));
  }, [sorterte, søk, kjoretoySøkMedAnsatte, sjåførNavnPerKjoretoy]);

  const effektivPlaceholder =
    søkPlaceholder === "Søk…" && kjoretoySøkMedAnsatte
      ? "Søk sjåfør eller reg.nr…"
      : søkPlaceholder;

  const visningLabel = useMemo(() => {
    if (value === tomVerdi) return tomLabel;
    const fraListe = sorterte.find((o) => o.value === value)?.label;
    if (fraListe) return fraListe;
    const fraId = kjoretoySøkMedAnsatte?.etikettForId?.(value);
    if (fraId) return fraId;
    return tomLabel;
  }, [value, sorterte, tomVerdi, tomLabel, kjoretoySøkMedAnsatte]);

  const viserSøk = søk.trim().length > 0;
  const visTomRad = visTom && !(kjoretoySøkMedAnsatte && viserSøk);

  function oppdaterPanelPos() {
    const el = rotRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPanelRect({
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 10 * 16),
    });
  }

  useLayoutEffect(() => {
    if (!åpen) {
      setPanelRect(null);
      return;
    }
    oppdaterPanelPos();
  }, [åpen]);

  useEffect(() => {
    if (!åpen) return;
    const t = window.setTimeout(() => søkRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [åpen]);

  useEffect(() => {
    if (!åpen) return;
    function lukk(e: MouseEvent) {
      const target = e.target as Node;
      if (rotRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setÅpen(false);
      setSøk("");
    }
    document.addEventListener("mousedown", lukk);
    return () => document.removeEventListener("mousedown", lukk);
  }, [åpen]);

  useEffect(() => {
    if (!åpen) return;
    function påScroll() {
      oppdaterPanelPos();
    }
    window.addEventListener("scroll", påScroll, true);
    window.addEventListener("resize", påScroll);
    return () => {
      window.removeEventListener("scroll", påScroll, true);
      window.removeEventListener("resize", påScroll);
    };
  }, [åpen]);

  function lukkOgNullstill() {
    setÅpen(false);
    setSøk("");
  }

  function velg(nyVerdi: string) {
    onChange(nyVerdi);
    lukkOgNullstill();
  }

  const panelStyle = useMemo((): CSSProperties | undefined => {
    if (!åpen) return undefined;
    if (panelRect) {
      return {
        position: "fixed",
        top: panelRect.top,
        left: panelRect.left,
        width: panelRect.width,
        zIndex: 10000,
      };
    }
    const el = rotRef.current;
    if (!el) return { position: "fixed", visibility: "hidden", zIndex: 10000 };
    const rect = el.getBoundingClientRect();
    return {
      position: "fixed",
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 10 * 16),
      zIndex: 10000,
    };
  }, [åpen, panelRect]);

  const panelInnhold = (
    <div
      ref={panelRef}
      className={styles.panelPortal}
      onMouseDown={(e) => e.stopPropagation()}
      style={panelStyle}
      role="listbox"
    >
      <div className={styles.søkWrap}>
        <input
          ref={søkRef}
          type="search"
          className={styles.søk}
          value={søk}
          onChange={(e) => setSøk(e.target.value)}
          placeholder={effektivPlaceholder}
          aria-label={ariaLabel}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") lukkOgNullstill();
          }}
        />
      </div>

      <div className={styles.liste}>
            {visTomRad ? (
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
  );

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

      {åpen && typeof document !== "undefined"
        ? createPortal(panelInnhold, document.body)
        : null}
    </div>
  );
}
