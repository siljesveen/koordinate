"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { syklusUkeFraDato, ukedag1til7FraDato } from "@/lib/imported/ringnesCycle";
import { isoDato, parseISODateInput } from "@/lib/kjoretoyTilgjengelighet";
import { byggDagDriftOversikt, formatPlanDatoLang } from "@/lib/plan/dagDriftOversikt";
import { byggUkesFraværOversikt, formatUkeIntervall } from "@/lib/plan/ukesFraværOversikt";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useBilStore } from "@/lib/state/bilStore";
import { useBilUtilgjengeligStore } from "@/lib/state/bilUtilgjengeligStore";
import { useDagEndringStore } from "@/lib/state/dagEndringStore";
import { useFraværStore } from "@/lib/state/fravaerStore";
import { useHengerStore } from "@/lib/state/hengerStore";
import { useHengerUtilgjengeligStore } from "@/lib/state/hengerUtilgjengeligStore";
import { useMasterplanStore } from "@/lib/state/masterplanStore";
import { usePlanRuteTildelingStore } from "@/lib/state/planRuteTildelingStore";
import styles from "./page.module.css";

function addDays(iso: string, delta: number): string {
  const d = parseISODateInput(iso);
  d.setDate(d.getDate() + delta);
  return isoDato(d);
}

export default function Home() {
  const { ansatte } = useAnsattStore();
  const { fravær } = useFraværStore();
  const { masterplan } = useMasterplanStore();
  const { tildelinger } = usePlanRuteTildelingStore();
  const { endringer: dagEndringer } = useDagEndringStore();
  const { biler } = useBilStore();
  const { hengere } = useHengerStore();
  const { poster: bilUtilgjengelig } = useBilUtilgjengeligStore();
  const { poster: hengerUtilgjengelig } = useHengerUtilgjengeligStore();

  const iDagIso = useMemo(() => isoDato(new Date()), []);
  const [dato, setDato] = useState(iDagIso);
  const [visning, setVisning] = useState<"dag" | "uke">("dag");

  const uke = useMemo(() => syklusUkeFraDato(parseISODateInput(dato)), [dato]);
  const dayNo = useMemo(() => ukedag1til7FraDato(parseISODateInput(dato)), [dato]);
  const iMorgenIso = useMemo(() => addDays(iDagIso, 1), [iDagIso]);

  const drift = useMemo(
    () =>
      byggDagDriftOversikt({
        dato,
        uke,
        dag: dayNo,
        ansatte,
        fravær,
        masterSlots: masterplan.slots,
        koblingsgrupper: masterplan.koblingsgrupper,
        dagEndringer,
        tildelinger,
        bilUtilgjengelig,
        hengerUtilgjengelig,
        biler,
        hengere,
      }),
    [
      dato,
      uke,
      dayNo,
      ansatte,
      fravær,
      masterplan.slots,
      masterplan.koblingsgrupper,
      dagEndringer,
      tildelinger,
      bilUtilgjengelig,
      hengerUtilgjengelig,
      biler,
      hengere,
    ],
  );

  const ukesoversikt = useMemo(
    () =>
      byggUkesFraværOversikt({
        dato,
        ansatte,
        fravær,
        masterSlots: masterplan.slots,
        bilUtilgjengelig,
        hengerUtilgjengelig,
        biler,
        hengere,
      }),
    [dato, ansatte, fravær, masterplan.slots, bilUtilgjengelig, hengerUtilgjengelig, biler, hengere],
  );

  const { sammendrag, problemer } = drift;
  const harRuter = sammendrag.dag.totalt + sammendrag.kveld.totalt > 0;

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <div>
          <h1 className={styles.title}>{visning === "dag" ? "Drift i dag" : "Ukesoversikt"}</h1>
          <p className={styles.subtitle}>
            {visning === "dag"
              ? `${formatPlanDatoLang(dato)} · Syklus uke ${uke}`
              : `Uke ${formatUkeIntervall(ukesoversikt)} · ${ukesoversikt.totalt.ansatte} sjåfør · ${ukesoversikt.totalt.biler} bil · ${ukesoversikt.totalt.hengere} henger ute`}
          </p>
        </div>

        <div className={styles.dateNav}>
          <div className={styles.viewToggle} role="tablist" aria-label="Visning">
            <button
              type="button"
              role="tab"
              aria-selected={visning === "dag"}
              className={`${styles.toggleBtn}${visning === "dag" ? ` ${styles.toggleBtnActive}` : ""}`}
              onClick={() => setVisning("dag")}
            >
              Dag
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={visning === "uke"}
              className={`${styles.toggleBtn}${visning === "uke" ? ` ${styles.toggleBtnActive}` : ""}`}
              onClick={() => setVisning("uke")}
            >
              Uke
            </button>
          </div>
          <button
            type="button"
            className={styles.dayBtn}
            onClick={() => setDato((d) => addDays(d, -1))}
            aria-label="Forrige dag"
          >
            ‹
          </button>
          <input
            className={styles.dateInput}
            type="date"
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            aria-label="Dato"
          />
          <button
            type="button"
            className={styles.dayBtn}
            onClick={() => setDato((d) => addDays(d, 1))}
            aria-label="Neste dag"
          >
            ›
          </button>
          <button
            type="button"
            className={`${styles.shortcut}${dato === iDagIso ? ` ${styles.shortcutActive}` : ""}`}
            onClick={() => setDato(iDagIso)}
          >
            I dag
          </button>
          <button
            type="button"
            className={`${styles.shortcut}${dato === iMorgenIso ? ` ${styles.shortcutActive}` : ""}`}
            onClick={() => setDato(iMorgenIso)}
          >
            I morgen
          </button>
          <Link href="/plan" className={styles.planBtn}>
            Åpne Plan
          </Link>
        </div>
      </div>

      {visning === "dag" ? (
        harRuter ? (
        <>
          <div className={styles.statusBar}>
            <span className={styles.statusOk}>{sammendrag.ok} OK</span>
            {sammendrag.trengerHandling > 0 ? (
              <span className={styles.statusBad}>{sammendrag.trengerHandling} trenger handling</span>
            ) : (
              <span className={styles.statusOk}>Ingen problemer</span>
            )}
            <span className={styles.statusDot} />
            <span className={styles.statusMuted}>
              Dag {sammendrag.dag.problemer > 0 ? `${sammendrag.dag.problemer} problem` : "OK"}
              {" · "}
              Kveld {sammendrag.kveld.problemer > 0 ? `${sammendrag.kveld.problemer} problem` : "OK"}
            </span>
            {(sammendrag.personerUte > 0 || sammendrag.kjøretøyUte > 0) && (
              <>
                <span className={styles.statusDot} />
                <span className={styles.statusMuted}>
                  {sammendrag.personerUte > 0 ? `${sammendrag.personerUte} ute` : null}
                  {sammendrag.personerUte > 0 && sammendrag.kjøretøyUte > 0 ? " · " : null}
                  {sammendrag.kjøretøyUte > 0 ? `${sammendrag.kjøretøyUte} kjøretøy ute` : null}
                </span>
              </>
            )}
          </div>

          <section className={styles.hero}>
            {problemer.length > 0 ? (
              <>
                <h2 className={styles.heroTitle}>Trenger handling · {problemer.length}</h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Rute</th>
                        <th className={styles.hideSm}>Navn</th>
                        <th>Skift</th>
                        <th>Sjåfør</th>
                        <th className={styles.hideSm}>Bil</th>
                        <th>Problem</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {problemer.map((p) => (
                        <tr
                          key={p.id}
                          className={p.alvor === "kritisk" ? styles.rowKritisk : undefined}
                        >
                          <td className={styles.rute}>{p.rutekode}</td>
                          <td className={`${styles.navn} ${styles.hideSm}`}>{p.rutenavn}</td>
                          <td className={styles.skift}>{p.skift}</td>
                          <td className={styles.sjåfør}>{p.sjåførNavn ?? "—"}</td>
                          <td className={`${styles.bil} ${styles.hideSm}`}>{p.bilMerke ?? "—"}</td>
                          <td className={styles.problem}>{p.problem}</td>
                          <td>
                            <Link href="/plan" className={styles.actionLink}>
                              Plan →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className={styles.allGood}>
                Alle {sammendrag.ok} ruter er klare for dag og kveld.
              </div>
            )}
          </section>

          <div className={styles.footerMeta}>
            <span>
              {sammendrag.dag.totalt} ruter dag · {sammendrag.kveld.totalt} ruter kveld
            </span>
            <span className={styles.statusDot} />
            <Link href="/plan" className={styles.inlineLink}>
              Fravær, avspasering og kjøretøy — se i Plan
            </Link>
          </div>
        </>
        ) : (
          <div className={styles.emptyState}>
            Ingen ruter funnet for valgt dag. Sjekk{" "}
            <Link href="/masterplan" className={styles.inlineLink}>
              Masterplan
            </Link>
            .
          </div>
        )
      ) : (
        <section className={styles.weekWrap}>
          <div className={styles.statusBar}>
            <span className={styles.statusMuted}>
              {ukesoversikt.totalt.ansatte} sjåfør ute
            </span>
            <span className={styles.statusDot} />
            <span className={styles.statusMuted}>{ukesoversikt.totalt.biler} bil ute</span>
            <span className={styles.statusDot} />
            <span className={styles.statusMuted}>{ukesoversikt.totalt.hengere} henger ute</span>
          </div>

          <div className={styles.weekGrid}>
            {ukesoversikt.dager.map((dag) => {
              const tomt =
                dag.ansatte.length === 0 && dag.biler.length === 0 && dag.hengere.length === 0;
              return (
                <div
                  key={dag.dato}
                  className={`${styles.dayCard}${dag.erIDag ? ` ${styles.dayCardToday}` : ""}`}
                >
                  <div className={styles.dayCardHead}>
                    <span className={styles.dayCardName}>
                      {dag.dagNavn} {dag.datoKort}
                    </span>
                    <button
                      type="button"
                      className={styles.dayCardLink}
                      onClick={() => {
                        setDato(dag.dato);
                        setVisning("dag");
                      }}
                    >
                      Åpne dag →
                    </button>
                  </div>

                  {tomt ? (
                    <p className={styles.dayCardEmpty}>Ingen fravær eller kjøretøy ute.</p>
                  ) : (
                    <div className={styles.dayCardBody}>
                      {dag.ansatte.length > 0 && (
                        <div className={styles.dayCardGroup}>
                          <span className={styles.dayCardGroupTitle}>
                            Sjåfører · {dag.ansatte.length}
                          </span>
                          {dag.ansatte.map((r) => (
                            <div key={r.id} className={styles.dayCardRow}>
                              <span className={styles.dayCardRowName}>{r.navn}</span>
                              <span className={styles.dayCardTag}>{r.type}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(dag.biler.length > 0 || dag.hengere.length > 0) && (
                        <div className={styles.dayCardGroup}>
                          <span className={styles.dayCardGroupTitle}>
                            Kjøretøy · {dag.biler.length + dag.hengere.length}
                          </span>
                          {dag.biler.map((r) => (
                            <div key={r.id} className={styles.dayCardRow}>
                              <span className={styles.dayCardRowName}>{r.etikett}</span>
                              <span className={styles.dayCardTag}>{r.type}</span>
                            </div>
                          ))}
                          {dag.hengere.map((r) => (
                            <div key={r.id} className={styles.dayCardRow}>
                              <span className={styles.dayCardRowName}>{r.etikett}</span>
                              <span className={styles.dayCardTag}>{r.type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
