"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { fullNavn, type Ansatt, type Bil, type Henger } from "@/lib/domain";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useBilStore } from "@/lib/state/bilStore";
import { useHengerStore } from "@/lib/state/hengerStore";
import { useMasterplanStore } from "@/lib/state/masterplanStore";
import { navnMatcherSøk } from "@/lib/utils/kjoretoySjaførSøk";
import { compareRutekode } from "@/lib/utils/sort";
import { kjoretoyMatcherSøk, tekstMatcherSøk } from "@/lib/utils/søkMatch";
import styles from "./GlobalSøk.module.css";

type SøkKind = "rute" | "ansatt" | "bil" | "henger";

type SøkTreff = {
  kind: SøkKind;
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  søkBlob: string;
};

const KIND_LABEL: Record<SøkKind, string> = {
  rute: "Rute",
  ansatt: "Ansatt",
  bil: "Bil",
  henger: "Henger",
};

function byggIndeks(
  ansatte: Ansatt[],
  biler: Bil[],
  hengere: Henger[],
  ansattById: Map<string, Ansatt>,
  bilById: Map<string, Bil>,
  hengerById: Map<string, Henger>,
  slots: { rutekode: string; skift: string; rutenavn?: string; standardSjåførAnsattId?: string; standardBilId?: string; standardHengerId?: string }[],
): SøkTreff[] {
  const treff: SøkTreff[] = [];

  for (const a of ansatte) {
    const bil = a.fastBilId ? bilById.get(a.fastBilId) : undefined;
    const henger = a.fastHengerId ? hengerById.get(a.fastHengerId) : undefined;
    const blob = [
      fullNavn(a),
      a.telefon,
      a.epost,
      a.selskap,
      bil?.kjennemerke,
      henger?.kjennemerke,
    ]
      .filter(Boolean)
      .join(" ");
    treff.push({
      kind: "ansatt",
      id: a.id,
      label: fullNavn(a),
      sublabel: [bil?.kjennemerke, henger?.kjennemerke].filter(Boolean).join(" · ") || undefined,
      href: `/ansatte?søk=${encodeURIComponent(fullNavn(a))}`,
      søkBlob: blob,
    });
  }

  for (const b of biler) {
    const sjåfører = ansatte
      .filter((a) => a.fastBilId === b.id)
      .map((a) => fullNavn(a));
    const blob = [b.kjennemerke, b.merke, b.modell, b.tilhørighet, ...sjåfører]
      .filter(Boolean)
      .join(" ");
    treff.push({
      kind: "bil",
      id: b.id,
      label: b.kjennemerke,
      sublabel:
        [b.merke, b.modell, b.tilhørighet, sjåfører.join(", ")].filter(Boolean).join(" · ") ||
        undefined,
      href: `/biler?søk=${encodeURIComponent(b.kjennemerke)}`,
      søkBlob: blob,
    });
  }

  for (const h of hengere) {
    const sjåfører = ansatte
      .filter((a) => a.fastHengerId === h.id)
      .map((a) => fullNavn(a));
    const blob = [h.kjennemerke, h.type, ...sjåfører].filter(Boolean).join(" ");
    treff.push({
      kind: "henger",
      id: h.id,
      label: h.kjennemerke,
      sublabel: [h.type, sjåfører.join(", ")].filter(Boolean).join(" · ") || undefined,
      href: `/henger?søk=${encodeURIComponent(h.kjennemerke)}`,
      søkBlob: blob,
    });
  }

  // Aggreger per rutekode + skift, så alle sjåfører/biler/hengere gjennom
  // hele syklusen (uke 1–4, dag 1–7) blir søkbare – ikke bare første slot.
  type RuteAgg = {
    rutekode: string;
    skift: string;
    rutenavn?: string;
    sjåfører: Set<string>;
    biler: Set<string>;
    hengere: Set<string>;
  };
  const ruteAgg = new Map<string, RuteAgg>();
  for (const slot of slots) {
    const key = `${slot.rutekode}|${slot.skift}`;
    let agg = ruteAgg.get(key);
    if (!agg) {
      agg = {
        rutekode: slot.rutekode,
        skift: slot.skift,
        rutenavn: slot.rutenavn,
        sjåfører: new Set(),
        biler: new Set(),
        hengere: new Set(),
      };
      ruteAgg.set(key, agg);
    }
    if (!agg.rutenavn && slot.rutenavn) agg.rutenavn = slot.rutenavn;
    if (slot.standardSjåførAnsattId) agg.sjåfører.add(slot.standardSjåførAnsattId);
    if (slot.standardBilId) agg.biler.add(slot.standardBilId);
    if (slot.standardHengerId) agg.hengere.add(slot.standardHengerId);
  }

  for (const agg of [...ruteAgg.values()].sort((a, b) => compareRutekode(a.rutekode, b.rutekode))) {
    const sjNavn = [...agg.sjåfører]
      .map((id) => ansattById.get(id))
      .filter((a): a is Ansatt => !!a)
      .map((a) => fullNavn(a));
    const bilKjenn = [...agg.biler]
      .map((id) => bilById.get(id)?.kjennemerke)
      .filter((k): k is string => !!k);
    const hengerKjenn = [...agg.hengere]
      .map((id) => hengerById.get(id)?.kjennemerke)
      .filter((k): k is string => !!k);

    const blob = [agg.rutekode, agg.rutenavn, agg.skift, ...sjNavn, ...bilKjenn, ...hengerKjenn]
      .filter(Boolean)
      .join(" ");

    treff.push({
      kind: "rute",
      id: `${agg.rutekode}|${agg.skift}`,
      label: `${agg.rutekode} · ${agg.skift}`,
      sublabel: [agg.rutenavn, sjNavn.join(", "), bilKjenn.join(", ")]
        .filter(Boolean)
        .join(" · ") || undefined,
      href: `/plan?søk=${encodeURIComponent(agg.rutekode)}`,
      søkBlob: blob,
    });
  }

  return treff;
}

function matcherTreff(treff: SøkTreff, søk: string, ansattById: Map<string, Ansatt>): boolean {
  if (tekstMatcherSøk(treff.søkBlob, søk)) return true;
  if (treff.kind === "ansatt") {
    const a = ansattById.get(treff.id);
    if (a && navnMatcherSøk(a, søk)) return true;
  }
  return false;
}

export default function GlobalSøk() {
  const router = useRouter();
  const { ansatte } = useAnsattStore();
  const { biler } = useBilStore();
  const { hengere } = useHengerStore();
  const { masterplan } = useMasterplanStore();

  const [åpen, setÅpen] = useState(false);
  const [søk, setSøk] = useState("");
  const [markert, setMarkert] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelRect, setPanelRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const visPanel = åpen && søk.trim().length > 0;

  function oppdaterPanelPos() {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPanelRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 18 * 16),
    });
  }

  const ansattById = useMemo(
    () => new Map(ansatte.map((a) => [a.id, a] as const)),
    [ansatte],
  );
  const bilById = useMemo(() => new Map(biler.map((b) => [b.id, b] as const)), [biler]);
  const hengerById = useMemo(
    () => new Map(hengere.map((h) => [h.id, h] as const)),
    [hengere],
  );

  const indeks = useMemo(
    () => byggIndeks(ansatte, biler, hengere, ansattById, bilById, hengerById, masterplan.slots),
    [ansatte, biler, hengere, ansattById, bilById, hengerById, masterplan.slots],
  );

  const treff = useMemo(() => {
    const q = søk.trim();
    if (!q) return [];
    return indeks
      .filter((t) => matcherTreff(t, q, ansattById))
      .slice(0, 12);
  }, [indeks, søk, ansattById]);

  const grupperte = useMemo(() => {
    const grupper: Partial<Record<SøkKind, SøkTreff[]>> = {};
    for (const t of treff) {
      (grupper[t.kind] ??= []).push(t);
    }
    return grupper;
  }, [treff]);

  const flatListe = useMemo(() => treff, [treff]);

  const velg = useCallback(
    (t: SøkTreff) => {
      setÅpen(false);
      setSøk("");
      router.push(t.href);
    },
    [router],
  );

  useLayoutEffect(() => {
    if (!visPanel) {
      setPanelRect(null);
      return;
    }
    oppdaterPanelPos();
  }, [visPanel, søk]);

  useEffect(() => {
    if (!visPanel) return;
    function påScroll() {
      oppdaterPanelPos();
    }
    window.addEventListener("scroll", påScroll, true);
    window.addEventListener("resize", påScroll);
    return () => {
      window.removeEventListener("scroll", påScroll, true);
      window.removeEventListener("resize", påScroll);
    };
  }, [visPanel]);

  useEffect(() => {
    setMarkert(0);
  }, [søk]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setÅpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (e.key === "Escape") setÅpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!visPanel) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setÅpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [visPanel]);

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarkert((i) => Math.min(i + 1, flatListe.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarkert((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatListe[markert]) {
      e.preventDefault();
      velg(flatListe[markert]);
    }
  }

  let flatIdx = 0;

  const panelStyle = useMemo((): CSSProperties | undefined => {
    if (!visPanel) return undefined;
    if (panelRect) {
      return {
        position: "fixed",
        top: panelRect.top,
        left: panelRect.left,
        width: panelRect.width,
        zIndex: 10000,
      };
    }
    const el = wrapRef.current;
    if (!el) return { position: "fixed", visibility: "hidden", zIndex: 10000 };
    const rect = el.getBoundingClientRect();
    return {
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 18 * 16),
      zIndex: 10000,
    };
  }, [visPanel, panelRect]);

  const panelInnhold = (
    <div
      id="global-sok-panel"
      ref={panelRef}
      className={styles.panelPortal}
      style={panelStyle}
      role="listbox"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {flatListe.length === 0 ? (
        <div className={styles.tom}>Ingen treff på «{søk.trim()}»</div>
      ) : (
        (["rute", "ansatt", "bil", "henger"] as SøkKind[]).map((kind) => {
          const liste = grupperte[kind];
          if (!liste?.length) return null;
          return (
            <div key={kind} className={styles.gruppe}>
              <div className={styles.gruppeTittel}>{KIND_LABEL[kind]}</div>
              {liste.map((t) => {
                const idx = flatIdx++;
                return (
                  <button
                    key={`${t.kind}-${t.id}`}
                    type="button"
                    role="option"
                    aria-selected={idx === markert}
                    className={`${styles.treff} ${idx === markert ? styles.treffMarkert : ""}`}
                    onMouseEnter={() => setMarkert(idx)}
                    onClick={() => velg(t)}
                  >
                    <span className={styles.treffLabel}>{t.label}</span>
                    {t.sublabel ? (
                      <span className={styles.treffSub}>{t.sublabel}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        ref={inputRef}
        type="search"
        className={styles.input}
        placeholder="Søk rute, navn, bil, henger…"
        aria-label="Globalt søk"
        aria-expanded={visPanel}
        aria-controls="global-sok-panel"
        value={søk}
        onChange={(e) => {
          setSøk(e.target.value);
          setÅpen(true);
        }}
        onFocus={() => setÅpen(true)}
        onKeyDown={onInputKeyDown}
      />
      {visPanel && typeof document !== "undefined"
        ? createPortal(panelInnhold, document.body)
        : null}
    </div>
  );
}
