"use client";

import { useMemo, useState } from "react";
import { fullNavn, type Henting } from "@/lib/domain";
import { isoDato, parseISODateInput } from "@/lib/kjoretoyTilgjengelighet";
import { formatPlanDatoLang } from "@/lib/plan/dagDriftOversikt";
import { syklusUkeFraDato, ukedag1til7FraDato } from "@/lib/imported/ringnesCycle";
import { compareNb } from "@/lib/utils/sort";
import { useHentingStore } from "@/lib/state/hentingStore";
import { useMasterplanStore } from "@/lib/state/masterplanStore";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { usePlanRuteTildelingStore } from "@/lib/state/planRuteTildelingStore";
import { useBekreftDialog } from "@/components/useBekreftDialog";
import SokbarVelger, { type SokbarVelgerValg } from "@/components/SokbarVelger";
import styles from "./page.module.css";

const DAG_KORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const DAG_LANG = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

function addDays(iso: string, delta: number): string {
  const d = parseISODateInput(iso);
  d.setDate(d.getDate() + delta);
  return isoDato(d);
}

function tomtUkeoppsett(): Record<number, string[]> {
  return {};
}

type Skjema = {
  id: string | null;
  kunde: string;
  ukeRuter: Record<number, string[]>;
  antall: string;
  kommentar: string;
  aktiv: boolean;
};

function tomtSkjema(): Skjema {
  return { id: null, kunde: "", ukeRuter: tomtUkeoppsett(), antall: "", kommentar: "", aktiv: true };
}

function likeRuter(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bs = new Set(b);
  return a.every((x) => bs.has(x));
}

/* ── Flervalg av ruter (chips + søkbar legg-til) ── */
function RuteVelgerFlere({
  ruter,
  options,
  ruteEtikett,
  onEndre,
  ariaLabel,
}: {
  ruter: string[];
  options: SokbarVelgerValg[];
  ruteEtikett: (kode: string) => string;
  onEndre: (ruter: string[]) => void;
  ariaLabel: string;
}) {
  const ledige = useMemo(
    () => options.filter((o) => !ruter.includes(o.value)),
    [options, ruter],
  );
  return (
    <div className={styles.ruteVelger}>
      {ruter.map((kode) => (
        <span key={kode} className={styles.ruteChip}>
          {ruteEtikett(kode)}
          <button
            type="button"
            className={styles.ruteChipX}
            aria-label={`Fjern ${ruteEtikett(kode)}`}
            onClick={() => onEndre(ruter.filter((r) => r !== kode))}
          >
            ×
          </button>
        </span>
      ))}
      <SokbarVelger
        value=""
        onChange={(kode) => {
          if (kode && !ruter.includes(kode)) onEndre([...ruter, kode]);
        }}
        options={ledige}
        ariaLabel={ariaLabel}
        tomLabel="+ legg til rute"
        visTom={false}
        compact
        søkPlaceholder="Søk rute…"
      />
    </div>
  );
}

export default function HentingerPage() {
  const {
    hentinger,
    dagValg,
    lagreHenting,
    slettHenting,
    vekselDagValg,
    settDagRuter,
    settDagAntall,
  } = useHentingStore();
  const { masterplan } = useMasterplanStore();
  const { ansatte } = useAnsattStore();
  const { tildelinger } = usePlanRuteTildelingStore();
  const { requestBekreft, dialog: bekreftDialog } = useBekreftDialog();

  const [fane, setFane] = useState<"dagsplan" | "katalog">("dagsplan");
  const iDag = useMemo(() => isoDato(new Date()), []);
  const iMorgen = useMemo(() => addDays(iDag, 1), [iDag]);
  const [dato, setDato] = useState(iMorgen);

  const [modalÅpen, setModalÅpen] = useState(false);
  const [skjema, setSkjema] = useState<Skjema>(tomtSkjema);

  const ukedag = useMemo(() => ukedag1til7FraDato(parseISODateInput(dato)), [dato]);

  /* ── Rutekoder fra masterplan ── */
  const ruteNavn = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of masterplan.slots) {
      if (!m.has(s.rutekode)) m.set(s.rutekode, s.rutenavn ?? s.rutekode);
    }
    return m;
  }, [masterplan.slots]);

  const ruteOptions = useMemo<SokbarVelgerValg[]>(() => {
    return Array.from(ruteNavn.entries())
      .map(([kode, navn]) => ({
        value: kode,
        label: navn && navn !== kode ? `${kode} · ${navn}` : kode,
        søkTekst: `${kode} ${navn}`,
      }))
      .sort((a, b) => compareNb(a.label, b.label));
  }, [ruteNavn]);

  function ruteEtikett(kode: string): string {
    if (!kode) return "Uten rute";
    const navn = ruteNavn.get(kode);
    return navn && navn !== kode ? `${kode} · ${navn}` : kode;
  }

  /** Sjåfør(er) på hver rutekode for valgt dato (master + plan-tildeling). */
  const ruteSjåfør = useMemo(() => {
    const d = parseISODateInput(dato);
    const uke = syklusUkeFraDato(d);
    const dag = ukedag1til7FraDato(d);
    const navnById = new Map(ansatte.map((a) => [a.id, fullNavn(a)] as const));
    const perRute = new Map<string, string[]>();
    for (const skift of ["Dag", "Kveld"] as const) {
      for (const slot of masterplan.slots) {
        if (slot.uke !== uke || slot.dag !== dag || slot.skift !== skift) continue;
        const til = tildelinger.find(
          (t) => t.uke === uke && t.dag === dag && t.skift === skift && t.rute === slot.rutekode,
        );
        const ansattId = til?.ansattId ?? (til?.skjulBaselineSjåfør ? undefined : slot.standardSjåførAnsattId);
        if (!ansattId) continue;
        const navn = navnById.get(ansattId);
        if (!navn) continue;
        const liste = perRute.get(slot.rutekode) ?? [];
        if (!liste.includes(navn)) liste.push(navn);
        perRute.set(slot.rutekode, liste);
      }
    }
    return perRute;
  }, [masterplan.slots, tildelinger, ansatte, dato]);

  function sjåførForRute(kode: string): string | undefined {
    const navn = ruteSjåfør.get(kode);
    return navn && navn.length ? navn.join(", ") : undefined;
  }

  /* ── Dagsplan ── */
  const aktiveHentinger = useMemo(
    () => hentinger.filter((h) => h.aktiv).sort((a, b) => compareNb(a.kunde, b.kunde)),
    [hentinger],
  );

  const valgForDato = useMemo(() => {
    const m = new Map<string, string[] | undefined>();
    for (const v of dagValg) {
      if (v.dato === dato) m.set(v.hentingId, v.ruter);
    }
    return m;
  }, [dagValg, dato]);

  const valgAntallForDato = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const v of dagValg) {
      if (v.dato === dato) m.set(v.hentingId, v.antall);
    }
    return m;
  }, [dagValg, dato]);

  function effektivAntall(h: Henting): string | undefined {
    return valgAntallForDato.get(h.id) ?? h.antall;
  }

  function planRuterForDag(h: Henting): string[] {
    return h.ukeRuter[ukedag] ?? [];
  }

  function effektiveRuter(h: Henting): string[] {
    const overstyrt = valgForDato.get(h.id);
    return overstyrt ?? planRuterForDag(h);
  }

  // Aktuelle i dag (har ruter for ukedagen) først, så resten.
  const { aktuelle, andre } = useMemo(() => {
    const aktuelle: Henting[] = [];
    const andre: Henting[] = [];
    for (const h of aktiveHentinger) {
      if ((h.ukeRuter[ukedag] ?? []).length > 0) aktuelle.push(h);
      else andre.push(h);
    }
    return { aktuelle, andre };
  }, [aktiveHentinger, ukedag]);

  const henteliste = useMemo(() => {
    const grupper = new Map<string, { kunde: string; antall?: string; key: string }[]>();
    for (const h of aktiveHentinger) {
      if (!valgForDato.has(h.id)) continue;
      const ruter = (valgForDato.get(h.id) ?? planRuterForDag(h));
      const antall = valgAntallForDato.get(h.id) ?? h.antall;
      const liste = ruter.length > 0 ? ruter : [""];
      for (const rute of liste) {
        const rader = grupper.get(rute) ?? [];
        rader.push({ kunde: h.kunde, antall, key: `${h.id}-${rute}` });
        grupper.set(rute, rader);
      }
    }
    return Array.from(grupper.entries())
      .map(([rute, rader]) => ({
        rute,
        sjåfør: sjåførForRute(rute),
        rader: rader.sort((a, b) => compareNb(a.kunde, b.kunde)),
      }))
      .sort((a, b) => {
        if (!a.rute) return 1;
        if (!b.rute) return -1;
        return compareNb(a.rute, b.rute);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiveHentinger, valgForDato, valgAntallForDato, ukedag, ruteSjåfør]);

  const antallValgt = valgForDato.size;

  /* ── Katalog ── */
  function åpneNy() {
    setSkjema(tomtSkjema());
    setModalÅpen(true);
  }

  function åpneRediger(h: Henting) {
    setSkjema({
      id: h.id,
      kunde: h.kunde,
      ukeRuter: { ...h.ukeRuter },
      antall: h.antall ?? "",
      kommentar: h.kommentar ?? "",
      aktiv: h.aktiv,
    });
    setModalÅpen(true);
  }

  function lukkModal() {
    setModalÅpen(false);
  }

  function settSkjemaDag(dag: number, ruter: string[]) {
    setSkjema((s) => {
      const ny = { ...s.ukeRuter };
      if (ruter.length) ny[dag] = ruter;
      else delete ny[dag];
      return { ...s, ukeRuter: ny };
    });
  }

  function lagreSkjema(e: React.FormEvent) {
    e.preventDefault();
    const kunde = skjema.kunde.trim();
    if (!kunde) return;
    lagreHenting({
      id: skjema.id ?? undefined,
      kunde,
      ukeRuter: skjema.ukeRuter,
      antall: skjema.antall.trim() ? skjema.antall.trim() : undefined,
      kommentar: skjema.kommentar.trim() ? skjema.kommentar.trim() : undefined,
      aktiv: skjema.aktiv,
    });
    lukkModal();
  }

  async function bekreftSlett(h: Henting) {
    const ok = await requestBekreft(`Slette henting «${h.kunde}»? Dette kan ikke angres.`, {
      bekreftTekst: "Slett",
    });
    if (!ok) return;
    slettHenting(h.id);
    lukkModal();
  }

  const katalogSortert = useMemo(
    () => hentinger.slice().sort((a, b) => compareNb(a.kunde, b.kunde)),
    [hentinger],
  );

  function ukeSammendrag(h: Henting): string {
    const dager: string[] = [];
    for (let d = 1; d <= 7; d++) {
      if ((h.ukeRuter[d] ?? []).length > 0) dager.push(DAG_KORT[d - 1]);
    }
    return dager.length ? dager.join(", ") : "—";
  }

  function renderVelgRad(h: Henting) {
    const valgt = valgForDato.has(h.id);
    const planRuter = planRuterForDag(h);
    const ruter = effektiveRuter(h);
    const endret = valgt && !likeRuter(ruter, planRuter);
    const sjåførTekst = ruter
      .map((r) => sjåførForRute(r))
      .filter((s): s is string => !!s);
    return (
      <div key={h.id} className={`${styles.velgRad}${valgt ? ` ${styles.velgRadAktiv}` : ""}`}>
        <label className={styles.velgHovud}>
          <input type="checkbox" checked={valgt} onChange={() => vekselDagValg(dato, h.id)} />
          <span className={styles.velgKunde}>{h.kunde}</span>
          {!valgt && h.antall && <span className={styles.velgAntall}>{h.antall}</span>}
          {!valgt && planRuter.length > 0 && (
            <span className={styles.velgHint}>{planRuter.map(ruteEtikett).join(", ")}</span>
          )}
        </label>
        {valgt && (
          <div className={styles.velgDetaljer}>
            <div className={styles.velgRute}>
              <RuteVelgerFlere
                ruter={ruter}
                options={ruteOptions}
                ruteEtikett={ruteEtikett}
                ariaLabel={`Ruter for ${h.kunde}`}
                onEndre={(nye) =>
                  settDagRuter(dato, h.id, likeRuter(nye, planRuter) ? undefined : nye)
                }
              />
              {endret && (
                <span className={styles.endretTag} title="Avviker fra ukeoppsettet">
                  endret
                </span>
              )}
            </div>
            <div className={styles.velgMeta}>
              <input
                className={styles.antallInput}
                type="text"
                value={valgAntallForDato.get(h.id) ?? ""}
                placeholder="Antall"
                aria-label={`Antall for ${h.kunde}`}
                onChange={(e) => settDagAntall(dato, h.id, e.target.value)}
              />
              {sjåførTekst.length > 0 ? (
                <span className={styles.velgSjåfør} title="Sjåfør på ruten denne dagen">
                  → {sjåførTekst.join(" · ")}
                </span>
              ) : (
                <span className={styles.velgSjåførTom}>Ingen sjåfør på ruten</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Hentinger</h1>
          <p className={styles.helper}>
            Planlegg daglige henteoppdrag: hak av hvilke som gjelder, og se hvilken rute som
            henter hva.
          </p>
        </div>
        <div className={styles.faner} role="tablist" aria-label="Visning">
          <button
            type="button"
            role="tab"
            aria-selected={fane === "dagsplan"}
            className={`${styles.faneBtn}${fane === "dagsplan" ? ` ${styles.faneBtnAktiv}` : ""}`}
            onClick={() => setFane("dagsplan")}
          >
            Dagsplan
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={fane === "katalog"}
            className={`${styles.faneBtn}${fane === "katalog" ? ` ${styles.faneBtnAktiv}` : ""}`}
            onClick={() => setFane("katalog")}
          >
            Katalog ({hentinger.length})
          </button>
        </div>
      </header>

      {fane === "dagsplan" ? (
        <>
          <div className={styles.datoBar}>
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
              className={`${styles.shortcut}${dato === iDag ? ` ${styles.shortcutAktiv}` : ""}`}
              onClick={() => setDato(iDag)}
            >
              I dag
            </button>
            <button
              type="button"
              className={`${styles.shortcut}${dato === iMorgen ? ` ${styles.shortcutAktiv}` : ""}`}
              onClick={() => setDato(iMorgen)}
            >
              I morgen
            </button>
            <span className={styles.datoLang}>{formatPlanDatoLang(dato)}</span>
          </div>

          {aktiveHentinger.length === 0 ? (
            <div className={styles.empty}>
              Ingen hentinger i katalogen ennå. Gå til <strong>Katalog</strong> og legg inn
              henteoppdragene dine først.
            </div>
          ) : (
            <div className={styles.dagsplanGrid}>
              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>
                  Velg henteoppdrag <span className={styles.panelTall}>{antallValgt} valgt</span>
                </h2>
                <div className={styles.velgListe}>
                  <div className={styles.velgSeksjonLabel}>
                    Aktuelle {DAG_LANG[ukedag - 1].toLowerCase()} ({aktuelle.length})
                  </div>
                  {aktuelle.length === 0 ? (
                    <p className={styles.tomLiten}>Ingen hentinger satt opp for denne ukedagen.</p>
                  ) : (
                    aktuelle.map((h) => renderVelgRad(h))
                  )}

                  {andre.length > 0 && (
                    <>
                      <div className={styles.velgSeksjonLabel}>Andre hentinger ({andre.length})</div>
                      {andre.map((h) => renderVelgRad(h))}
                    </>
                  )}
                </div>
              </section>

              <section className={`${styles.panel} ${styles.printOmrade}`}>
                <h2 className={styles.panelTitle}>
                  Henteliste
                  <button
                    type="button"
                    className={styles.printBtn}
                    onClick={() => window.print()}
                    disabled={antallValgt === 0}
                  >
                    Skriv ut
                  </button>
                </h2>
                <div className={styles.printTittel}>
                  Henteoppdrag · {formatPlanDatoLang(dato)}
                </div>
                {henteliste.length === 0 ? (
                  <p className={styles.tom}>Hak av hentinger til venstre for å bygge lista.</p>
                ) : (
                  <div className={styles.resultat}>
                    {henteliste.map((g) => (
                      <div key={g.rute || "__uten__"} className={styles.resultatGruppe}>
                        <div className={styles.resultatRute}>
                          <span>{ruteEtikett(g.rute)}</span>
                          {g.sjåfør ? (
                            <span className={styles.resultatSjåfør}>{g.sjåfør}</span>
                          ) : (
                            <span className={styles.resultatSjåførTom}>ingen sjåfør</span>
                          )}
                        </div>
                        <ul className={styles.resultatListe}>
                          {g.rader.map((r) => (
                            <li key={r.key} className={styles.resultatRad}>
                              <span>{r.kunde}</span>
                              {r.antall && <span className={styles.resultatAntall}>{r.antall}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={styles.katalogBar}>
            <button type="button" className={styles.primaryBtn} onClick={åpneNy}>
              Ny henting
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Kunde</th>
                  <th>Hentedager</th>
                  <th>Antall</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {katalogSortert.map((h) => (
                  <tr
                    key={h.id}
                    className={styles.row}
                    tabIndex={0}
                    role="button"
                    aria-label={`Rediger ${h.kunde}`}
                    onClick={() => åpneRediger(h)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        åpneRediger(h);
                      }
                    }}
                  >
                    <td className={styles.cellKunde}>{h.kunde}</td>
                    <td className={styles.muted}>{ukeSammendrag(h)}</td>
                    <td className={styles.muted}>{h.antall ?? "—"}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${h.aktiv ? styles.badgeAktiv : styles.badgeInaktiv}`}
                      >
                        {h.aktiv ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                  </tr>
                ))}
                {katalogSortert.length === 0 && (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      Ingen hentinger registrert. Klikk «Ny henting».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalÅpen && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={skjema.id ? "Rediger henting" : "Ny henting"}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) lukkModal();
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{skjema.id ? "Rediger henting" : "Ny henting"}</div>
              <button type="button" className={styles.closeBtn} onClick={lukkModal} aria-label="Lukk">
                Lukk
              </button>
            </div>
            <form className={styles.modalBody} onSubmit={lagreSkjema}>
              <div className={styles.field}>
                <label className={styles.label}>Kunde *</label>
                <input
                  className={styles.input}
                  value={skjema.kunde}
                  onChange={(e) => setSkjema((s) => ({ ...s, kunde: e.target.value }))}
                  required
                  autoFocus
                  placeholder="F.eks. Nortura"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Ukeoppsett – rute(r) per dag</label>
                <div className={styles.ukeEditor}>
                  {DAG_KORT.map((navn, i) => {
                    const dag = i + 1;
                    return (
                      <div key={dag} className={styles.ukeRad}>
                        <span className={styles.ukeDag}>{navn}</span>
                        <RuteVelgerFlere
                          ruter={skjema.ukeRuter[dag] ?? []}
                          options={ruteOptions}
                          ruteEtikett={ruteEtikett}
                          ariaLabel={`Ruter ${DAG_LANG[i]}`}
                          onEndre={(ruter) => settSkjemaDag(dag, ruter)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Antall (valgfritt)</label>
                <input
                  className={styles.input}
                  value={skjema.antall}
                  onChange={(e) => setSkjema((s) => ({ ...s, antall: e.target.value }))}
                  placeholder="F.eks. 3 paller"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Kommentar (valgfritt)</label>
                <input
                  className={styles.input}
                  value={skjema.kommentar}
                  onChange={(e) => setSkjema((s) => ({ ...s, kommentar: e.target.value }))}
                />
              </div>
              <label className={styles.checkRad}>
                <input
                  type="checkbox"
                  checked={skjema.aktiv}
                  onChange={(e) => setSkjema((s) => ({ ...s, aktiv: e.target.checked }))}
                />
                Aktiv (vises i dagsplanen)
              </label>

              <div className={styles.modalFooter}>
                {skjema.id && (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => {
                      const h = hentinger.find((x) => x.id === skjema.id);
                      if (h) bekreftSlett(h);
                    }}
                  >
                    Slett
                  </button>
                )}
                <span className={styles.footerSpacer} />
                <button type="button" className={styles.secondaryBtn} onClick={lukkModal}>
                  Avbryt
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  Lagre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bekreftDialog}
    </div>
  );
}
