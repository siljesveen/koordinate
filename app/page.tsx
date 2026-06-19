"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { syklusUkeFraDato, ukedag1til7FraDato } from "@/lib/imported/ringnesCycle";
import { isoDato, parseISODateInput } from "@/lib/kjoretoyTilgjengelighet";
import { byggDagDriftOversikt, formatPlanDatoLang } from "@/lib/plan/dagDriftOversikt";
import { byggDagsFraværOversikt } from "@/lib/plan/dagsFraværOversikt";
import {
  byggInfoskjermOversikt,
  type InfoskjermSkiftBlokk,
} from "@/lib/plan/infoskjermOversikt";
import { byggUkesFraværOversikt, formatUkeIntervall } from "@/lib/plan/ukesFraværOversikt";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useBemanningsplanStore } from "@/lib/state/bemanningsplanStore";
import { useBilStore } from "@/lib/state/bilStore";
import { useBilUtilgjengeligStore } from "@/lib/state/bilUtilgjengeligStore";
import { useDagEndringStore } from "@/lib/state/dagEndringStore";
import { useFraværStore } from "@/lib/state/fravaerStore";
import { useHengerStore } from "@/lib/state/hengerStore";
import { useHengerUtilgjengeligStore } from "@/lib/state/hengerUtilgjengeligStore";
import { useMasterplanStore } from "@/lib/state/masterplanStore";
import { usePlanRuteTildelingStore } from "@/lib/state/planRuteTildelingStore";
import { useSkiftTilgjengelighetStore } from "@/lib/state/skiftTilgjengelighetStore";
import styles from "./page.module.css";

function addDays(iso: string, delta: number): string {
  const d = parseISODateInput(iso);
  d.setDate(d.getDate() + delta);
  return isoDato(d);
}

function fraværTagClass(type: string): string {
  if (type === "Syk") return styles.tagError;
  if (type === "Avspasering") return styles.tagWarn;
  return styles.tagInfo;
}

function SkiftPanel({ blokk }: { blokk: InfoskjermSkiftBlokk }) {
  return (
    <section className={styles.skiftPanel}>
      <header className={styles.skiftHead}>
        <h2 className={styles.skiftTitle}>{blokk.skift}</h2>
        <div className={styles.skiftStats}>
          <span className={styles.statOk}>{blokk.ruterOk} OK</span>
          <span className={styles.statMuted}>/ {blokk.ruterTotalt} ruter</span>
          {blokk.avvik > 0 ? (
            <span className={styles.statBad}>{blokk.avvik} avvik</span>
          ) : (
            <span className={styles.statOk}>Ingen avvik</span>
          )}
        </div>
      </header>

      <h3 className={styles.listTitle}>Tilgjengelige ({blokk.tilgjengelige.length})</h3>
      {blokk.tilgjengelige.length === 0 ? (
        <p className={styles.panelEmpty}>Ingen tilgjengelige</p>
      ) : (
        <ul className={styles.tilgjengeligListe}>
          {blokk.tilgjengelige.map((r) => (
            <li key={r.id} className={styles.tilgjengeligRad}>
              <span className={styles.tilgjengeligNavn}>
                {r.navn}
                {r.harDagKommentar ? (
                  <span className={styles.stjerne} title="Merknad i bemanningsplan">
                    {" "}
                    *
                  </span>
                ) : null}
              </span>
              <span className={styles.tilgjengeligTid}>{r.arbeidstid ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}

      <Link href="/plan" className={styles.skiftLink}>
        Åpne {blokk.skift.toLowerCase()} i Plan →
      </Link>
    </section>
  );
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
  const { poster: skiftTilgjengelighet } = useSkiftTilgjengelighetStore();
  const { plan: bemanningsplan } = useBemanningsplanStore();

  const iDagIso = useMemo(() => isoDato(new Date()), []);
  const [dato, setDato] = useState(iDagIso);
  const [visning, setVisning] = useState<"dag" | "uke">("dag");

  const uke = useMemo(() => syklusUkeFraDato(parseISODateInput(dato)), [dato]);
  const dayNo = useMemo(() => ukedag1til7FraDato(parseISODateInput(dato)), [dato]);
  const iMorgenIso = useMemo(() => addDays(iDagIso, 1), [iDagIso]);

  const dataArgs = useMemo(
    () => ({
      dato,
      uke,
      dag: dayNo,
      ansatte,
      fravær,
      masterSlots: masterplan.slots,
      koblingsgrupper: masterplan.koblingsgrupper,
      dagEndringer,
      tildelinger,
      skiftTilgjengelighet,
      bilUtilgjengelig,
      hengerUtilgjengelig,
      biler,
      hengere,
      bemanningsplan,
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
      skiftTilgjengelighet,
      bilUtilgjengelig,
      hengerUtilgjengelig,
      biler,
      hengere,
      bemanningsplan,
    ],
  );

  const oversikt = useMemo(() => byggInfoskjermOversikt(dataArgs), [dataArgs]);

  const drift = useMemo(() => byggDagDriftOversikt(dataArgs), [dataArgs]);

  const fraværDag = useMemo(() => byggDagsFraværOversikt(dataArgs), [dataArgs]);

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

  const iMorgenUke = useMemo(() => syklusUkeFraDato(parseISODateInput(iMorgenIso)), [iMorgenIso]);
  const iMorgenDag = useMemo(() => ukedag1til7FraDato(parseISODateInput(iMorgenIso)), [iMorgenIso]);

  const iMorgenOversikt = useMemo(
    () =>
      byggInfoskjermOversikt({
        ...dataArgs,
        dato: iMorgenIso,
        uke: iMorgenUke,
        dag: iMorgenDag,
      }),
    [dataArgs, iMorgenIso, iMorgenUke, iMorgenDag],
  );

  const { sammendrag, problemer } = drift;
  const harRuter = sammendrag.dag.totalt + sammendrag.kveld.totalt > 0;
  const ruterOk = oversikt.dag.ruterOk + oversikt.kveld.ruterOk;
  const ledigeDag = oversikt.dag.tilgjengelige.length;
  const ledigeKveld = oversikt.kveld.tilgjengelige.length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.merk}>KOordinate · Drift</p>
          <h1 className={styles.title}>
            {visning === "dag" ? oversikt.datoTekst : "Ukesoversikt"}
          </h1>
          <p className={styles.subtitle}>
            {visning === "dag"
              ? `Syklus uke ${uke}`
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
      </header>

      {visning === "dag" ? (
        harRuter ? (
          <>
            <div className={styles.kpiRad}>
              <div className={`${styles.kpi} ${styles.kpiOk}`}>
                <span className={styles.kpiVerdi}>{ruterOk}</span>
                <span className={styles.kpiEtikett}>Ruter OK</span>
              </div>
              <div
                className={`${styles.kpi}${oversikt.avvikTotalt > 0 ? ` ${styles.kpiBad}` : ""}`}
              >
                <span className={styles.kpiVerdi}>{oversikt.avvikTotalt}</span>
                <span className={styles.kpiEtikett}>Trenger handling</span>
              </div>
              <div className={styles.kpi}>
                <span className={styles.kpiVerdi}>{oversikt.personerUte}</span>
                <span className={styles.kpiEtikett}>Personer ute</span>
              </div>
              <div className={styles.kpi}>
                <span className={styles.kpiVerdi}>{oversikt.kjøretøyUte.length}</span>
                <span className={styles.kpiEtikett}>Kjøretøy ute</span>
              </div>
              <div className={`${styles.kpi} ${styles.kpiLedig}`}>
                <span className={styles.kpiVerdi}>
                  {ledigeDag}
                  <span className={styles.kpiDivider}>·</span>
                  {ledigeKveld}
                </span>
                <span className={styles.kpiEtikett}>Ledige dag · kveld</span>
              </div>
            </div>

            <div className={styles.skiftGrid}>
              <SkiftPanel blokk={oversikt.dag} />
              <SkiftPanel blokk={oversikt.kveld} />
            </div>

            <div className={styles.mainGrid}>
              <section>
                <div className={styles.sectionHead}>
                  <h2 className={styles.sectionTitle}>
                    {problemer.length > 0 ? "Trenger handling" : "Ruter"}
                  </h2>
                  {problemer.length > 0 ? (
                    <span className={styles.badge}>{problemer.length} saker</span>
                  ) : null}
                </div>

                {problemer.length > 0 ? (
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
                            className={p.alvor === "kritisk" ? styles.rowKritisk : styles.rowWarn}
                          >
                            <td className={styles.rute}>{p.rutekode}</td>
                            <td className={`${styles.muted} ${styles.hideSm}`}>{p.rutenavn}</td>
                            <td className={styles.skift}>{p.skift}</td>
                            <td className={styles.sjåfør}>{p.sjåførNavn ?? "—"}</td>
                            <td className={`${styles.muted} ${styles.hideSm}`}>
                              {p.bilMerke ?? "—"}
                            </td>
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
                ) : (
                  <div className={styles.allGood}>
                    Alle {ruterOk} ruter er klare for dag og kveld.
                  </div>
                )}
              </section>

              <div className={styles.sideStack}>
                <section className={styles.sidePanel}>
                  <div className={styles.sidePanelHead}>
                    Personer ute · {fraværDag.ansatte.length}
                  </div>
                  {fraværDag.ansatte.length === 0 ? (
                    <p className={styles.panelEmptyLight}>Ingen registrert ute</p>
                  ) : (
                    fraværDag.ansatte.map((r) => (
                      <div key={r.id} className={styles.panelRow}>
                        <span className={styles.panelName}>{r.navn}</span>
                        <span className={`${styles.tag} ${fraværTagClass(r.type)}`}>{r.type}</span>
                        {r.kommentar ? (
                          <span className={styles.planNote} title={r.kommentar}>
                            {r.kommentar.length > 24
                              ? `${r.kommentar.slice(0, 24)}…`
                              : r.kommentar}
                          </span>
                        ) : null}
                      </div>
                    ))
                  )}
                  <Link href="/fravaer" className={styles.sidePanelLink}>
                    Se fravær →
                  </Link>
                </section>

                <section className={styles.sidePanel}>
                  <div className={styles.sidePanelHead}>
                    Kjøretøy ute · {fraværDag.biler.length + fraværDag.hengere.length}
                  </div>
                  {fraværDag.biler.length + fraværDag.hengere.length === 0 ? (
                    <p className={styles.panelEmptyLight}>Ingen registrert ute</p>
                  ) : (
                    <>
                      {fraværDag.biler.map((r) => (
                        <div key={r.id} className={styles.panelRow}>
                          <span className={styles.panelName}>{r.etikett}</span>
                          <span className={`${styles.tag} ${styles.tagWarn}`}>Bil</span>
                          <span className={styles.planNote}>{r.type}</span>
                          <span className={styles.planNote}>{r.periode}</span>
                        </div>
                      ))}
                      {fraværDag.hengere.map((r) => (
                        <div key={r.id} className={styles.panelRow}>
                          <span className={styles.panelName}>{r.etikett}</span>
                          <span className={`${styles.tag} ${styles.tagInfo}`}>Henger</span>
                          <span className={styles.planNote}>{r.type}</span>
                          <span className={styles.planNote}>{r.periode}</span>
                        </div>
                      ))}
                    </>
                  )}
                  <Link href="/verksted" className={styles.sidePanelLink}>
                    Se verksted →
                  </Link>
                </section>
              </div>
            </div>

            {dato === iDagIso && (
              <section className={styles.iMorgen}>
                <div className={styles.iMorgenTitle}>
                  I morgen · {formatPlanDatoLang(iMorgenIso)} · syklus uke {iMorgenUke}
                </div>
                <p className={styles.iMorgenText}>
                  {iMorgenOversikt.avvikTotalt > 0
                    ? `${iMorgenOversikt.avvikTotalt} ruter trenger sjekk · `
                    : "Ingen kjente avvik · "}
                  {iMorgenOversikt.personerUte > 0
                    ? `${iMorgenOversikt.personerUte} personer ute · `
                    : ""}
                  {iMorgenOversikt.dag.tilgjengelige.length + iMorgenOversikt.kveld.tilgjengelige.length}{" "}
                  ledige sjåfører totalt
                </p>
                <button
                  type="button"
                  className={styles.iMorgenLink}
                  onClick={() => setDato(iMorgenIso)}
                >
                  Vis i morgen på dashbordet →
                </button>
              </section>
            )}

            <footer className={styles.fotnote}>{oversikt.fotnote}</footer>
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
          <div className={styles.kpiRad}>
            <div className={styles.kpi}>
              <span className={styles.kpiVerdi}>{ukesoversikt.totalt.ansatte}</span>
              <span className={styles.kpiEtikett}>Sjåfør ute</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiVerdi}>{ukesoversikt.totalt.biler}</span>
              <span className={styles.kpiEtikett}>Biler ute</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiVerdi}>{ukesoversikt.totalt.hengere}</span>
              <span className={styles.kpiEtikett}>Hengere ute</span>
            </div>
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
