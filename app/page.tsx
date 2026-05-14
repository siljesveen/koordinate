"use client";

import Link from "next/link";
import { useMemo } from "react";
import { fullNavn, type Ansatt, type MasterRuteSlot, type PlanRuteTildeling } from "@/lib/domain";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useFraværStore } from "@/lib/state/fravaerStore";
import { useMasterplanStore } from "@/lib/state/masterplanStore";
import { usePlanRuteTildelingStore } from "@/lib/state/planRuteTildelingStore";
import { useBilStore } from "@/lib/state/bilStore";
import { useHengerStore } from "@/lib/state/hengerStore";
import styles from "./page.module.css";

function isoDato(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function ukedag1til7(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

function syklusUke(d: Date): 1 | 2 | 3 | 4 {
  const anker = new Date(2026, 4, 11);
  const diff = Math.floor((d.getTime() - anker.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const mod = ((diff % 4) + 4) % 4;
  return (mod + 1) as 1 | 2 | 3 | 4;
}

function overlapperDato(
  post: { fraDato: string; tilDato: string },
  dato: string,
): boolean {
  return dato >= post.fraDato && dato <= post.tilDato;
}

export default function Home() {
  const { ansatte } = useAnsattStore();
  const { fravær } = useFraværStore();
  const { masterplan } = useMasterplanStore();
  const { tildelinger } = usePlanRuteTildelingStore();
  const { biler } = useBilStore();
  const { hengere } = useHengerStore();

  const iDag = useMemo(() => new Date(), []);
  const dato = useMemo(() => isoDato(iDag), [iDag]);
  const dayNo = useMemo(() => ukedag1til7(iDag), [iDag]);
  const uke = useMemo(() => syklusUke(iDag), [iDag]);

  const dagNavn = new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(iDag);

  const ansattById = useMemo(
    () => new Map(ansatte.map((a) => [a.id, a] as const)),
    [ansatte],
  );

  const dagRuter = useMemo(
    () =>
      masterplan.slots
        .filter((s) => s.uke === uke && s.dag === dayNo && s.skift === "Dag")
        .sort((a, b) => a.rutekode.localeCompare(b.rutekode, "nb", { numeric: true })),
    [masterplan.slots, uke, dayNo],
  );

  const tildelingMap = useMemo(() => {
    const m = new Map<string, PlanRuteTildeling>();
    for (const t of tildelinger) {
      if (t.uke === uke && t.dag === dayNo && t.skift === "Dag") {
        m.set(t.rute, t);
      }
    }
    return m;
  }, [tildelinger, uke, dayNo]);

  const fraværIDag = useMemo(
    () => fravær.filter((f) => overlapperDato(f, dato)),
    [fravær, dato],
  );

  const stats = useMemo(() => {
    let ok = 0;
    let mangler = 0;
    let utilgjengelig = 0;
    const tildelteSjåfører = new Set<string>();

    for (const slot of dagRuter) {
      const til = tildelingMap.get(slot.rutekode);
      let sjåførId = til?.ansattId ?? slot.standardSjåførAnsattId;
      const sjåfør = sjåførId ? ansattById.get(sjåførId) : undefined;
      if (sjåfør && !sjåfør.aktiv) sjåførId = undefined;

      const harFravær = sjåførId
        ? fraværIDag.some((f) => f.ansattId === sjåførId)
        : false;

      const bilId = til?.bilId ?? slot.standardBilId;

      if (!sjåførId || !bilId) {
        mangler++;
      } else if (harFravær) {
        utilgjengelig++;
      } else {
        ok++;
        tildelteSjåfører.add(sjåførId);
      }
    }

    const aktiveAsko = ansatte.filter(
      (a) => a.aktiv && (!a.selskap || a.selskap === "Asko"),
    );
    const fraværSet = new Set(fraværIDag.map((f) => f.ansattId));
    const tilgjengelige = aktiveAsko.filter(
      (a) => !tildelteSjåfører.has(a.id) && !fraværSet.has(a.id),
    );
    const antallFravær = aktiveAsko.filter((a) => fraværSet.has(a.id)).length;

    return {
      totaltRuter: dagRuter.length,
      ok,
      mangler,
      utilgjengelig,
      tilgjengelige: tilgjengelige.length,
      antallFravær,
      totalAnsatte: aktiveAsko.length,
      totalBiler: biler.filter((b) => b.aktiv).length,
      totalHengere: hengere.filter((h) => h.aktiv).length,
    };
  }, [dagRuter, tildelingMap, ansattById, fraværIDag, ansatte, biler, hengere]);

  const ruterMedMangler = useMemo(() => {
    const resultat: { rutekode: string; rutenavn: string; problem: string }[] = [];
    for (const slot of dagRuter) {
      const til = tildelingMap.get(slot.rutekode);
      let sjåførId = til?.ansattId ?? slot.standardSjåførAnsattId;
      const sjåfør = sjåførId ? ansattById.get(sjåførId) : undefined;
      if (sjåfør && !sjåfør.aktiv) sjåførId = undefined;
      const harFravær = sjåførId ? fraværIDag.some((f) => f.ansattId === sjåførId) : false;
      const bilId = til?.bilId ?? slot.standardBilId;

      const problemer: string[] = [];
      if (!sjåførId) problemer.push("Mangler sjåfør");
      else if (harFravær) problemer.push("Sjåfør har fravær");
      if (!bilId) problemer.push("Mangler bil");

      if (problemer.length > 0) {
        resultat.push({
          rutekode: slot.rutekode,
          rutenavn: slot.rutenavn ?? slot.rutekode,
          problem: problemer.join(", "),
        });
      }
    }
    return resultat;
  }, [dagRuter, tildelingMap, ansattById, fraværIDag]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dagsoversikt</h1>
          <p className={styles.subtitle}>{dagNavn} · Uke {uke} i syklus</p>
        </div>
        <Link href="/plan" className={styles.filterBtn}>
          Åpne Plan →
        </Link>
      </header>

      {/* Sammendrag-kort */}
      <div className={styles.cardGrid}>
        <div className={`${styles.card} ${styles.cardGreen}`}>
          <div className={styles.cardValue}>{stats.ok}</div>
          <div className={styles.cardLabel}>Ruter OK</div>
        </div>
        <div className={`${styles.card} ${stats.mangler > 0 ? styles.cardRed : styles.cardNeutral}`}>
          <div className={styles.cardValue}>{stats.mangler}</div>
          <div className={styles.cardLabel}>Mangler ressurs</div>
        </div>
        <div className={`${styles.card} ${stats.utilgjengelig > 0 ? styles.cardYellow : styles.cardNeutral}`}>
          <div className={styles.cardValue}>{stats.utilgjengelig}</div>
          <div className={styles.cardLabel}>Utilgjengelig</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{stats.tilgjengelige}</div>
          <div className={styles.cardLabel}>Ledige sjåfører</div>
        </div>
        <div className={`${styles.card} ${stats.antallFravær > 0 ? styles.cardOrange : styles.cardNeutral}`}>
          <div className={styles.cardValue}>{stats.antallFravær}</div>
          <div className={styles.cardLabel}>Fravær i dag</div>
        </div>
      </div>

      {/* Ressursoversikt */}
      <div className={styles.resourceRow}>
        <span>{stats.totalAnsatte} aktive sjåfører</span>
        <span className={styles.dot} />
        <span>{stats.totalBiler} biler</span>
        <span className={styles.dot} />
        <span>{stats.totalHengere} hengere</span>
        <span className={styles.dot} />
        <span>{stats.totaltRuter} ruter i dag</span>
      </div>

      {/* Ruter som trenger oppmerksomhet */}
      {ruterMedMangler.length > 0 && (
        <div className={styles.alertSection}>
          <h2 className={styles.alertTitle}>Trenger oppmerksomhet ({ruterMedMangler.length})</h2>
          <div className={styles.alertList}>
            {ruterMedMangler.map((r) => (
              <div key={r.rutekode} className={styles.alertRow}>
                <span className={styles.alertRute}>{r.rutekode}</span>
                <span className={styles.alertNavn}>{r.rutenavn}</span>
                <span className={styles.alertProblem}>{r.problem}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ruterMedMangler.length === 0 && stats.totaltRuter > 0 && (
        <div className={styles.allGood}>
          Alle {stats.totaltRuter} ruter har sjåfør og bil tildelt for dagskiftet i dag.
        </div>
      )}

      {stats.totaltRuter === 0 && (
        <div className={styles.emptyState}>
          Ingen ruter funnet for i dag. Sjekk <Link href="/masterplan" className={styles.inlineLink}>Masterplan</Link> for oppsett.
        </div>
      )}
    </div>
  );
}
