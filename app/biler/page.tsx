"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fullNavn, type Ansatt, type Bil } from "@/lib/domain";
import { iDagISO } from "@/lib/dagsoversikt";
import { erBilUtilgjengeligPåDato } from "@/lib/kjoretoyTilgjengelighet";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useBilStore } from "@/lib/state/bilStore";
import { useBilUtilgjengeligStore } from "@/lib/state/bilUtilgjengeligStore";
import { usePlanRuteTildelingStore } from "@/lib/state/planRuteTildelingStore";
import styles from "./page.module.css";

type BilSkjema = {
  id: string;
  kjennemerke: string;
  merke: string;
  modell: string;
  aktiv: "ja" | "nei";
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
      kommentar: "",
    };
  }
  return {
    id: b.id,
    kjennemerke: b.kjennemerke,
    merke: b.merke ?? "",
    modell: b.modell ?? "",
    aktiv: b.aktiv ? "ja" : "nei",
    kommentar: b.kommentar ?? "",
  };
}

export default function BilerPage() {
  const { ansatte, setAnsatte } = useAnsattStore();
  const { biler, lagre, slett } = useBilStore();
  const { poster: bilUtilgjengelig } = useBilUtilgjengeligStore();
  const { fjernReferanser: fjernTildelingRef } = usePlanRuteTildelingStore();
  const iDag = useMemo(() => iDagISO(), []);

  const [søk, setSøk] = useState("");
  const [modalÅpen, setModalÅpen] = useState(false);
  const [redigererId, setRedigererId] = useState<string | null>(null);
  const [skjema, setSkjema] = useState<BilSkjema>(() => toSkjema(null));

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

  const redigerer = useMemo(
    () => (redigererId ? biler.find((b) => b.id === redigererId) ?? null : null),
    [biler, redigererId],
  );

  const synlige = useMemo(() => {
    const q = søk.trim().toLowerCase();
    return biler
      .filter((b) => {
        if (!q) return true;
        const h = `${b.kjennemerke} ${b.merke ?? ""} ${b.modell ?? ""}`.toLowerCase();
        return h.includes(q);
      })
      .sort((a, b) => a.kjennemerke.localeCompare(b.kjennemerke, "nb", { numeric: true }));
  }, [biler, søk]);

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

  function slettBil(id: string) {
    setAnsatte((prev) =>
      prev.map((a) => (a.fastBilId === id ? { ...a, fastBilId: undefined } : a)),
    );
    fjernTildelingRef("bilId", id);
    slett(id);
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
      kommentar: skjema.kommentar.trim() ? skjema.kommentar.trim() : undefined,
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
            Registrerte kjøretøy. Fast sjåfør settes under Ansatte.{" "}
            <Link href="/biler/utilgjengelig">Utilgjengelighetsperioder</Link>.
          </p>
        </div>
        <div className={styles.controls}>
          <input
            className={styles.input}
            value={søk}
            onChange={(e) => setSøk(e.target.value)}
            placeholder="Søk (kjennemerke, merke …)"
            aria-label="Søk"
          />
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
              <th scope="col">Merke / modell</th>
              <th scope="col">Status</th>
              <th scope="col">Fast sjåfør</th>
              <th scope="col">I dag</th>
              <th scope="col">Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {synlige.map((b) => {
              const sjåfører = ansatteMedFastBil.get(b.id) ?? [];
              const utilgjengeligIDag = erBilUtilgjengeligPåDato(b.id, iDag, bilUtilgjengelig);
              return (
                <tr key={b.id}>
                  <td className={styles.muted}>{b.kjennemerke}</td>
                  <td className={styles.muted}>
                    {[b.merke, b.modell].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td>
                    <span className={styles.badge}>{b.aktiv ? "Aktiv" : "Inaktiv"}</span>
                  </td>
                  <td className={styles.muted}>
                    {sjåfører.length
                      ? sjåfører.map((a) => fullNavn(a)).join(", ")
                      : "—"}
                  </td>
                  <td>
                    <span
                      className={styles.badge}
                      style={
                        utilgjengeligIDag
                          ? { background: "#fef3c7", borderColor: "#fcd34d", color: "#92400e" }
                          : { background: "#dcfce7", borderColor: "#86efac", color: "#14532d" }
                      }
                    >
                      {utilgjengeligIDag ? "Utilgjengelig" : "Disponibel"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" className={styles.secondaryBtn} onClick={() => åpneRedigering(b)}>
                        Rediger
                      </button>
                      <button
                        type="button"
                        className={`${styles.secondaryBtn} ${styles.dangerBtn}`}
                        onClick={() => {
                          if (typeof window !== "undefined" && !window.confirm("Slette denne bilen?")) return;
                          slettBil(b.id);
                        }}
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
