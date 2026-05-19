"use client";

import { useMemo, useState } from "react";
import type { Bil, BilUtilgjengelig, KjøretøyUtilgjengeligType } from "@/lib/domain";
import {
  bilMerkeTilbakeBekreftMelding,
  bilPeriodeKanMerkesTilbake,
  erUtilgjengeligPeriodeÅpen,
  formatUtilgjengeligPeriode,
  utilgjengeligPeriodeSorterKey,
} from "@/lib/kjoretoyTilgjengelighet";
import { useBilStore } from "@/lib/state/bilStore";
import { useMerkBilTilbake } from "@/lib/hooks/useMerkBilTilbake";
import { useBilUtilgjengeligStore } from "@/lib/state/bilUtilgjengeligStore";
import SokbarVelger from "@/components/SokbarVelger";
import styles from "@/app/fravaer/page.module.css";

const TYPER: KjøretøyUtilgjengeligType[] = [
  "Verksted",
  "Vedlikehold",
  "Havari",
  "Service",
  "Inspeksjon",
  "Annet",
];

type Skjema = {
  id: string;
  bilId: string;
  type: KjøretøyUtilgjengeligType;
  fraDato: string;
  tilDato: string;
  utenSluttdato: boolean;
  planlagt: "ja" | "nei";
  kommentar: string;
};

function isoIDag(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function bilTekst(b: Bil): string {
  const mm = [b.merke, b.modell].filter(Boolean).join(" ");
  return mm ? `${b.kjennemerke} · ${mm}` : b.kjennemerke;
}

function toSkjema(item: BilUtilgjengelig | null, biler: Bil[]): Skjema {
  if (!item) {
    return {
      id: "",
      bilId: biler[0]?.id ?? "",
      type: "Verksted",
      fraDato: isoIDag(),
      tilDato: isoIDag(),
      utenSluttdato: false,
      planlagt: "ja",
      kommentar: "",
    };
  }
  return {
    id: item.id,
    bilId: item.bilId,
    type: item.type,
    fraDato: item.fraDato,
    tilDato: item.tilDato ?? "",
    utenSluttdato: erUtilgjengeligPeriodeÅpen(item),
    planlagt: item.planlagt ? "ja" : "nei",
    kommentar: item.kommentar ?? "",
  };
}

export function BilPerioderTab() {
  const { biler } = useBilStore();
  const bilVelgerValg = useMemo(
    () =>
      biler.map((b) => ({
        value: b.id,
        label: bilTekst(b),
        søkTekst: [b.kjennemerke, b.merke, b.modell].filter(Boolean).join(" "),
        hint: b.aktiv ? undefined : "inaktiv",
      })),
    [biler],
  );
  const { poster, lagre, slett } = useBilUtilgjengeligStore();
  const merkTilbake = useMerkBilTilbake();

  const bilById = useMemo(() => new Map(biler.map((b) => [b.id, b] as const)), [biler]);

  const [søk, setSøk] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | KjøretøyUtilgjengeligType>("");

  const [modalÅpen, setModalÅpen] = useState(false);
  const [redigererId, setRedigererId] = useState<string | null>(null);
  const [skjema, setSkjema] = useState<Skjema>(() => toSkjema(null, biler));

  const redigerer = useMemo(
    () => (redigererId ? poster.find((p) => p.id === redigererId) ?? null : null),
    [poster, redigererId],
  );

  const synlige = useMemo(() => {
    const q = søk.trim().toLowerCase();
    return poster
      .filter((p) => {
        if (typeFilter && p.type !== typeFilter) return false;
        return true;
      })
      .filter((p) => {
        if (!q) return true;
        const b = bilById.get(p.bilId);
        if (!b) return p.bilId.toLowerCase().includes(q);
        return bilTekst(b).toLowerCase().includes(q);
      })
      .sort((a, b) =>
        utilgjengeligPeriodeSorterKey(b).localeCompare(utilgjengeligPeriodeSorterKey(a)),
      );
  }, [bilById, poster, søk, typeFilter]);

  function åpneNy() {
    setRedigererId(null);
    setSkjema(toSkjema(null, biler));
    setModalÅpen(true);
  }

  function åpneRedigering(item: BilUtilgjengelig) {
    setRedigererId(item.id);
    setSkjema(toSkjema(item, biler));
    setModalÅpen(true);
  }

  function lukk() {
    setModalÅpen(false);
    setRedigererId(null);
  }

  function lagreSkjema(e: React.FormEvent) {
    e.preventDefault();
    if (!skjema.bilId || !skjema.fraDato) return;
    if (!skjema.utenSluttdato && !skjema.tilDato) return;
    if (!skjema.utenSluttdato && skjema.fraDato > skjema.tilDato) {
      alert("Fra-dato kan ikke være etter til-dato.");
      return;
    }

    const item: BilUtilgjengelig = {
      id:
        redigererId ??
        (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `bu-${Date.now()}`),
      bilId: skjema.bilId,
      type: skjema.type,
      fraDato: skjema.fraDato,
      tilDato: skjema.utenSluttdato ? undefined : skjema.tilDato,
      planlagt: skjema.planlagt === "ja",
      kommentar: skjema.kommentar.trim() ? skjema.kommentar.trim() : undefined,
    };

    lagre(item);
    lukk();
  }

  function bekreftOgMerkTilbake(p: BilUtilgjengelig) {
    if (!bilPeriodeKanMerkesTilbake(p)) return;
    const b = bilById.get(p.bilId);
    const navn = b ? bilTekst(b) : p.bilId;
    if (window.confirm(bilMerkeTilbakeBekreftMelding(p, navn))) {
      void merkTilbake(p.id, { kjennemerke: navn });
    }
  }

  return (
    <>
      <header className={styles.header}>
        <div className={styles.controls}>
          <input
            className={styles.input}
            value={søk}
            onChange={(e) => setSøk(e.target.value)}
            placeholder="Søk bil"
            aria-label="Søk"
          />
          <select
            className={styles.select}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | KjøretøyUtilgjengeligType)}
            aria-label="Filter type"
          >
            <option value="">Alle typer</option>
            {TYPER.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button type="button" className={styles.primaryBtn} onClick={åpneNy} disabled={!biler.length}>
            Ny periode
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Bil</th>
              <th scope="col">Årsak</th>
              <th scope="col">Periode</th>
              <th scope="col">Planlagt</th>
              <th scope="col">Kommentar</th>
              <th scope="col">Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {synlige.map((p) => {
              const b = bilById.get(p.bilId);
              return (
                <tr key={p.id}>
                  <td>{b ? bilTekst(b) : p.bilId}</td>
                  <td className={styles.muted}>{p.type}</td>
                  <td className={styles.muted}>
                    {formatUtilgjengeligPeriode(p.fraDato, p.tilDato)}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${p.planlagt ? styles.badgePlanned : styles.badgeUnplanned}`}
                    >
                      {p.planlagt ? "Planlagt" : "Akutt"}
                    </span>
                  </td>
                  <td className={styles.muted}>{p.kommentar ?? "—"}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={!bilPeriodeKanMerkesTilbake(p)}
                        title={
                          bilPeriodeKanMerkesTilbake(p)
                            ? erUtilgjengeligPeriodeÅpen(p)
                              ? undefined
                              : "Forkort nedetiden til i dag – bil kan brukes i plan fra nå av"
                            : "Ikke aktiv for plan lengre"
                        }
                        onClick={() => bekreftOgMerkTilbake(p)}
                      >
                        Tilbake
                      </button>
                      <button type="button" className={styles.secondaryBtn} onClick={() => åpneRedigering(p)}>
                        Rediger
                      </button>
                      <button
                        type="button"
                        className={`${styles.secondaryBtn} ${styles.dangerBtn}`}
                        onClick={() => slett(p.id)}
                      >
                        Slett
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {synlige.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.helper}>
                  Ingen perioder registrert.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {modalÅpen ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={redigerer ? "Rediger utilgjengelighet" : "Ny utilgjengelighetsperiode"}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) lukk();
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>
                  {redigerer ? "Rediger periode" : "Ny utilgjengelighetsperiode"}
                </div>
                <div className={styles.helper}>Bilen kan ikke disponeres i dette datointervallet.</div>
              </div>
              <button type="button" className={styles.closeBtn} onClick={lukk} aria-label="Lukk">
                Lukk
              </button>
            </div>
            <form className={styles.modalBody} onSubmit={lagreSkjema}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Bil *</label>
                  <SokbarVelger
                    value={skjema.bilId}
                    onChange={(id) => setSkjema((s) => ({ ...s, bilId: id }))}
                    options={bilVelgerValg}
                    visTom={false}
                    ariaLabel="Velg bil"
                    søkPlaceholder="Søk reg.nr…"
                    tomTreffTekst="Ingen bil funnet"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Årsak *</label>
                  <select
                    className={styles.select}
                    value={skjema.type}
                    onChange={(e) =>
                      setSkjema((s) => ({ ...s, type: e.target.value as KjøretøyUtilgjengeligType }))
                    }
                    required
                  >
                    {TYPER.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Fra dato *</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={skjema.fraDato}
                    onChange={(e) => setSkjema((s) => ({ ...s, fraDato: e.target.value }))}
                    required
                  />
                </div>
                <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                  <label className={styles.label}>
                    <input
                      type="checkbox"
                      checked={skjema.utenSluttdato}
                      onChange={(e) =>
                        setSkjema((s) => ({
                          ...s,
                          utenSluttdato: e.target.checked,
                        }))
                      }
                    />{" "}
                    Uten sluttdato (bilen er utilgjengelig til noen merker den tilbake)
                  </label>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Til dato{skjema.utenSluttdato ? "" : " *"}
                  </label>
                  <input
                    className={styles.input}
                    type="date"
                    value={skjema.tilDato}
                    onChange={(e) => setSkjema((s) => ({ ...s, tilDato: e.target.value }))}
                    disabled={skjema.utenSluttdato}
                    required={!skjema.utenSluttdato}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Planlagt *</label>
                  <select
                    className={styles.select}
                    value={skjema.planlagt}
                    onChange={(e) => setSkjema((s) => ({ ...s, planlagt: e.target.value as "ja" | "nei" }))}
                    required
                  >
                    <option value="ja">Planlagt</option>
                    <option value="nei">Akutt / uplanlagt</option>
                  </select>
                </div>

                <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                  <label className={styles.label}>Kommentar</label>
                  <textarea
                    className={styles.textarea}
                    value={skjema.kommentar}
                    onChange={(e) => setSkjema((s) => ({ ...s, kommentar: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.secondaryBtn} onClick={lukk}>
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
    </>
  );
}
