"use client";

import { useMemo, useState } from "react";
import SokbarVelger from "@/components/SokbarVelger";
import { fullNavn, type Ansatt, type Fravær, type FraværType } from "@/lib/domain";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useFraværStore } from "@/lib/state/fravaerStore";
import { useModulSøkFraUrl } from "@/lib/hooks/useModulSøkFraUrl";
import { ansattMatcherModulSøk } from "@/lib/utils/søkMatch";
import styles from "./page.module.css";

type FraværSkjema = {
  id: string;
  ansattId: string;
  type: FraværType;
  fraDato: string;
  tilDato: string;
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

function toSkjema(item: Fravær | null, ansatte: Ansatt[]): FraværSkjema {
  if (!item) {
    return {
      id: "",
      ansattId: ansatte[0]?.id ?? "",
      type: "Syk",
      fraDato: isoIDag(),
      tilDato: isoIDag(),
      planlagt: "nei",
      kommentar: "",
    };
  }
  return {
    id: item.id,
    ansattId: item.ansattId,
    type: item.type,
    fraDato: item.fraDato,
    tilDato: item.tilDato,
    planlagt: item.planlagt ? "ja" : "nei",
    kommentar: item.kommentar ?? "",
  };
}

export default function FraværPage() {
  const { ansatte } = useAnsattStore();
  const aktiveAnsatte = useMemo(() => ansatte.filter((a) => a.aktiv), [ansatte]);
  const ansattById = useMemo(() => new Map(aktiveAnsatte.map((a) => [a.id, a] as const)), [aktiveAnsatte]);
  const ansattVelgerValg = useMemo(
    () =>
      aktiveAnsatte.map((a) => ({
        value: a.id,
        label: fullNavn(a),
        søkTekst: fullNavn(a),
      })),
    [aktiveAnsatte],
  );

  const { fravær, lagre, slett } = useFraværStore();

  const [søk, setSøk] = useModulSøkFraUrl();
  const [typeFilter, setTypeFilter] = useState<"" | FraværType>("");

  const [modalÅpen, setModalÅpen] = useState(false);
  const [redigererId, setRedigererId] = useState<string | null>(null);
  const [skjema, setSkjema] = useState<FraværSkjema>(() => toSkjema(null, aktiveAnsatte));

  const redigerer = useMemo(
    () => (redigererId ? fravær.find((f) => f.id === redigererId) ?? null : null),
    [fravær, redigererId],
  );

  const synlige = useMemo(() => {
    return fravær
      .filter((f) => {
        if (typeFilter && f.type !== typeFilter) return false;
        return true;
      })
      .filter((f) => {
        const q = søk.trim();
        if (!q) return true;
        const a = ansattById.get(f.ansattId);
        if (!a) return false;
        return (
          ansattMatcherModulSøk(a, q) ||
          f.type.toLowerCase().includes(q.toLowerCase()) ||
          (f.kommentar?.toLowerCase().includes(q.toLowerCase()) ?? false)
        );
      })
      .sort((a, b) => (b.fraDato + b.tilDato).localeCompare(a.fraDato + a.tilDato));
  }, [ansattById, fravær, søk, typeFilter]);

  function åpneNy() {
    setRedigererId(null);
    setSkjema(toSkjema(null, aktiveAnsatte));
    setModalÅpen(true);
  }

  function åpneRedigering(item: Fravær) {
    setRedigererId(item.id);
    setSkjema(toSkjema(item, aktiveAnsatte));
    setModalÅpen(true);
  }

  function lukk() {
    setModalÅpen(false);
    setRedigererId(null);
  }

  function lagreSkjema(e: React.FormEvent) {
    e.preventDefault();
    if (!skjema.ansattId) return;
    if (!skjema.fraDato || !skjema.tilDato) return;
    if (skjema.fraDato > skjema.tilDato) {
      alert("Fra-dato kan ikke være etter til-dato.");
      return;
    }

    const item: Fravær = {
      id: redigererId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `f-${Date.now()}`),
      ansattId: skjema.ansattId,
      type: skjema.type,
      fraDato: skjema.fraDato,
      tilDato: skjema.tilDato,
      planlagt: skjema.planlagt === "ja",
      kommentar: skjema.kommentar.trim() ? skjema.kommentar.trim() : undefined,
    };

    lagre(item);
    lukk();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Fravær</h1>
        </div>
        <div className={styles.controls}>
          <input
            className={styles.input}
            value={søk}
            onChange={(e) => setSøk(e.target.value)}
            placeholder="Søk navn, type…"
            aria-label="Søk fravær"
          />
          <select
            className={styles.select}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | FraværType)}
            aria-label="Filter type"
          >
            <option value="">Alle typer</option>
            <option value="Syk">Syk</option>
            <option value="Ferie">Ferie</option>
            <option value="Fri">Fri</option>
            <option value="Permisjon">Permisjon</option>
            <option value="Annet">Annet</option>
          </select>
          <button type="button" className={styles.primaryBtn} onClick={åpneNy} disabled={!aktiveAnsatte.length}>
            Nytt fravær
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Ansatt</th>
              <th scope="col">Type</th>
              <th scope="col">Periode</th>
              <th scope="col">Planlagt</th>
              <th scope="col">Kommentar</th>
              <th scope="col">Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {synlige.map((f) => {
              const a = ansattById.get(f.ansattId);
              return (
                <tr key={f.id}>
                  <td>{a ? fullNavn(a) : f.ansattId}</td>
                  <td className={styles.muted}>{f.type}</td>
                  <td className={styles.muted}>
                    {f.fraDato} → {f.tilDato}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${f.planlagt ? styles.badgePlanned : styles.badgeUnplanned}`}
                    >
                      {f.planlagt ? "Planlagt" : "Uplanlagt"}
                    </span>
                  </td>
                  <td className={styles.muted}>{f.kommentar ?? "—"}</td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" className={styles.secondaryBtn} onClick={() => åpneRedigering(f)}>
                        Rediger
                      </button>
                      <button
                        type="button"
                        className={`${styles.secondaryBtn} ${styles.dangerBtn}`}
                        onClick={() => slett(f.id)}
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
                  Ingen fravær registrert.
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
          aria-label={redigerer ? "Rediger fravær" : "Nytt fravær"}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) lukk();
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>{redigerer ? "Rediger fravær" : "Nytt fravær"}</div>
                <div className={styles.helper}>Registrer fravær som påvirker tilgjengelighet.</div>
              </div>
              <button type="button" className={styles.closeBtn} onClick={lukk} aria-label="Lukk">
                Lukk
              </button>
            </div>
            <form className={styles.modalBody} onSubmit={lagreSkjema}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Ansatt *</label>
                  <SokbarVelger
                    value={skjema.ansattId}
                    onChange={(id) => setSkjema((s) => ({ ...s, ansattId: id }))}
                    options={ansattVelgerValg}
                    visTom={false}
                    ariaLabel="Velg ansatt"
                    søkPlaceholder="Søk navn…"
                    tomTreffTekst="Ingen ansatt funnet"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Type *</label>
                  <select
                    className={styles.select}
                    value={skjema.type}
                    onChange={(e) => setSkjema((s) => ({ ...s, type: e.target.value as FraværType }))}
                    required
                  >
                    <option value="Syk">Syk</option>
                    <option value="Ferie">Ferie</option>
                    <option value="Fri">Fri</option>
                    <option value="Permisjon">Permisjon</option>
                    <option value="Annet">Annet</option>
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
                <div className={styles.field}>
                  <label className={styles.label}>Til dato *</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={skjema.tilDato}
                    onChange={(e) => setSkjema((s) => ({ ...s, tilDato: e.target.value }))}
                    required
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
                    <option value="nei">Uplanlagt</option>
                    <option value="ja">Planlagt</option>
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
    </div>
  );
}

