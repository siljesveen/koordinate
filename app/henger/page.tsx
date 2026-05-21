"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fullNavn, type Ansatt, type Henger } from "@/lib/domain";
import { iDagISO } from "@/lib/dagsoversikt";
import { erHengerUtilgjengeligPåDato } from "@/lib/kjoretoyTilgjengelighet";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useHengerStore } from "@/lib/state/hengerStore";
import { useHengerUtilgjengeligStore } from "@/lib/state/hengerUtilgjengeligStore";
import { useModulSøkFraUrl } from "@/lib/hooks/useModulSøkFraUrl";
import { hengerMatcherModulSøk } from "@/lib/utils/søkMatch";
import { usePlanRuteTildelingStore } from "@/lib/state/planRuteTildelingStore";
import styles from "./page.module.css";

type HengerSkjema = {
  id: string;
  kjennemerke: string;
  type: string;
  aktiv: "ja" | "nei";
  kommentar: string;
};

function toSkjema(h: Henger | null): HengerSkjema {
  if (!h) {
    return {
      id: "",
      kjennemerke: "",
      type: "",
      aktiv: "ja",
      kommentar: "",
    };
  }
  return {
    id: h.id,
    kjennemerke: h.kjennemerke,
    type: h.type ?? "",
    aktiv: h.aktiv ? "ja" : "nei",
    kommentar: h.kommentar ?? "",
  };
}

export default function HengerPage() {
  const { ansatte, setAnsatte } = useAnsattStore();
  const { hengere, lagre, slett } = useHengerStore();
  const { poster: hengerUtilgjengelig } = useHengerUtilgjengeligStore();
  const { fjernReferanser: fjernTildelingRef } = usePlanRuteTildelingStore();
  const iDag = useMemo(() => iDagISO(), []);

  const [søk, setSøk] = useModulSøkFraUrl();
  const [modalÅpen, setModalÅpen] = useState(false);
  const [redigererId, setRedigererId] = useState<string | null>(null);
  const [skjema, setSkjema] = useState<HengerSkjema>(() => toSkjema(null));

  const ansatteMedFastHenger = useMemo(() => {
    const m = new Map<string, Ansatt[]>();
    for (const a of ansatte) {
      if (!a.fastHengerId) continue;
      const list = m.get(a.fastHengerId) ?? [];
      list.push(a);
      m.set(a.fastHengerId, list);
    }
    return m;
  }, [ansatte]);

  const redigerer = useMemo(
    () => (redigererId ? hengere.find((h) => h.id === redigererId) ?? null : null),
    [hengere, redigererId],
  );

  const synlige = useMemo(() => {
    const q = søk.trim();
    return hengere
      .filter((h) => {
        const sjåfører = (ansatteMedFastHenger.get(h.id) ?? []).map((a) => fullNavn(a));
        return hengerMatcherModulSøk(h, q, sjåfører);
      })
      .sort((a, b) => a.kjennemerke.localeCompare(b.kjennemerke, "nb", { numeric: true }));
  }, [hengere, søk, ansatteMedFastHenger]);

  function åpneNy() {
    setRedigererId(null);
    setSkjema(toSkjema(null));
    setModalÅpen(true);
  }

  function åpneRedigering(h: Henger) {
    setRedigererId(h.id);
    setSkjema(toSkjema(h));
    setModalÅpen(true);
  }

  function lukk() {
    setModalÅpen(false);
    setRedigererId(null);
  }

  function slettHenger() {
    if (!redigererId) return;
    if (typeof window !== "undefined" && !window.confirm(`Slette hengeren ${skjema.kjennemerke || redigerer?.kjennemerke}?`)) {
      return;
    }
    setAnsatte((prev) =>
      prev.map((a) => (a.fastHengerId === redigererId ? { ...a, fastHengerId: undefined } : a)),
    );
    fjernTildelingRef("hengerId", redigererId);
    slett(redigererId);
    lukk();
  }

  function lagreSkjema(e: React.FormEvent) {
    e.preventDefault();
    const km = skjema.kjennemerke.trim();
    if (!km) return;

    const item: Henger = {
      id:
        redigererId ??
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `henger-${Date.now()}`),
      kjennemerke: km,
      type: skjema.type.trim() ? skjema.type.trim() : undefined,
      aktiv: skjema.aktiv === "ja",
      kommentar: skjema.kommentar.trim() ? skjema.kommentar.trim() : undefined,
    };

    lagre(item);
    lukk();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Henger</h1>
          <p className={styles.helper}>
            Registrerte hengere. Fast tilknytning settes under Ansatte.{" "}
            <Link href="/verksted?tab=hengere">Verksted · hengere</Link>.
          </p>
        </div>
        <div className={styles.controls}>
          <input
            className={styles.input}
            value={søk}
            onChange={(e) => setSøk(e.target.value)}
            placeholder="Søk reg.nr, sjåfør, type…"
            aria-label="Søk hengere"
          />
          <button type="button" className={styles.primaryBtn} onClick={åpneNy}>
            Ny henger
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
            {synlige.map((h) => {
              const sjåfører = ansatteMedFastHenger.get(h.id) ?? [];
              const utilgjengeligIDag = erHengerUtilgjengeligPåDato(h.id, iDag, hengerUtilgjengelig);
              return (
                <tr
                  key={h.id}
                  className={styles.row}
                  tabIndex={0}
                  role="button"
                  aria-label={`Rediger ${h.kjennemerke}`}
                  onClick={() => åpneRedigering(h)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      åpneRedigering(h);
                    }
                  }}
                >
                  <td className={styles.kjennemerke}>{h.kjennemerke}</td>
                  <td className={styles.sjåfør}>
                    {sjåfører.length
                      ? sjåfører.map((a) => fullNavn(a)).join(", ")
                      : "—"}
                  </td>
                  <td>
                    <span
                      className={
                        utilgjengeligIDag
                          ? `${styles.badge} ${styles.badgeUtilgjengelig}`
                          : `${styles.badge} ${styles.badgeDisponibel}`
                      }
                    >
                      {utilgjengeligIDag ? "Utilgjengelig" : "Disponibel"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {synlige.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.empty}>
                  Ingen hengere registrert.
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
          aria-label={redigerer ? "Rediger henger" : "Ny henger"}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) lukk();
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>{redigerer ? "Rediger henger" : "Ny henger"}</div>
                <div className={styles.helper}>Knytt til sjåfør via ansattkortet.</div>
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
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Type</label>
                  <input
                    className={styles.input}
                    value={skjema.type}
                    onChange={(e) => setSkjema((s) => ({ ...s, type: e.target.value }))}
                    placeholder="F.eks. kjøl, kapell"
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
                    onClick={slettHenger}
                  >
                    Slett henger
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
