"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Henger, HengerUtilgjengelig, KjøretøyUtilgjengeligType } from "@/lib/domain";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useHengerStore } from "@/lib/state/hengerStore";
import { useHengerUtilgjengeligStore } from "@/lib/state/hengerUtilgjengeligStore";
import { useKjoretoySøkHenger } from "@/lib/hooks/useKjoretoySøkMedAnsatte";
import SokbarVelger from "@/components/SokbarVelger";
import { useBekreftDialog } from "@/components/useBekreftDialog";
import styles from "@/app/fravaer/page.module.css";

const TYPER: KjøretøyUtilgjengeligType[] = [
  "Vedlikehold",
  "Havari",
  "Service",
  "Inspeksjon",
  "Annet",
];

type Skjema = {
  id: string;
  hengerId: string;
  type: KjøretøyUtilgjengeligType;
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

function hengerTekst(h: Henger): string {
  return h.type ? `${h.kjennemerke} · ${h.type}` : h.kjennemerke;
}

function toSkjema(item: HengerUtilgjengelig | null, hengere: Henger[]): Skjema {
  if (!item) {
    return {
      id: "",
      hengerId: hengere[0]?.id ?? "",
      type: "Vedlikehold",
      fraDato: isoIDag(),
      tilDato: isoIDag(),
      planlagt: "ja",
      kommentar: "",
    };
  }
  return {
    id: item.id,
    hengerId: item.hengerId,
    type: item.type,
    fraDato: item.fraDato,
    tilDato: item.tilDato,
    planlagt: item.planlagt ? "ja" : "nei",
    kommentar: item.kommentar ?? "",
  };
}

export default function HengerUtilgjengeligPage() {
  const { requestBekreft, dialog: bekreftDialog } = useBekreftDialog();
  const { ansatte } = useAnsattStore();
  const { hengere } = useHengerStore();
  const hengerVelgerValg = useMemo(
    () =>
      hengere.map((h) => ({
        value: h.id,
        label: hengerTekst(h),
        søkTekst: [h.kjennemerke, h.type].filter(Boolean).join(" "),
        hint: h.aktiv ? undefined : "inaktiv",
      })),
    [hengere],
  );
  const { poster, lagre, slett } = useHengerUtilgjengeligStore();

  const hengerById = useMemo(() => new Map(hengere.map((h) => [h.id, h] as const)), [hengere]);
  const kjoretoySøkHenger = useKjoretoySøkHenger(ansatte, hengere);

  const [søk, setSøk] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | KjøretøyUtilgjengeligType>("");

  const [modalÅpen, setModalÅpen] = useState(false);
  const [redigererId, setRedigererId] = useState<string | null>(null);
  const [skjema, setSkjema] = useState<Skjema>(() => toSkjema(null, hengere));

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
        const h = hengerById.get(p.hengerId);
        if (!h) return p.hengerId.toLowerCase().includes(q);
        return hengerTekst(h).toLowerCase().includes(q);
      })
      .sort((a, b) => (b.fraDato + b.tilDato).localeCompare(a.fraDato + a.tilDato));
  }, [hengerById, poster, søk, typeFilter]);

  function åpneNy() {
    setRedigererId(null);
    setSkjema(toSkjema(null, hengere));
    setModalÅpen(true);
  }

  function åpneRedigering(item: HengerUtilgjengelig) {
    setRedigererId(item.id);
    setSkjema(toSkjema(item, hengere));
    setModalÅpen(true);
  }

  function lukk() {
    setModalÅpen(false);
    setRedigererId(null);
  }

  async function slettPeriode() {
    if (!redigererId) return;
    const h = hengerById.get(skjema.hengerId);
    const navn = h ? hengerTekst(h) : skjema.hengerId;
    const ok = await requestBekreft(`Slette utilgjengelighetsperioden for ${navn}?`, {
      bekreftTekst: "Slett",
    });
    if (!ok) return;
    slett(redigererId);
    lukk();
  }

  function lagreSkjema(e: React.FormEvent) {
    e.preventDefault();
    if (!skjema.hengerId || !skjema.fraDato || !skjema.tilDato) return;
    if (skjema.fraDato > skjema.tilDato) {
      alert("Fra-dato kan ikke være etter til-dato.");
      return;
    }

    const item: HengerUtilgjengelig = {
      id:
        redigererId ??
        (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `hu-${Date.now()}`),
      hengerId: skjema.hengerId,
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
          <h1 className={styles.title}>Henger · utilgjengelighet</h1>
          <p className={styles.helper}>
            Registrer perioder hengeren ikke kan brukes — planlagt eller akutt.
          </p>
          <p className={styles.helper}>
            <Link href="/kjoretoy-utilgjengelig">← Tilbake til kjøretøy</Link>
            {" · "}
            <Link href="/henger">Hengerregister</Link>
          </p>
        </div>
        <div className={styles.controls}>
          <input
            className={styles.input}
            value={søk}
            onChange={(e) => setSøk(e.target.value)}
            placeholder="Søk henger"
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
          <button type="button" className={styles.primaryBtn} onClick={åpneNy} disabled={!hengere.length}>
            Ny periode
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Henger</th>
              <th scope="col">Årsak</th>
              <th scope="col">Periode</th>
              <th scope="col">Planlagt</th>
              <th scope="col">Kommentar</th>
            </tr>
          </thead>
          <tbody>
            {synlige.map((p) => {
              const h = hengerById.get(p.hengerId);
              return (
                <tr
                  key={p.id}
                  className={styles.row}
                  tabIndex={0}
                  role="button"
                  aria-label={`Rediger periode for ${h ? hengerTekst(h) : p.hengerId}`}
                  onClick={() => åpneRedigering(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      åpneRedigering(p);
                    }
                  }}
                >
                  <td className={styles.cellPrimary}>{h ? hengerTekst(h) : p.hengerId}</td>
                  <td className={styles.muted}>{p.type}</td>
                  <td className={styles.muted}>
                    {p.fraDato} → {p.tilDato}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${p.planlagt ? styles.badgePlanned : styles.badgeUnplanned}`}
                    >
                      {p.planlagt ? "Planlagt" : "Akutt"}
                    </span>
                  </td>
                  <td className={styles.muted}>{p.kommentar ?? "—"}</td>
                </tr>
              );
            })}
            {synlige.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
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
                <div className={styles.helper}>Hengeren kan ikke disponeres i dette datointervallet.</div>
              </div>
              <button type="button" className={styles.closeBtn} onClick={lukk} aria-label="Lukk">
                Lukk
              </button>
            </div>
            <form className={styles.modalBody} onSubmit={lagreSkjema}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Henger *</label>
                  <SokbarVelger
                    value={skjema.hengerId}
                    onChange={(id) => setSkjema((s) => ({ ...s, hengerId: id }))}
                    options={hengerVelgerValg}
                    visTom={false}
                    ariaLabel="Velg henger"
                    tomTreffTekst="Ingen henger funnet"
                    kjoretoySøkMedAnsatte={kjoretoySøkHenger}
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
                {redigerer ? (
                  <button
                    type="button"
                    className={`${styles.secondaryBtn} ${styles.dangerBtn}`}
                    onClick={slettPeriode}
                  >
                    Slett periode
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
      {bekreftDialog}
    </div>
  );
}
