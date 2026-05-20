"use client";

import { useMemo, useState } from "react";
import type { Bil, BilUtilgjengelig } from "@/lib/domain";
import {
  bilMerkeTilbakeBekreftMelding,
  bilPeriodeKanMerkesTilbake,
  dagerIUtilgjengeligPeriode,
  erMedIVerkstedBorteIDagListe,
  erUtilgjengeligPeriodeÅpen,
  formatUtilgjengeligPeriode,
  isoDato,
  parseISODateInput,
} from "@/lib/kjoretoyTilgjengelighet";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useBilStore } from "@/lib/state/bilStore";
import { useMerkBilTilbake } from "@/lib/hooks/useMerkBilTilbake";
import { useBilUtilgjengeligStore } from "@/lib/state/bilUtilgjengeligStore";
import { useKjoretoySøkBil } from "@/lib/hooks/useKjoretoySøkMedAnsatte";
import SokbarVelger from "@/components/SokbarVelger";
import styles from "./page.module.css";

const UKEDAGER = ["ma", "ti", "on", "to", "fr", "lø", "sø"] as const;

function isoIDag(): string {
  return isoDato(new Date());
}

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

function overlapperMåned(p: { fraDato: string; tilDato?: string }, månedFørste: string, månedSiste: string): boolean {
  if (p.fraDato > månedSiste) return false;
  if (p.tilDato && p.tilDato < månedFørste) return false;
  return true;
}

function barGridSpan(
  p: BilUtilgjengelig,
  månedFørste: string,
  månedSiste: string,
): { start: number; end: number } {
  const effektivStart = p.fraDato > månedFørste ? p.fraDato : månedFørste;
  const effektivSlutt = !p.tilDato
    ? månedSiste
    : p.tilDato < månedSiste
      ? p.tilDato
      : månedSiste;
  const startDag = parseISODateInput(effektivStart).getDate();
  const sluttDag = parseISODateInput(effektivSlutt).getDate();
  return { start: startDag, end: sluttDag + 1 };
}

function barKlasse(p: BilUtilgjengelig): string {
  if (erUtilgjengeligPeriodeÅpen(p)) return styles.barÅpen;
  if (p.type === "Verksted") return styles.barVerksted;
  return styles.barAnnet;
}

function badgeKlasse(p: BilUtilgjengelig): string {
  if (erUtilgjengeligPeriodeÅpen(p)) return styles.badgePågår;
  if (p.type === "Verksted") return styles.badgeVerksted;
  return styles.badgeAnnet;
}

type VerkstedSkjema = {
  bilId: string;
  fraDato: string;
  tilDato: string;
  utenSluttdato: boolean;
  kommentar: string;
};

function nyttSkjema(biler: Bil[]): VerkstedSkjema {
  const iDag = isoIDag();
  return {
    bilId: biler[0]?.id ?? "",
    fraDato: iDag,
    tilDato: iDag,
    utenSluttdato: false,
    kommentar: "",
  };
}

function bilEtikett(b: Bil): string {
  const mm = [b.merke, b.modell].filter(Boolean).join(" ");
  return mm ? `${b.kjennemerke} · ${mm}` : b.kjennemerke;
}

export default function BilVerkstedKalenderPage() {
  const { ansatte } = useAnsattStore();
  const { biler } = useBilStore();
  const kjoretoySøkBil = useKjoretoySøkBil(ansatte, biler);
  const bilVelgerValg = useMemo(
    () =>
      biler.map((b) => ({
        value: b.id,
        label: bilEtikett(b),
        søkTekst: [b.kjennemerke, b.merke, b.modell].filter(Boolean).join(" "),
      })),
    [biler],
  );
  const { poster, lagre } = useBilUtilgjengeligStore();
  const merkTilbake = useMerkBilTilbake();

  const [visMåned, setVisMåned] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [søk, setSøk] = useState("");
  const [kunMedAktivitet, setKunMedAktivitet] = useState(true);
  const [modalÅpen, setModalÅpen] = useState(false);
  const [skjema, setSkjema] = useState<VerkstedSkjema>(() => nyttSkjema([]));

  const iDag = useMemo(() => isoIDag(), []);

  const bilById = useMemo(() => new Map(biler.map((b) => [b.id, b] as const)), [biler]);

  const år = visMåned.getFullYear();
  const måned = visMåned.getMonth();
  const antallDager = dagerIMåned(år, måned);

  const månedLabel = useMemo(
    () =>
      visMåned.toLocaleDateString("nb-NO", {
        month: "long",
        year: "numeric",
      }),
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

  const posterForBil = useMemo(() => {
    const m = new Map<string, BilUtilgjengelig[]>();
    for (const p of poster) {
      const list = m.get(p.bilId) ?? [];
      list.push(p);
      m.set(p.bilId, list);
    }
    return m;
  }, [poster]);

  const påVerkstedNå = useMemo(() => {
    return poster
      .filter((p) => erMedIVerkstedBorteIDagListe(iDag, p))
      .sort((a, b) => {
        const åpenA = erUtilgjengeligPeriodeÅpen(a) ? 0 : 1;
        const åpenB = erUtilgjengeligPeriodeÅpen(b) ? 0 : 1;
        if (åpenA !== åpenB) return åpenA - åpenB;
        const ba = bilById.get(a.bilId)?.kjennemerke ?? "";
        const bb = bilById.get(b.bilId)?.kjennemerke ?? "";
        return ba.localeCompare(bb, "nb", { numeric: true });
      });
  }, [bilById, iDag, poster]);

  const stats = useMemo(() => {
    const utilgjengeligIDag = påVerkstedNå.length;
    const verkstedIDag = påVerkstedNå.filter((p) => p.type === "Verksted").length;
    const utenRetur = påVerkstedNå.filter((p) => erUtilgjengeligPeriodeÅpen(p)).length;
    return { utilgjengeligIDag, verkstedIDag, utenRetur };
  }, [påVerkstedNå]);

  const iDagKolonne = useMemo(() => dagListe.findIndex((d) => d.erIDag) + 1, [dagListe]);

  const synligeBiler = useMemo(() => {
    const q = søk.trim().toLowerCase();
    return biler
      .filter((b) => {
        if (!q) return true;
        return `${b.kjennemerke} ${b.merke ?? ""} ${b.modell ?? ""}`.toLowerCase().includes(q);
      })
      .filter((b) => {
        if (!kunMedAktivitet) return true;
        const list = posterForBil.get(b.id) ?? [];
        return list.some((p) => overlapperMåned(p, månedFørste, månedSiste));
      })
      .sort((a, b) => a.kjennemerke.localeCompare(b.kjennemerke, "nb", { numeric: true }));
  }, [biler, søk, kunMedAktivitet, posterForBil, månedFørste, månedSiste]);

  const gridCols = `5.75rem repeat(${antallDager}, minmax(1.65rem, 1fr))`;

  function perioderIMåned(bilId: string): BilUtilgjengelig[] {
    return (posterForBil.get(bilId) ?? [])
      .filter((p) => overlapperMåned(p, månedFørste, månedSiste))
      .sort((a, b) => a.fraDato.localeCompare(b.fraDato));
  }

  function forrigeMåned() {
    setVisMåned((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nesteMåned() {
    setVisMåned((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function gåTilIDag() {
    const n = new Date();
    setVisMåned(new Date(n.getFullYear(), n.getMonth(), 1));
  }

  function åpneSettPåVerksted(bilId?: string) {
    setSkjema({ ...nyttSkjema(biler), bilId: bilId ?? biler[0]?.id ?? "" });
    setModalÅpen(true);
  }

  function lukkModal() {
    setModalÅpen(false);
  }

  function lagreVerksted(e: React.FormEvent) {
    e.preventDefault();
    if (!skjema.bilId || !skjema.fraDato) return;
    if (!skjema.utenSluttdato && !skjema.tilDato) return;
    if (!skjema.utenSluttdato && skjema.fraDato > skjema.tilDato) {
      alert("Fra-dato kan ikke være etter til-dato.");
      return;
    }

    const item: BilUtilgjengelig = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `bu-${Date.now()}`,
      bilId: skjema.bilId,
      type: "Verksted",
      fraDato: skjema.fraDato,
      tilDato: skjema.utenSluttdato ? undefined : skjema.tilDato,
      planlagt: true,
      kommentar: skjema.kommentar.trim() ? skjema.kommentar.trim() : undefined,
    };

    lagre(item);
    const fra = parseISODateInput(skjema.fraDato);
    setVisMåned(new Date(fra.getFullYear(), fra.getMonth(), 1));
    lukkModal();
  }

  function bekreftOgMerkTilbake(p: BilUtilgjengelig) {
    if (!bilPeriodeKanMerkesTilbake(p)) return;
    const b = bilById.get(p.bilId);
    const navn = b?.kjennemerke ?? p.bilId;
    const melding = bilMerkeTilbakeBekreftMelding(p, navn);
    if (window.confirm(melding)) {
      void merkTilbake(p.id, { kjennemerke: navn });
    }
  }

  function håndterBarKlikk(p: BilUtilgjengelig) {
    bekreftOgMerkTilbake(p);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Verksted</h1>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden>
              ⌕
            </span>
            <input
              className={styles.input}
              value={søk}
              onChange={(e) => setSøk(e.target.value)}
              placeholder="Søk reg.nr …"
              aria-label="Søk bil"
            />
          </div>
          <div className={styles.monthNav}>
            <button type="button" className={styles.iconBtn} onClick={forrigeMåned} aria-label="Forrige måned">
              ‹
            </button>
            <span className={styles.monthLabel}>{månedLabel}</span>
            <button type="button" className={styles.iconBtn} onClick={nesteMåned} aria-label="Neste måned">
              ›
            </button>
            <button type="button" className={styles.iconBtn} onClick={gåTilIDag} title="Gå til inneværende måned">
              ●
            </button>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={kunMedAktivitet}
              onChange={(e) => setKunMedAktivitet(e.target.checked)}
            />
            Kun aktive
          </label>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => åpneSettPåVerksted()}
            disabled={!biler.length}
          >
            + På verksted
          </button>
        </div>
      </header>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.utilgjengeligIDag}</div>
          <div className={styles.statLabel}>Utilgjengelig i dag</div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardWarn}`}>
          <div className={styles.statValue}>{stats.verkstedIDag}</div>
          <div className={styles.statLabel}>På verksted</div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardOpen}`}>
          <div className={styles.statValue}>{stats.utenRetur}</div>
          <div className={styles.statLabel}>Uten returdato</div>
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>I dag · {påVerkstedNå.length}</div>
          </div>
          <div className={styles.panelBody}>
            {påVerkstedNå.length === 0 ? (
              <p className={styles.emptyPanel}>Alle ledige</p>
            ) : (
              <ul className={styles.vehicleList}>
                {påVerkstedNå.map((p) => {
                  const b = bilById.get(p.bilId);
                  const dager = dagerIUtilgjengeligPeriode(p.fraDato, p.tilDato, iDag);
                  const åpen = erUtilgjengeligPeriodeÅpen(p);
                  return (
                    <li
                      key={p.id}
                      className={`${styles.vehicleCard} ${åpen ? styles.vehicleCardOpen : ""}`}
                    >
                      <div className={styles.vehicleCardHead}>
                        <span className={styles.vehicleReg}>{b?.kjennemerke ?? p.bilId}</span>
                        <span className={`${styles.badge} ${badgeKlasse(p)}`}>
                          {åpen ? "Pågår" : p.type}
                        </span>
                      </div>
                      <div className={styles.vehiclePeriod}>
                        <span className={styles.durationPill}>{dager}d</span>
                        {!åpen && p.type !== "Verksted" ? (
                          <span className={styles.typeTag}>{p.type}</span>
                        ) : null}
                      </div>
                      {p.kommentar ? (
                        <p className={styles.vehicleComment}>{p.kommentar}</p>
                      ) : null}
                      <button
                        type="button"
                        className={styles.cardBtnPrimary}
                        disabled={!bilPeriodeKanMerkesTilbake(p)}
                        title={
                          bilPeriodeKanMerkesTilbake(p)
                            ? åpen
                              ? undefined
                              : "Forkort nedetiden til i dag – bil kan brukes i plan fra nå av"
                            : "Ikke aktiv for plan lengre"
                        }
                        onClick={() => bekreftOgMerkTilbake(p)}
                      >
                        Tilbake
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className={styles.timelineSection}>
          <div className={styles.timelineScroll}>
            {synligeBiler.length === 0 ? (
              <p className={styles.ganttEmpty}>
                {kunMedAktivitet ? "Ingen perioder" : "Ingen treff"}
              </p>
            ) : (
              <div className={styles.gantt}>
                <div className={styles.ganttHeader} style={{ gridTemplateColumns: gridCols }}>
                  <div className={styles.ganttLabelCol}>Bil</div>
                  {dagListe.map(({ dag, iso, helg, erIDag, ukedag }) => (
                    <div
                      key={iso}
                      className={`${styles.dayHead} ${helg ? styles.dayHeadWeekend : ""} ${erIDag ? styles.dayHeadToday : ""}`}
                      title={iso}
                    >
                      <div className={styles.dayNum}>{dag}</div>
                      <div className={styles.dayWd}>{ukedag}</div>
                    </div>
                  ))}
                </div>

                {synligeBiler.map((b) => {
                  const perioder = perioderIMåned(b.id);
                  return (
                    <div
                      key={b.id}
                      className={`${styles.ganttRow} ${!b.aktiv ? styles.ganttRowInactive : ""}`}
                      style={{ gridTemplateColumns: gridCols }}
                    >
                      <div className={styles.bilLabel} title={b.kjennemerke}>
                        <span className={styles.bilReg}>{b.kjennemerke}</span>
                      </div>

                      <div
                        className={styles.ganttTrack}
                        style={{ gridColumn: `2 / span ${antallDager}` }}
                      >
                        {dagListe.map(({ iso, helg, erIDag }) => (
                          <div
                            key={iso}
                            className={`${styles.dayCell} ${helg ? styles.dayCellWeekend : ""} ${erIDag ? styles.dayCellToday : ""}`}
                          />
                        ))}

                        {iDagKolonne > 0 ? (
                          <div
                            className={styles.todayMarker}
                            style={{
                              left: `${((iDagKolonne - 0.5) / antallDager) * 100}%`,
                            }}
                            aria-hidden
                          />
                        ) : null}

                        <div className={styles.barsLayer}>
                          {perioder.map((p) => {
                            const { start, end } = barGridSpan(p, månedFørste, månedSiste);
                            const harKommentar = Boolean(p.kommentar?.trim());
                            const barBred = end - start;
                            return (
                              <div
                                key={p.id}
                                className={styles.barRow}
                                style={{ gridTemplateColumns: `repeat(${antallDager}, minmax(1.65rem, 1fr))` }}
                              >
                                <button
                                  type="button"
                                  className={`${styles.ganttBar} ${barKlasse(p)} ${harKommentar ? styles.ganttBarMedKommentar : ""}`}
                                  style={{ gridColumn: `${start} / ${end}` }}
                                  disabled={!bilPeriodeKanMerkesTilbake(p)}
                                  title={`${p.type}: ${formatUtilgjengeligPeriode(p.fraDato, p.tilDato)}${harKommentar ? ` — ${p.kommentar}` : ""}${bilPeriodeKanMerkesTilbake(p) ? ". Klikk for tilbake" : ""}`}
                                  onClick={() => håndterBarKlikk(p)}
                                  aria-label={`${p.type} ${formatUtilgjengeligPeriode(p.fraDato, p.tilDato)}${harKommentar ? `. ${p.kommentar}` : ""}`}
                                >
                                  {harKommentar && barBred >= 3 ? (
                                    <span className={styles.barKommentarTekst}>{p.kommentar}</span>
                                  ) : harKommentar ? (
                                    <span className={styles.barKommentarIkon} aria-hidden>
                                      ●
                                    </span>
                                  ) : null}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchVerksted}`} /> Verksted
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchAnnet}`} /> Annet
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchÅpen}`} /> Åpen
            </span>
          </div>
        </section>
      </div>

      {modalÅpen ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Sett bil på verksted"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) lukkModal();
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>På verksted</div>
              <button type="button" className={styles.closeBtn} onClick={lukkModal} aria-label="Lukk">
                ×
              </button>
            </div>
            <form className={styles.modalBody} onSubmit={lagreVerksted}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label htmlFor="vk-bil">Bil</label>
                  <SokbarVelger
                    value={skjema.bilId}
                    onChange={(id) => setSkjema((s) => ({ ...s, bilId: id }))}
                    options={bilVelgerValg}
                    visTom={false}
                    ariaLabel="Velg bil"
                    tomTreffTekst="Ingen bil funnet"
                    kjoretoySøkMedAnsatte={kjoretoySøkBil}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="vk-fra">Fra dato</label>
                  <input
                    id="vk-fra"
                    className={styles.input}
                    type="date"
                    value={skjema.fraDato}
                    onChange={(e) => setSkjema((s) => ({ ...s, fraDato: e.target.value }))}
                    required
                  />
                </div>
                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={skjema.utenSluttdato}
                    onChange={(e) =>
                      setSkjema((s) => ({ ...s, utenSluttdato: e.target.checked }))
                    }
                  />
                  <span>Uten returdato</span>
                </label>
                <div className={styles.field}>
                  <label htmlFor="vk-til">Tilbake{skjema.utenSluttdato ? "" : " *"}</label>
                  <input
                    id="vk-til"
                    className={styles.input}
                    type="date"
                    value={skjema.tilDato}
                    onChange={(e) => setSkjema((s) => ({ ...s, tilDato: e.target.value }))}
                    disabled={skjema.utenSluttdato}
                    required={!skjema.utenSluttdato}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="vk-kom">Kommentar</label>
                  <textarea
                    id="vk-kom"
                    className={styles.textarea}
                    value={skjema.kommentar}
                    onChange={(e) => setSkjema((s) => ({ ...s, kommentar: e.target.value }))}
                    placeholder="Valgfritt"
                  />
                </div>
              </div>
              <div className={styles.formActions}>
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
      ) : null}
    </div>
  );
}
