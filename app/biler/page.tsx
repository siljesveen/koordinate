"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fullNavn, BIL_TILHØRIGHETER, type Ansatt, type Bil, type BilTilhørighet } from "@/lib/domain";
import { iDagISO } from "@/lib/dagsoversikt";
import { erBilUtilgjengeligPåDato } from "@/lib/kjoretoyTilgjengelighet";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useBilStore } from "@/lib/state/bilStore";
import { useBilUtilgjengeligStore } from "@/lib/state/bilUtilgjengeligStore";
import { useModulSøkFraUrl } from "@/lib/hooks/useModulSøkFraUrl";
import { bilMatcherModulSøk } from "@/lib/utils/søkMatch";
import { usePlanRuteTildelingStore } from "@/lib/state/planRuteTildelingStore";
import styles from "./page.module.css";

type BilSkjema = {
  id: string;
  kjennemerke: string;
  merke: string;
  modell: string;
  aktiv: "ja" | "nei";
  tilhørighet: "" | BilTilhørighet;
  kommentar: string;
};

function toSkjema(b: Bil | null): BilSkjema {
  if (!b) {
    return {
      id: "",
      kjennemerke: "",
      merke: "",
      modell: "",
      aktiv: "ja",
      tilhørighet: "",
      kommentar: "",
    };
  }
  return {
    id: b.id,
    kjennemerke: b.kjennemerke,
    merke: b.merke ?? "",
    modell: b.modell ?? "",
    aktiv: b.aktiv ? "ja" : "nei",
    tilhørighet: b.tilhørighet ?? "",
    kommentar: b.kommentar ?? "",
  };
}

export default function BilerPage() {
  const { ansatte, setAnsatte } = useAnsattStore();
  const { biler, lagre, slett } = useBilStore();
  const { poster: bilUtilgjengelig } = useBilUtilgjengeligStore();
  const { fjernReferanser: fjernTildelingRef } = usePlanRuteTildelingStore();
  const iDag = useMemo(() => iDagISO(), []);

  const [søk, setSøk] = useModulSøkFraUrl();
  const [modalÅpen, setModalÅpen] = useState(false);
  const [redigererId, setRedigererId] = useState<string | null>(null);
  const [skjema, setSkjema] = useState<BilSkjema>(() => toSkjema(null));

  const ansattById = useMemo(() => new Map(ansatte.map((a) => [a.id, a] as const)), [ansatte]);

  const ansatteMedFastBil = useMemo(() => {
    const m = new Map<string, Ansatt[]>();
    for (const a of ansatte) {
      if (!a.fastBilId) continue;
      const list = m.get(a.fastBilId) ?? [];
      list.push(a);
      m.set(a.fastBilId, list);
    }
    return m;
  }, [ansatte]);

  const sjåførerForBil = useMemo(() => {
    return (b: Bil): Ansatt[] => {
      if (b.fastSjåførAnsattIds?.length) {
        return b.fastSjåførAnsattIds.map((id) => ansattById.get(id)).filter(Boolean) as Ansatt[];
      }
      return ansatteMedFastBil.get(b.id) ?? [];
    };
  }, [ansattById, ansatteMedFastBil]);

  const redigerer = useMemo(
    () => (redigererId ? biler.find((b) => b.id === redigererId) ?? null : null),
    [biler, redigererId],
  );

  const synlige = useMemo(() => {
    const q = søk.trim();
    return biler
      .filter((b) => {
        const sjåfører = sjåførerForBil(b).map((a) => fullNavn(a));
        return bilMatcherModulSøk(b, q, sjåfører);
      })
      .sort((a, b) => a.kjennemerke.localeCompare(b.kjennemerke, "nb", { numeric: true }));
  }, [biler, søk, sjåførerForBil]);

  function åpneNy() {
    setRedigererId(null);
    setSkjema(toSkjema(null));
    setModalÅpen(true);
  }

  function åpneRedigering(b: Bil) {
    setRedigererId(b.id);
    setSkjema(toSkjema(b));
    setModalÅpen(true);
  }

  function lukk() {
    setModalÅpen(false);
    setRedigererId(null);
  }

  function slettBil() {
    if (!redigererId) return;
    if (typeof window !== "undefined" && !window.confirm(`Slette bilen ${skjema.kjennemerke || redigerer?.kjennemerke}?`)) {
      return;
    }
    setAnsatte((prev) =>
      prev.map((a) => (a.fastBilId === redigererId ? { ...a, fastBilId: undefined } : a)),
    );
    fjernTildelingRef("bilId", redigererId);
    slett(redigererId);
    lukk();
  }

  function lagreSkjema(e: React.FormEvent) {
    e.preventDefault();
    const km = skjema.kjennemerke.trim();
    if (!km) return;

    const item: Bil = {
      id:
        redigererId ??
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `bil-${Date.now()}`),
      kjennemerke: km,
      merke: skjema.merke.trim() ? skjema.merke.trim() : undefined,
      modell: skjema.modell.trim() ? skjema.modell.trim() : undefined,
      aktiv: skjema.aktiv === "ja",
      tilhørighet: skjema.tilhørighet || undefined,
      kommentar: skjema.kommentar.trim() ? skjema.kommentar.trim() : undefined,
      fastSjåførAnsattIds: redigerer?.fastSjåførAnsattIds,
    };

    lagre(item);
    lukk();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Biler</h1>
          <p className={styles.helper}>
            Registrerte kjøretøy. Koble fast sjåfør via ansattkortet.{" "}
            <Link href="/verksted">Verksted</Link> (kalender og utilgjengelighetsperioder).
          </p>
        </div>
        <div className={styles.controls}>
          <input
            className={styles.input}
            value={søk}
            onChange={(e) => setSøk(e.target.value)}
            placeholder="Søk reg.nr, sjåfør, merke…"
            aria-label="Søk biler"
          />
          <Link href="/verksted" className={styles.secondaryBtn}>
            Verksted
          </Link>
          <button type="button" className={styles.primaryBtn} onClick={åpneNy}>
            Ny bil
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Kjennemerke</th>
              <th scope="col">Fast sjåfør</th>
              <th scope="col">I dag</th>
            </tr>
          </thead>
          <tbody>
            {synlige.map((b) => {
              const sjåfører = sjåførerForBil(b);
              const utilgjengeligIDag = erBilUtilgjengeligPåDato(b.id, iDag, bilUtilgjengelig);
              return (
                <tr
                  key={b.id}
                  className={styles.row}
                  tabIndex={0}
                  role="button"
                  aria-label={`Rediger ${b.kjennemerke}`}
                  onClick={() => åpneRedigering(b)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      åpneRedigering(b);
                    }
                  }}
                >
                  <td className={styles.kjennemerke}>{b.kjennemerke}</td>
                  <td className={styles.sjåfør}>
                    {sjåfører.length ? (
                      sjåfører
                        .map((a) => {
                          const navn = fullNavn(a);
                          return a.selskap && a.selskap !== "Asko" ? `${navn} (${a.selskap})` : navn;
                        })
                        .join(", ")
                    ) : b.tilhørighet ? (
                      <span
                        className={`${styles.tilhorighet} ${
                          b.tilhørighet === "Reserve" ? styles.tilhorighetReserve : ""
                        }`}
                      >
                        {b.tilhørighet}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        !b.aktiv
                          ? `${styles.badge} ${styles.badgeInaktiv}`
                          : utilgjengeligIDag
                            ? `${styles.badge} ${styles.badgeUtilgjengelig}`
                            : `${styles.badge} ${styles.badgeDisponibel}`
                      }
                    >
                      {!b.aktiv ? "Inaktiv" : utilgjengeligIDag ? "Utilgjengelig" : "Disponibel"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {synlige.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.empty}>
                  Ingen biler registrert.
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
          aria-label={redigerer ? "Rediger bil" : "Ny bil"}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) lukk();
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>{redigerer ? "Rediger bil" : "Ny bil"}</div>
                <div className={styles.helper}>Knytt bil til sjåfør via ansattkortet.</div>
              </div>
              <button type="button" className={styles.closeBtn} onClick={lukk} aria-label="Lukk">
                Lukk
              </button>
            </div>
            <form className={styles.modalBody} onSubmit={lagreSkjema}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Kjennemerke *</label>
                  <input
                    className={styles.input}
                    value={skjema.kjennemerke}
                    onChange={(e) => setSkjema((s) => ({ ...s, kjennemerke: e.target.value }))}
                    required
                    placeholder="AB 12345"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Merke</label>
                  <input
                    className={styles.input}
                    value={skjema.merke}
                    onChange={(e) => setSkjema((s) => ({ ...s, merke: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Modell</label>
                  <input
                    className={styles.input}
                    value={skjema.modell}
                    onChange={(e) => setSkjema((s) => ({ ...s, modell: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Aktiv</label>
                  <select
                    className={styles.select}
                    value={skjema.aktiv}
                    onChange={(e) => setSkjema((s) => ({ ...s, aktiv: e.target.value as "ja" | "nei" }))}
                  >
                    <option value="ja">Aktiv</option>
                    <option value="nei">Inaktiv</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Tilhørighet / reserve</label>
                  <select
                    className={styles.select}
                    value={skjema.tilhørighet}
                    onChange={(e) =>
                      setSkjema((s) => ({ ...s, tilhørighet: e.target.value as "" | BilTilhørighet }))
                    }
                  >
                    <option value="">Vanlig bil (fast sjåfør)</option>
                    {BIL_TILHØRIGHETER.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
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
                {redigerer ? (
                  <button
                    type="button"
                    className={`${styles.secondaryBtn} ${styles.dangerBtn}`}
                    onClick={slettBil}
                  >
                    Slett bil
                  </button>
                ) : null}
                <div className={styles.formActionsMain}>
                  <button type="button" className={styles.secondaryBtn} onClick={lukk}>
                    Avbryt
                  </button>
                  <button type="submit" className={styles.primaryBtn}>
                    Lagre
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
