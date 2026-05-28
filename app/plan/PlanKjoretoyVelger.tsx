"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fullNavn, type Ansatt } from "@/lib/domain";
import { useBekreftDialog } from "@/components/useBekreftDialog";
import styles from "./page.module.css";

export type PlanKjoretoyItem = {
  id: string;
  kjennemerke: string;
};

type PlanKjoretoyVelgerProps = {
  rute: string;
  selectValue: string;
  onSelect: (value: string) => void;
  valgbare: PlanKjoretoyItem[];
  byId: Map<string, PlanKjoretoyItem>;
  ansatte: Ansatt[];
  fastKjoretoyId: (a: Ansatt) => string | undefined;
  erLedig: (kjoretoyId: string, rute: string) => boolean;
  statusEtikett: (kjoretoyId: string) => string;
  baselineKjennemerke?: string;
  /** Masterplanens kjøretøy for ruten — brukes til grønn markering (også ved eksplisitt valg av samme id). */
  fraMasterKjoretoyId?: string;
  /** Master-kjøretøy har verksted/utilgjengelig periode denne dagen (uavhengig av disponibilitet). */
  masterPaVerksted?: boolean;
  masterPaVerkstedGrunn?: string;
  ekstraValgId?: string;
  ekstraValgEtikett?: string;
  søkPlaceholder?: string;
  søkTomTekst?: string;
  ariaLabel: string;
};

type SøkTreff = {
  item: PlanKjoretoyItem;
  ledig: boolean;
  status: string;
};

type ListeValg =
  | { kind: "ingen" }
  | { kind: "baseline" }
  | { kind: "kjoretoy"; id: string; label: string; ledig: boolean; status?: string };

export default function PlanKjoretoyVelger({
  rute,
  selectValue,
  onSelect,
  valgbare,
  byId,
  ansatte,
  fastKjoretoyId,
  erLedig,
  statusEtikett,
  baselineKjennemerke,
  fraMasterKjoretoyId,
  masterPaVerksted,
  masterPaVerkstedGrunn,
  ekstraValgId,
  ekstraValgEtikett,
  søkPlaceholder = "Søk sjåfør eller reg.nr…",
  søkTomTekst = "Ingen treff for søket",
  ariaLabel,
}: PlanKjoretoyVelgerProps) {
  const { requestBekreft, dialog: bekreftDialog } = useBekreftDialog();
  const [åpen, setÅpen] = useState(false);
  const [søk, setSøk] = useState("");
  const rotRef = useRef<HTMLDivElement>(null);
  const søkRef = useRef<HTMLInputElement>(null);

  /** Kun i søkelisten — ikke i valgt verdi på ruten. */
  function kortStatusForSøk(kjoretoyId: string, ledig: boolean): string {
    if (ledig) return "Ledig";
    const grunn = statusEtikett(kjoretoyId);
    if (grunn === "Planlagt" || grunn === "Flerdagstur") return "Planlagt";
    return "Verksted";
  }

  const søkTreff = useMemo((): SøkTreff[] => {
    const qNavn = søk.trim().toLowerCase();
    const qReg = qNavn.replace(/\s+/g, "");
    if (!qNavn) return [];

    const sett = new Set<string>();
    const treff: SøkTreff[] = [];

    function leggTil(kjoretoyId: string) {
      if (sett.has(kjoretoyId)) return;
      const item = byId.get(kjoretoyId);
      if (!item) return;
      sett.add(kjoretoyId);
      const ledig = erLedig(kjoretoyId, rute);
      treff.push({
        item,
        ledig,
        status: kortStatusForSøk(kjoretoyId, ledig),
      });
    }

    for (const a of ansatte) {
      if (!a.aktiv) continue;
      if (!fullNavn(a).toLowerCase().includes(qNavn)) continue;
      const kjoretoyId = fastKjoretoyId(a);
      if (kjoretoyId) leggTil(kjoretoyId);
    }

    for (const item of byId.values()) {
      const reg = item.kjennemerke.toLowerCase().replace(/\s+/g, "");
      if (qReg && reg.includes(qReg)) leggTil(item.id);
    }

    return treff.sort((a, b) =>
      a.item.kjennemerke.localeCompare(b.item.kjennemerke, "nb", { numeric: true }),
    );
  }, [søk, ansatte, fastKjoretoyId, byId, erLedig, rute]);

  const visSøk = søk.trim().length > 0;

  const standardValg = useMemo((): ListeValg[] => {
    /** Alltid øverst når ruten har master-kjøretøy — også etter «—» (skjul baseline). */
    const visMasterReferanse = Boolean(fraMasterKjoretoyId && baselineKjennemerke);
    const liste: ListeValg[] = [];
    if (visMasterReferanse) {
      liste.push({ kind: "baseline" });
    }
    liste.push({ kind: "ingen" });
    if (
      ekstraValgId &&
      selectValue === ekstraValgId &&
      !valgbare.some((x) => x.id === ekstraValgId)
    ) {
      const alleredeSomMasterRad =
        fraMasterKjoretoyId && ekstraValgId === fraMasterKjoretoyId;
      if (!alleredeSomMasterRad) {
        const item = byId.get(ekstraValgId);
        liste.push({
          kind: "kjoretoy",
          id: ekstraValgId,
          label: item?.kjennemerke ?? ekstraValgId,
          ledig: false,
        });
      }
    }
    const valgbareSortert = [...valgbare].sort((a, b) =>
      a.kjennemerke.localeCompare(b.kjennemerke, "nb", { numeric: true }),
    );
    for (const item of valgbareSortert) {
      if (visMasterReferanse && item.id === fraMasterKjoretoyId) continue;
      liste.push({
        kind: "kjoretoy",
        id: item.id,
        label: item.kjennemerke,
        ledig: true,
      });
    }
    return liste;
  }, [
    baselineKjennemerke,
    ekstraValgId,
    selectValue,
    valgbare,
    byId,
    fraMasterKjoretoyId,
  ]);

  const visningLabel = useMemo(() => {
    if (selectValue === "__ingen__") return "—";
    if (selectValue === "__baseline__" && baselineKjennemerke) {
      return baselineKjennemerke;
    }
    return byId.get(selectValue)?.kjennemerke ?? "—";
  }, [selectValue, baselineKjennemerke, byId]);

  const visningFraMaster = useMemo(() => {
    if (selectValue === "__baseline__") return true;
    if (fraMasterKjoretoyId && selectValue === fraMasterKjoretoyId) return true;
    return false;
  }, [selectValue, fraMasterKjoretoyId]);

  /** Gul ramme kun når valgt bil faktisk er utilgjengelig — ikke bare fordi master er på verksted. */
  const valgtViserVerksted = useMemo(() => {
    if (selectValue === "__ingen__") return false;
    if (selectValue === "__baseline__") return Boolean(masterPaVerksted);
    if (fraMasterKjoretoyId && selectValue === fraMasterKjoretoyId) {
      return Boolean(masterPaVerksted);
    }
    return !erLedig(selectValue, rute);
  }, [selectValue, masterPaVerksted, fraMasterKjoretoyId, erLedig, rute]);

  function erFraMasterKjoretoy(kjoretoyId: string): boolean {
    return Boolean(fraMasterKjoretoyId && kjoretoyId === fraMasterKjoretoyId);
  }

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

  async function velg(verdi: string, kjoretoyIdForBekreft?: string) {
    if (kjoretoyIdForBekreft && !erLedig(kjoretoyIdForBekreft, rute)) {
      const kj = byId.get(kjoretoyIdForBekreft)?.kjennemerke ?? kjoretoyIdForBekreft;
      const ok = await requestBekreft(
        `${kj} er ${statusEtikett(kjoretoyIdForBekreft).toLowerCase()}. Vil du tildele til rute ${rute} likevel?`,
      );
      if (!ok) return;
    }
    onSelect(verdi);
    lukkOgNullstill();
  }

  function velgFraListe(valg: ListeValg) {
    if (valg.kind === "ingen") velg("__ingen__");
    else if (valg.kind === "baseline") velg("__baseline__", fraMasterKjoretoyId);
    else velg(valg.id, valg.id);
  }

  const masterVerkstedTittel = useMemo(() => {
    if (!valgtViserVerksted) return undefined;
    if (visningFraMaster && baselineKjennemerke) {
      return `Masterbil på verksted${masterPaVerkstedGrunn ? ` (${masterPaVerkstedGrunn})` : ""}`;
    }
    const id = selectValue === "__baseline__" ? fraMasterKjoretoyId : selectValue;
    if (!id) return undefined;
    return `Utilgjengelig: ${statusEtikett(id).toLowerCase()}`;
  }, [
    valgtViserVerksted,
    visningFraMaster,
    baselineKjennemerke,
    masterPaVerkstedGrunn,
    selectValue,
    fraMasterKjoretoyId,
    statusEtikett,
  ]);

  return (
    <div className={styles.kjoretoyCombo} ref={rotRef}>
      {bekreftDialog}
      <button
        type="button"
        className={`${styles.kjoretoyComboTrigger} ${åpen ? styles.kjoretoyComboTriggerOpen : ""} ${visningFraMaster ? styles.kjoretoyComboTriggerMaster : ""} ${valgtViserVerksted ? styles.kjoretoyComboTriggerMasterWarn : ""}`}
        aria-haspopup="listbox"
        aria-expanded={åpen}
        aria-label={ariaLabel}
        title={masterVerkstedTittel ?? (visningFraMaster ? "Kjøretøy fra masterplan" : undefined)}
        onClick={() => setÅpen((o) => !o)}
      >
        <span
          className={`${styles.kjoretoyComboValue} ${visningFraMaster ? styles.kjoretoyComboValueMaster : ""}`}
        >
          {visningLabel}
        </span>
        <span className={styles.kjoretoyComboChevron} aria-hidden>
          ▾
        </span>
      </button>

      {åpen && (
        <div className={styles.kjoretoyComboPanel} role="listbox">
          <div className={styles.kjoretoyComboSøkWrap}>
            <input
              ref={søkRef}
              type="search"
              className={styles.kjoretoyComboSøk}
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

          <div className={styles.kjoretoyComboListe}>
            {visSøk ? (
              søkTreff.length === 0 ? (
                <div className={styles.kjoretoyComboTom}>{søkTomTekst}</div>
              ) : (
                søkTreff.map(({ item, ledig, status }) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={selectValue === item.id}
                    title={erFraMasterKjoretoy(item.id) ? "Fra masterplan" : undefined}
                    className={`${styles.kjoretoyComboItem} ${!ledig ? styles.kjoretoyComboItemWarn : ""} ${erFraMasterKjoretoy(item.id) ? styles.kjoretoyComboItemMaster : ""}`}
                    onClick={() => velg(item.id, item.id)}
                  >
                    <span
                      className={`${styles.kjoretoyComboReg} ${erFraMasterKjoretoy(item.id) ? styles.kjoretoyComboRegMaster : ""}`}
                    >
                      {item.kjennemerke}
                    </span>
                    <span
                      className={
                        ledig ? styles.kjoretoyComboStatusOk : styles.kjoretoyComboStatusWarn
                      }
                    >
                      {status}
                    </span>
                  </button>
                ))
              )
            ) : (
              standardValg.map((valg) => {
                if (valg.kind === "ingen") {
                  return (
                    <button
                      key="ingen"
                      type="button"
                      role="option"
                      aria-selected={selectValue === "__ingen__"}
                      className={styles.kjoretoyComboItem}
                      onClick={() => velgFraListe(valg)}
                    >
                      <span className={styles.kjoretoyComboReg}>—</span>
                    </button>
                  );
                }
                if (valg.kind === "baseline") {
                  return (
                    <button
                      key="baseline"
                      type="button"
                      role="option"
                      aria-selected={selectValue === "__baseline__"}
                      title={masterVerkstedTittel ?? "Fra masterplan"}
                      className={`${styles.kjoretoyComboItem} ${styles.kjoretoyComboItemMaster} ${masterPaVerksted ? styles.kjoretoyComboItemWarn : ""}`}
                      onClick={() => velgFraListe(valg)}
                    >
                      <span className={`${styles.kjoretoyComboReg} ${styles.kjoretoyComboRegMaster}`}>
                        {baselineKjennemerke}
                      </span>
                      {masterPaVerksted && (
                        <span className={styles.kjoretoyComboStatusWarn}>
                          {masterPaVerkstedGrunn ?? "Verksted"}
                        </span>
                      )}
                    </button>
                  );
                }
                return (
                  <button
                    key={valg.id}
                    type="button"
                    role="option"
                    aria-selected={selectValue === valg.id}
                    title={erFraMasterKjoretoy(valg.id) ? "Fra masterplan" : undefined}
                    className={`${styles.kjoretoyComboItem} ${!valg.ledig ? styles.kjoretoyComboItemWarn : ""} ${erFraMasterKjoretoy(valg.id) ? styles.kjoretoyComboItemMaster : ""}`}
                    onClick={() => velgFraListe(valg)}
                  >
                    <span
                      className={`${styles.kjoretoyComboReg} ${erFraMasterKjoretoy(valg.id) ? styles.kjoretoyComboRegMaster : ""}`}
                    >
                      {valg.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
