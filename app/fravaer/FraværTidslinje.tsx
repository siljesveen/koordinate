"use client";

import { useEffect, useMemo, useState } from "react";
import { fullNavn, FRAVÆR_TYPER, type Ansatt, type Fravær, type FraværType } from "@/lib/domain";
import { fraværVisningsEtikett } from "@/lib/utils/bemanningsplanKoder";
import { formatUtilgjengeligPeriode, isoDato, parseISODateInput } from "@/lib/kjoretoyTilgjengelighet";
import styles from "./page.module.css";

const UKEDAGER = ["ma", "ti", "on", "to", "fr", "lø", "sø"] as const;
const LABEL_BREDDE = "9rem";

type Props = {
  fravær: Fravær[];
  ansattById: Map<string, Ansatt>;
  onVelg: (item: Fravær) => void;
  /** Hopp til måned/dag etter import (ISO-dato). */
  fokusDato?: string | null;
};

type AnsattRad = {
  ansatt: Ansatt;
  perioderPerBane: Fravær[][];
  antallBaner: number;
};

type DagOversikt = {
  ansatt: Ansatt;
  fravær: Fravær;
};

function dagerIMåned(år: number, måned: number): number {
  return new Date(år, måned + 1, 0).getDate();
}

function erHelg(d: Date): boolean {
  const dag = d.getDay();
  return dag === 0 || dag === 6;
}

function ukedagKort(d: Date): string {
  const i = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return UKEDAGER[i];
}

function overlapperMåned(p: { fraDato: string; tilDato: string }, månedFørste: string, månedSiste: string): boolean {
  if (p.fraDato > månedSiste) return false;
  if (p.tilDato < månedFørste) return false;
  return true;
}

function overlapperPeriode(a: Fravær, b: Fravær): boolean {
  return a.fraDato <= b.tilDato && b.fraDato <= a.tilDato;
}

function tildelBaner(perioder: Fravær[]): { perioderPerBane: Fravær[][]; antallBaner: number } {
  if (perioder.length === 0) return { perioderPerBane: [], antallBaner: 1 };

  const sorted = [...perioder].sort(
    (a, b) => a.fraDato.localeCompare(b.fraDato) || a.tilDato.localeCompare(b.tilDato),
  );
  const baner: Fravær[][] = [];

  for (const p of sorted) {
    let plassert = false;
    for (const bane of baner) {
      if (!bane.some((eks) => overlapperPeriode(eks, p))) {
        bane.push(p);
        plassert = true;
        break;
      }
    }
    if (!plassert) baner.push([p]);
  }

  return { perioderPerBane: baner, antallBaner: baner.length };
}

function fraværPåDag(banePerioder: Fravær[], iso: string): Fravær | null {
  return banePerioder.find((p) => iso >= p.fraDato && iso <= p.tilDato) ?? null;
}

function periodeGridSpan(
  p: { fraDato: string; tilDato: string },
  månedFørste: string,
  månedSiste: string,
): { start: number; end: number } {
  const effektivStart = p.fraDato > månedFørste ? p.fraDato : månedFørste;
  const effektivSlutt = p.tilDato < månedSiste ? p.tilDato : månedSiste;
  const startDag = parseISODateInput(effektivStart).getDate();
  const sluttDag = parseISODateInput(effektivSlutt).getDate();
  return { start: startDag, end: sluttDag + 1 };
}

function celleFyllKlasse(type: FraværType): string {
  switch (type) {
    case "Syk":
      return styles.dagFyllSyk;
    case "Ferie":
      return styles.dagFyllFerie;
    case "Fri":
      return styles.dagFyllFri;
    case "Permisjon":
      return styles.dagFyllPermisjon;
    case "Avspasering":
      return styles.dagFyllAvspasering;
    default:
      return styles.dagFyllAnnet;
  }
}

function etikettKlasse(type: FraværType): string {
  switch (type) {
    case "Syk":
      return styles.etikettSyk;
    case "Ferie":
      return styles.etikettFerie;
    case "Fri":
      return styles.etikettFri;
    case "Permisjon":
      return styles.etikettPermisjon;
    case "Avspasering":
      return styles.etikettAvspasering;
    default:
      return styles.etikettAnnet;
  }
}

function swatchKlasse(type: FraværType): string {
  switch (type) {
    case "Syk":
      return styles.swatchSyk;
    case "Ferie":
      return styles.swatchFerie;
    case "Fri":
      return styles.swatchFri;
    case "Permisjon":
      return styles.swatchPermisjon;
    case "Avspasering":
      return styles.swatchAvspasering;
    default:
      return styles.swatchAnnet;
  }
}

function skiftDag(iso: string, delta: number, min: string, max: string): string | null {
  const d = parseISODateInput(iso);
  d.setDate(d.getDate() + delta);
  const neste = isoDato(d);
  if (neste < min || neste > max) return null;
  return neste;
}

export default function FraværTidslinje({ fravær, ansattById, onVelg, fokusDato }: Props) {
  const [visMåned, setVisMåned] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [valgtDagIso, setValgtDagIso] = useState<string | null>(null);

  const iDag = useMemo(() => isoDato(new Date()), []);
  const år = visMåned.getFullYear();
  const måned = visMåned.getMonth();
  const antallDager = dagerIMåned(år, måned);

  const månedLabel = useMemo(
    () => visMåned.toLocaleDateString("nb-NO", { month: "long", year: "numeric" }),
    [visMåned],
  );

  const dagListe = useMemo(() => {
    const list: { dag: number; iso: string; helg: boolean; erIDag: boolean; ukedag: string }[] = [];
    for (let d = 1; d <= antallDager; d++) {
      const date = new Date(år, måned, d);
      list.push({
        dag: d,
        iso: isoDato(date),
        helg: erHelg(date),
        erIDag: isoDato(date) === iDag,
        ukedag: ukedagKort(date),
      });
    }
    return list;
  }, [antallDager, år, måned, iDag]);

  const månedFørste = dagListe[0]?.iso ?? "";
  const månedSiste = dagListe[dagListe.length - 1]?.iso ?? "";
  const gridCols = `${LABEL_BREDDE} repeat(${antallDager}, minmax(1.65rem, 1fr))`;
  const dagKolonneCss = `repeat(${antallDager}, minmax(1.65rem, 1fr))`;

  useEffect(() => {
    const iMåned = dagListe.find((d) => d.erIDag);
    setValgtDagIso(iMåned?.iso ?? dagListe[0]?.iso ?? null);
  }, [dagListe]);

  useEffect(() => {
    if (!fokusDato) return;
    const d = parseISODateInput(fokusDato);
    setVisMåned(new Date(d.getFullYear(), d.getMonth(), 1));
    setValgtDagIso(fokusDato);
  }, [fokusDato]);

  const ansattRader = useMemo((): AnsattRad[] => {
    const perAnsatt = new Map<string, Fravær[]>();
    for (const p of fravær) {
      if (!overlapperMåned(p, månedFørste, månedSiste)) continue;
      if (!ansattById.has(p.ansattId)) continue;
      const list = perAnsatt.get(p.ansattId) ?? [];
      list.push(p);
      perAnsatt.set(p.ansattId, list);
    }

    return [...perAnsatt.entries()]
      .map(([id, perioder]) => {
        const ansatt = ansattById.get(id)!;
        const { perioderPerBane, antallBaner } = tildelBaner(perioder);
        return { ansatt, perioderPerBane, antallBaner };
      })
      .sort((a, b) => fullNavn(a.ansatt).localeCompare(fullNavn(b.ansatt), "nb"));
  }, [ansattById, fravær, månedFørste, månedSiste]);

  const antallPerioder = useMemo(
    () => ansattRader.reduce((sum, rad) => sum + rad.perioderPerBane.reduce((s, b) => s + b.length, 0), 0),
    [ansattRader],
  );

  const bortePåValgtDag = useMemo((): DagOversikt[] => {
    if (!valgtDagIso) return [];
    const funnet = new Map<string, DagOversikt>();

    for (const rad of ansattRader) {
      for (const bane of rad.perioderPerBane) {
        const treff = bane.find((p) => valgtDagIso >= p.fraDato && valgtDagIso <= p.tilDato);
        if (treff && !funnet.has(rad.ansatt.id)) {
          funnet.set(rad.ansatt.id, { ansatt: rad.ansatt, fravær: treff });
        }
      }
    }

    return [...funnet.values()].sort((a, b) => fullNavn(a.ansatt).localeCompare(fullNavn(b.ansatt), "nb"));
  }, [ansattRader, valgtDagIso]);

  const valgtDagLabel = useMemo(() => {
    if (!valgtDagIso) return "";
    const d = parseISODateInput(valgtDagIso);
    return d.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
  }, [valgtDagIso]);

  function forrigeMåned() {
    setVisMåned((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function nesteMåned() {
    setVisMåned((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function velgDag(iso: string) {
    setValgtDagIso(iso);
  }

  function forrigeDag() {
    if (!valgtDagIso) return;
    const neste = skiftDag(valgtDagIso, -1, månedFørste, månedSiste);
    if (neste) setValgtDagIso(neste);
  }

  function nesteDag() {
    if (!valgtDagIso) return;
    const neste = skiftDag(valgtDagIso, 1, månedFørste, månedSiste);
    if (neste) setValgtDagIso(neste);
  }

  return (
    <section className={styles.timelineSection}>
      <div className={styles.timelineToolbar}>
        <div className={styles.monthNav}>
          <button type="button" className={styles.monthBtn} onClick={forrigeMåned} aria-label="Forrige måned">
            ‹
          </button>
          <span className={styles.monthLabel}>{månedLabel}</span>
          <button type="button" className={styles.monthBtn} onClick={nesteMåned} aria-label="Neste måned">
            ›
          </button>
        </div>

        <div className={styles.dagVelger}>
          <button
            type="button"
            className={styles.monthBtn}
            onClick={forrigeDag}
            disabled={!valgtDagIso || valgtDagIso === månedFørste}
            aria-label="Forrige dag"
          >
            ‹
          </button>
          <input
            className={styles.dagVelgerInput}
            type="date"
            value={valgtDagIso ?? ""}
            min={månedFørste}
            max={månedSiste}
            onChange={(e) => {
              if (e.target.value) velgDag(e.target.value);
            }}
            aria-label="Velg dag i måneden"
          />
          <button
            type="button"
            className={styles.monthBtn}
            onClick={nesteDag}
            disabled={!valgtDagIso || valgtDagIso === månedSiste}
            aria-label="Neste dag"
          >
            ›
          </button>
        </div>

        <span className={styles.periodeTeller}>
          {ansattRader.length} ansatte · {antallPerioder} perioder
        </span>
      </div>

      {valgtDagIso ? (
        <div className={styles.dagOversikt} role="status">
          <div className={styles.dagOversiktHeader}>
            <span className={styles.dagOversiktDato}>{valgtDagLabel}</span>
            <span className={styles.dagOversiktAntall}>
              {bortePåValgtDag.length === 0
                ? "Ingen registrert fravær"
                : `${bortePåValgtDag.length} fraværende`}
            </span>
          </div>

          {bortePåValgtDag.length > 0 ? (
            <div className={styles.dagOversiktTabellWrap}>
              <table className={styles.dagOversiktTabell}>
                <thead>
                  <tr>
                    <th scope="col">Ansatt</th>
                    <th scope="col">Type</th>
                    <th scope="col">Kommentar</th>
                  </tr>
                </thead>
                <tbody>
                  {bortePåValgtDag.map(({ ansatt, fravær: f }) => (
                    <tr
                      key={`${ansatt.id}-${f.id}`}
                      className={styles.dagOversiktRad}
                      tabIndex={0}
                      role="button"
                      aria-label={`Rediger fravær for ${fullNavn(ansatt)}`}
                      onClick={() => onVelg(f)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onVelg(f);
                        }
                      }}
                    >
                      <td className={styles.dagOversiktNavn}>{fullNavn(ansatt)}</td>
                      <td>
                        <span className={`${styles.dagOversiktType} ${swatchKlasse(f.type)}`}>
                          {fraværVisningsEtikett(f)}
                        </span>
                      </td>
                      <td className={styles.dagOversiktKommentar}>{f.kommentar ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.legend}>
        {FRAVÆR_TYPER.map((type) => (
          <span key={type} className={styles.legendItem}>
            <span className={`${styles.swatch} ${swatchKlasse(type)}`} aria-hidden />
            {type}
          </span>
        ))}
      </div>

      <div className={styles.timelineScroll}>
        {ansattRader.length === 0 ? (
          <p className={styles.ganttEmpty}>Ingen fravær denne måneden</p>
        ) : (
          <div className={styles.gantt}>
            <div className={styles.ganttHeader} style={{ gridTemplateColumns: gridCols }}>
              <div className={styles.ganttLabelCol}>Ansatt</div>
              {dagListe.map(({ dag, iso, helg, erIDag, ukedag }) => (
                <button
                  key={iso}
                  type="button"
                  className={[
                    styles.dayHead,
                    helg ? styles.dayHeadWeekend : "",
                    erIDag ? styles.dayHeadToday : "",
                    valgtDagIso === iso ? styles.dayHeadValgt : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={iso}
                  aria-label={`Velg ${iso}${erIDag ? " (i dag)" : ""}`}
                  aria-pressed={valgtDagIso === iso}
                  onClick={() => velgDag(iso)}
                >
                  <div className={styles.dayNum}>{dag}</div>
                  <div className={styles.dayWd}>{ukedag}</div>
                </button>
              ))}
            </div>

            {ansattRader.map(({ ansatt, perioderPerBane, antallBaner }) => {
              const navn = fullNavn(ansatt);
              return (
                <div key={ansatt.id} className={styles.ganttRow} style={{ gridTemplateColumns: gridCols }}>
                  <div className={styles.ansattLabel} title={navn}>
                    <span className={styles.ansattNavn}>{navn}</span>
                  </div>

                  <div
                    className={styles.celleGrid}
                    style={{
                      gridColumn: `2 / span ${antallDager}`,
                      gridTemplateColumns: dagKolonneCss,
                      gridTemplateRows: `repeat(${antallBaner}, minmax(2.1rem, 1fr))`,
                    }}
                  >
                    {perioderPerBane.map((banePerioder, baneIdx) =>
                      dagListe.map(({ iso, helg, dag }) => {
                        const p = fraværPåDag(banePerioder, iso);
                        const erValgtKolonne = valgtDagIso === iso;
                        const periodeTekst = p ? formatUtilgjengeligPeriode(p.fraDato, p.tilDato) : "";

                        const klasser = [styles.dagCelle];
                        if (p) klasser.push(celleFyllKlasse(p.type));
                        else if (helg) klasser.push(styles.dagCelleTomHelg);
                        else klasser.push(styles.dagCelleTom);
                        if (erValgtKolonne) klasser.push(styles.dagKolonneValgt);

                        return (
                          <button
                            key={`${baneIdx}-${iso}`}
                            type="button"
                            className={klasser.join(" ")}
                            style={{ gridColumn: dag, gridRow: baneIdx + 1 }}
                            title={
                              p
                                ? `${fraværVisningsEtikett(p)}: ${periodeTekst}${p.kommentar ? ` — ${p.kommentar}` : ""}`
                                : iso
                            }
                            aria-label={
                              p
                                ? `${navn}: ${fraværVisningsEtikett(p)} ${periodeTekst}${p.kommentar ? `. ${p.kommentar}` : ""}`
                                : `${navn}: ledig ${iso}`
                            }
                            aria-pressed={erValgtKolonne}
                            onClick={() => velgDag(iso)}
                            onDoubleClick={() => p && onVelg(p)}
                          />
                        );
                      }),
                    )}

                    {perioderPerBane.flatMap((banePerioder, baneIdx) =>
                      banePerioder
                        .filter((p) => overlapperMåned(p, månedFørste, månedSiste))
                        .map((p) => {
                          const { start, end } = periodeGridSpan(p, månedFørste, månedSiste);
                          const periodeTekst = formatUtilgjengeligPeriode(p.fraDato, p.tilDato);
                          return (
                            <div
                              key={`etikett-${p.id}`}
                              className={`${styles.periodeEtikett} ${etikettKlasse(p.type)}`}
                              style={{ gridColumn: `${start} / ${end}`, gridRow: baneIdx + 1 }}
                              title={`${fraværVisningsEtikett(p)}: ${periodeTekst}${p.kommentar ? ` — ${p.kommentar}` : ""}`}
                              aria-hidden
                            >
                              <span className={styles.periodeType}>{fraværVisningsEtikett(p)}</span>
                              {p.kommentar ? (
                                <span className={styles.periodeKommentar}>{p.kommentar}</span>
                              ) : null}
                            </div>
                          );
                        }),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
