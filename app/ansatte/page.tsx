"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import SokbarVelger from "@/components/SokbarVelger";
import { MOCK_RUTER, fullNavn, type Ansatt, type AnsattSelskap, type Bil, type Fravær, type Henger } from "@/lib/domain";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useBilStore } from "@/lib/state/bilStore";
import { useFraværStore } from "@/lib/state/fravaerStore";
import { useHengerStore } from "@/lib/state/hengerStore";
import { useMasterplanStore } from "@/lib/state/masterplanStore";
import { usePlanRuteTildelingStore } from "@/lib/state/planRuteTildelingStore";
import { useKjoretoySøkBil, useKjoretoySøkHenger } from "@/lib/hooks/useKjoretoySøkMedAnsatte";
import { useModulSøkFraUrl } from "@/lib/hooks/useModulSøkFraUrl";
import { useAuth } from "@/lib/state/authStore";
import { ansattMatcherModulSøk } from "@/lib/utils/søkMatch";
import { sorterRutekoder } from "@/lib/utils/sort";
import { useBekreftDialog } from "@/components/useBekreftDialog";
import ModalPortal from "@/components/ModalPortal";
import TurnusKort from "@/components/TurnusKort";
import TurnusEditor from "@/components/TurnusEditor";
import styles from "./page.module.css";

type AktivFilter = "alle" | "aktiv" | "inaktiv";

type AnsattSkjema = {
  id: string;
  fornavn: string;
  etternavn: string;
  telefon: string;
  epost: string;
  rolle: string;
  avdeling: string;
  selskap: AnsattSelskap | "";
  stillingsprosent: string;
  kompetanse: string;
  førerkort: string;
  ruteIds: string[];
  fastBilId: string;
  fastHengerId: string;
  aktiv: boolean;
  kommentar: string;
};

/** Gjør like navn skillebare i sammenslåingsmodul (tlf., avdeling, intern id). */

function formatIsoDato(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function badgeClass(aktiv: boolean): string {
  return aktiv
    ? `${styles.badge} ${styles.badgeActive}`
    : `${styles.badge} ${styles.badgeInactive}`;
}

function toSkjema(ansatt?: Ansatt): AnsattSkjema {
  if (!ansatt) {
    return {
      id: "",
      fornavn: "",
      etternavn: "",
      telefon: "",
      epost: "",
      rolle: "",
      avdeling: "",
      selskap: "Asko",
      stillingsprosent: "100",
      kompetanse: "",
      førerkort: "",
      ruteIds: [],
      fastBilId: "",
      fastHengerId: "",
      aktiv: true,
      kommentar: "",
    };
  }

  return {
    id: ansatt.id,
    fornavn: ansatt.fornavn,
    etternavn: ansatt.etternavn,
    telefon: ansatt.telefon,
    epost: ansatt.epost,
    rolle: ansatt.rolle,
    avdeling: ansatt.avdeling,
    selskap: ansatt.selskap ?? "",
    stillingsprosent: String(ansatt.stillingsprosent),
    kompetanse: ansatt.kompetanse.join(", "),
    førerkort: ansatt.førerkort.join(", "),
    ruteIds: [...(ansatt.ruteIds ?? [])],
    fastBilId: ansatt.fastBilId ?? "",
    fastHengerId: ansatt.fastHengerId ?? "",
    aktiv: ansatt.aktiv,
    kommentar: ansatt.kommentar ?? "",
  };
}

function parseListe(verdi: string): string[] {
  return verdi
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function sanitizeStillingsprosent(verdi: string): number {
  const n = Number(verdi);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function nyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `a-${Date.now()}`;
}

function ruteEtikett(ruteId: string): string {
  const r = MOCK_RUTER.find((x) => x.id === ruteId);
  return r ? `${r.rutenummer} · ${r.rutenavn}` : ruteId;
}

function FraværListeBlokk({ rader }: { rader: Fravær[] }) {
  return (
    <div className={styles.fravaerSection}>
      <div className={styles.fravaerSectionTitle}>Fravær</div>
      {rader.length === 0 ? (
        <p className={styles.helper}>Ingen registrert fravær for denne ansatte.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className={styles.fravaerTable}>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Periode</th>
                <th scope="col">Merknad</th>
              </tr>
            </thead>
            <tbody>
              {rader.map((f) => (
                <tr key={f.id}>
                  <td>
                    <span className={styles.typePill}>{f.type}</span>
                  </td>
                  <td className={styles.muted}>
                    {formatIsoDato(f.fraDato)}
                    {f.tilDato !== f.fraDato ? ` – ${formatIsoDato(f.tilDato)}` : ""}
                  </td>
                  <td className={styles.muted}>{f.kommentar?.trim() ? f.kommentar.trim() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link href="/fravaer" className={styles.linkFravaer}>
        Åpne Fravær-modulen for å legge til eller endre
      </Link>
    </div>
  );
}

function DetailPair({ term, children }: { term: string; children: ReactNode }) {
  return (
    <Fragment>
      <dt className={styles.detailTerm}>{term}</dt>
      <dd className={styles.detailDef}>{children}</dd>
    </Fragment>
  );
}

function bilEtikettLang(b: Bil): string {
  const mm = [b.merke, b.modell].filter(Boolean).join(" ");
  return mm ? `${b.kjennemerke} · ${mm}` : b.kjennemerke;
}

function visFastBil(id: string | undefined, bil: Bil | undefined): ReactNode {
  if (!id) return <span className={styles.muted}>Ingen</span>;
  if (!bil) return <span className={styles.muted}>Ukjent bil (kan være slettet)</span>;
  return (
    <>
      {bilEtikettLang(bil)}
      {!bil.aktiv ? <span className={styles.muted}> (inaktiv)</span> : null}
    </>
  );
}

function visFastHenger(id: string | undefined, h: Henger | undefined): ReactNode {
  if (!id) return <span className={styles.muted}>Ingen</span>;
  if (!h) return <span className={styles.muted}>Ukjent henger (kan være slettet)</span>;
  return (
    <>
      {h.type ? `${h.kjennemerke} · ${h.type}` : h.kjennemerke}
      {!h.aktiv ? <span className={styles.muted}> (inaktiv)</span> : null}
    </>
  );
}

export default function AnsattePage() {
  const { canEdit } = useAuth();
  const { requestBekreft, dialog: bekreftDialog } = useBekreftDialog();
  const { ansatte, setAnsatte } = useAnsattStore();
  const { fravær, slettForAnsatt: slettFraværForAnsatt } = useFraværStore();
  const { biler, syncSjåførForAnsatt: syncBilSjåfør } = useBilStore();
  const { hengere, syncSjåførForAnsatt: syncHengerSjåfør } = useHengerStore();
  const { masterplan } = useMasterplanStore();
  const { fjernReferanser: fjernTildelingRef } = usePlanRuteTildelingStore();
  const [turnusUke, setTurnusUke] = useState<1 | 2>(1);
  const [turnusEditorÅpen, setTurnusEditorÅpen] = useState<string | null>(null);
  const [søk, setSøk] = useModulSøkFraUrl();
  const [filter, setFilter] = useState<AktivFilter>("aktiv");

  const [modalÅpen, setModalÅpen] = useState(false);
  const [redigererId, setRedigererId] = useState<string | null>(null);
  const [visId, setVisId] = useState<string | null>(null);
  const [skjema, setSkjema] = useState<AnsattSkjema>(() => toSkjema());

  const redigerer = useMemo(
    () => (redigererId ? ansatte.find((a) => a.id === redigererId) : undefined),
    [ansatte, redigererId],
  );

  const visAnsatt = useMemo(
    () => (visId ? ansatte.find((a) => a.id === visId) : undefined),
    [ansatte, visId],
  );

  const detaljAnsattId = redigererId ?? visId;
  const fraværForDetaljAnsatt = useMemo(() => {
    if (!detaljAnsattId) return [];
    return fravær
      .filter((f) => f.ansattId === detaljAnsattId)
      .sort(
        (a, b) =>
          a.fraDato.localeCompare(b.fraDato) ||
          a.tilDato.localeCompare(b.tilDato) ||
          a.id.localeCompare(b.id),
      );
  }, [fravær, detaljAnsattId]);

  useEffect(() => {
    if (visId && !visAnsatt) setVisId(null);
  }, [visId, visAnsatt]);

  useEffect(() => {
    if (!visId && !modalÅpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setModalÅpen(false);
      setRedigererId(null);
      setVisId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visId, modalÅpen]);

  const fasteRuterPerAnsatt = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const slot of masterplan.slots) {
      if (!slot.standardSjåførAnsattId) continue;
      if (!map.has(slot.standardSjåførAnsattId)) map.set(slot.standardSjåførAnsattId, new Set());
      map.get(slot.standardSjåførAnsattId)!.add(slot.rutekode);
    }
    return map;
  }, [masterplan.slots]);

  const bilVelgerValg = useMemo(
    () =>
      biler.map((b) => ({
        value: b.id,
        label: bilEtikettLang(b),
        søkTekst: [b.kjennemerke, b.merke, b.modell].filter(Boolean).join(" "),
        hint: b.aktiv ? undefined : "inaktiv",
      })),
    [biler],
  );

  const hengerVelgerValg = useMemo(
    () =>
      hengere.map((h) => ({
        value: h.id,
        label: h.type ? `${h.kjennemerke} · ${h.type}` : h.kjennemerke,
        søkTekst: [h.kjennemerke, h.type].filter(Boolean).join(" "),
        hint: h.aktiv ? undefined : "inaktiv",
      })),
    [hengere],
  );

  const bilById = useMemo(() => new Map(biler.map((b) => [b.id, b] as const)), [biler]);
  const hengerById = useMemo(() => new Map(hengere.map((h) => [h.id, h] as const)), [hengere]);
  const kjoretoySøkBil = useKjoretoySøkBil(ansatte, biler);
  const kjoretoySøkHenger = useKjoretoySøkHenger(ansatte, hengere);

  const rutekoderPerAnsatt = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const slot of masterplan.slots) {
      const id = slot.standardSjåførAnsattId;
      if (!id) continue;
      const liste = m.get(id) ?? [];
      if (!liste.includes(slot.rutekode)) liste.push(slot.rutekode);
      m.set(id, liste);
    }
    for (const [id, liste] of m) {
      m.set(id, sorterRutekoder(liste));
    }
    return m;
  }, [masterplan.slots]);

  const synlige = useMemo(() => {
    const q = søk.trim();
    return ansatte
      .filter((a) => {
        if (filter === "aktiv") return a.aktiv;
        if (filter === "inaktiv") return !a.aktiv;
        return true;
      })
      .filter((a) =>
        ansattMatcherModulSøk(a, q, {
          bilById,
          hengerById,
          rutekoder: rutekoderPerAnsatt.get(a.id),
        }),
      )
      .sort((a, b) => fullNavn(a).localeCompare(fullNavn(b), "nb"));
  }, [ansatte, filter, søk, bilById, hengerById, rutekoderPerAnsatt]);


  function åpneNy() {
    setVisId(null);
    setRedigererId(null);
    setSkjema(toSkjema());
    setModalÅpen(true);
  }

  function åpneVisning(ansatt: Ansatt) {
    setModalÅpen(false);
    setRedigererId(null);
    setVisId(ansatt.id);
  }

  function åpneRedigering(ansatt: Ansatt) {
    setVisId(null);
    setRedigererId(ansatt.id);
    setSkjema(toSkjema(ansatt));
    setModalÅpen(true);
  }

  function lukkModal() {
    setModalÅpen(false);
    setRedigererId(null);
  }

  function lukkVisning() {
    setVisId(null);
  }

  function redigerFraVisning() {
    if (!visAnsatt) return;
    setVisId(null);
    setRedigererId(visAnsatt.id);
    setSkjema(toSkjema(visAnsatt));
    setModalÅpen(true);
  }

  function toggleAktiv(ansatt: Ansatt) {
    setAnsatte((prev) =>
      prev.map((a) => (a.id === ansatt.id ? { ...a, aktiv: !a.aktiv } : a)),
    );
  }

  async function lagre(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    const nyFornavn = skjema.fornavn.trim();
    const nyEtternavn = skjema.etternavn.trim();
    const nyttNavn = `${nyFornavn} ${nyEtternavn}`.trim().toLowerCase();

    if (!redigererId) {
      const nyttTlf = skjema.telefon.trim().replace(/\s+/g, "");

      const navnTreff = nyttNavn
        ? ansatte.find((a) => fullNavn(a).toLowerCase() === nyttNavn)
        : undefined;

      const tlfTreff = nyttTlf
        ? ansatte.find((a) => (a.telefon ?? "").replace(/\s+/g, "") === nyttTlf)
        : undefined;

      if (navnTreff && tlfTreff && navnTreff.id === tlfTreff.id) {
        const ok = await requestBekreft(
          `Det finnes allerede en ansatt med samme navn og telefonnummer: «${fullNavn(navnTreff)}» (${nyttTlf}). Vil du opprette en ny profil likevel?`,
        );
        if (!ok) return;
      } else {
        if (navnTreff) {
          const ok = await requestBekreft(
            `Det finnes allerede en ansatt med navnet «${fullNavn(navnTreff)}». Vil du opprette en ny profil likevel?`,
          );
          if (!ok) return;
        }
        if (tlfTreff) {
          const ok = await requestBekreft(
            `Telefonnummeret ${nyttTlf} er allerede registrert på «${fullNavn(tlfTreff)}». Vil du opprette en ny profil likevel?`,
          );
          if (!ok) return;
        }
      }
    }

    const oppdatert: Ansatt = {
      id: redigererId ?? nyId(),
      fornavn: nyFornavn,
      etternavn: nyEtternavn,
      telefon: skjema.telefon.trim(),
      epost: skjema.epost.trim(),
      rolle: skjema.rolle.trim(),
      avdeling: skjema.avdeling.trim(),
      selskap: (skjema.selskap as AnsattSelskap) || undefined,
      stillingsprosent: sanitizeStillingsprosent(skjema.stillingsprosent),
      kompetanse: parseListe(skjema.kompetanse),
      førerkort: parseListe(skjema.førerkort),
      ruteIds: skjema.ruteIds.length ? [...skjema.ruteIds] : undefined,
      fastBilId: skjema.fastBilId.trim() ? skjema.fastBilId.trim() : undefined,
      fastHengerId: skjema.fastHengerId.trim() ? skjema.fastHengerId.trim() : undefined,
      aktiv: skjema.aktiv,
      kommentar: skjema.kommentar.trim() ? skjema.kommentar.trim() : undefined,
    };

    const gammelFastBilId = redigerer?.fastBilId;
    const gammelFastHengerId = redigerer?.fastHengerId;

    setAnsatte((prev) => {
      const finnes = prev.some((a) => a.id === oppdatert.id);
      if (finnes) return prev.map((a) => (a.id === oppdatert.id ? oppdatert : a));
      return [oppdatert, ...prev];
    });

    if (gammelFastBilId !== oppdatert.fastBilId) {
      syncBilSjåfør(oppdatert.id, oppdatert.fastBilId, gammelFastBilId);
    }
    if (gammelFastHengerId !== oppdatert.fastHengerId) {
      syncHengerSjåfør(oppdatert.id, oppdatert.fastHengerId, gammelFastHengerId);
    }

    setModalÅpen(false);
    setRedigererId(null);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Ansatte</h1>
        </div>
        <div className={styles.controls}>
          <input
            className={styles.input}
            value={søk}
            onChange={(e) => setSøk(e.target.value)}
            placeholder="Søk navn, bil, henger, rute…"
            aria-label="Søk ansatte"
          />
          <select
            className={styles.select}
            value={filter}
            onChange={(e) => setFilter(e.target.value as AktivFilter)}
            aria-label="Filter"
          >
            <option value="aktiv">Kun aktive</option>
            <option value="inaktiv">Kun inaktive</option>
            <option value="alle">Alle</option>
          </select>
          {canEdit ? (
            <button type="button" className={styles.primaryBtn} onClick={åpneNy}>
              Ny ansatt
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.desktopOnly}>
        <div className={styles.tableWrap}>
          <table className={styles.desktopTable}>
            <thead>
              <tr>
                <th scope="col">Navn</th>
                <th scope="col">Selskap</th>
                <th scope="col">Telefon</th>
                <th scope="col">Aktiv</th>
              </tr>
            </thead>
            <tbody>
              {synlige.map((a) => (
                <tr
                  key={a.id}
                  className={styles.row}
                  tabIndex={0}
                  role="button"
                  aria-label={`Vis ${fullNavn(a)}`}
                  onClick={() => åpneVisning(a)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      åpneVisning(a);
                    }
                  }}
                >
                  <td className={styles.nameCell}>{fullNavn(a)}</td>
                  <td className={styles.muted}>{a.selskap || "Asko"}</td>
                  <td className={styles.muted}>{a.telefon}</td>
                  <td>
                    <span className={badgeClass(a.aktiv)}>{a.aktiv ? "Aktiv" : "Inaktiv"}</span>
                  </td>
                </tr>
              ))}
              {synlige.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    Ingen treff.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.mobileOnly}>
        <div className={styles.mobileList}>
          {synlige.map((a) => (
            <div
              key={a.id}
              className={`${styles.card} ${styles.cardClickable}`}
              role="button"
              tabIndex={0}
              aria-label={`Vis ${fullNavn(a)}`}
              onClick={() => åpneVisning(a)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  åpneVisning(a);
                }
              }}
            >
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>{fullNavn(a)}</div>
                  <div className={styles.cardMeta}>
                    {a.rolle} · {a.avdeling}
                    <br />
                    {a.telefon} · {a.stillingsprosent}%
                  </div>
                </div>
                <span className={badgeClass(a.aktiv)}>{a.aktiv ? "Aktiv" : "Inaktiv"}</span>
              </div>
            </div>
          ))}
          {synlige.length === 0 ? <div className={styles.muted}>Ingen treff.</div> : null}
        </div>
      </div>

      <p className={styles.footerNote}>
        {synlige.length} {synlige.length === 1 ? "ansatt" : "ansatte"}
      </p>


      {modalÅpen ? (
        <ModalPortal>
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={redigerer ? "Rediger ansatt" : "Ny ansatt"}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) lukkModal();
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>
                  {redigerer ? "Rediger ansatt" : "Ny ansatt"}
                </div>
                <div className={styles.helper}>
                  Felter med * er påkrevd.
                </div>
              </div>
              <button type="button" className={styles.closeBtn} onClick={lukkModal} aria-label="Lukk">
                Lukk
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={lagre}>
              <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Fornavn *</label>
                  <input
                    className={styles.input}
                    value={skjema.fornavn}
                    onChange={(e) => setSkjema((s) => ({ ...s, fornavn: e.target.value }))}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Etternavn *</label>
                  <input
                    className={styles.input}
                    value={skjema.etternavn}
                    onChange={(e) => setSkjema((s) => ({ ...s, etternavn: e.target.value }))}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Telefon *</label>
                  <input
                    className={styles.input}
                    value={skjema.telefon}
                    onChange={(e) => setSkjema((s) => ({ ...s, telefon: e.target.value }))}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>E-post</label>
                  <input
                    className={styles.input}
                    type="email"
                    value={skjema.epost}
                    onChange={(e) => setSkjema((s) => ({ ...s, epost: e.target.value }))}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Rolle</label>
                  <input
                    className={styles.input}
                    value={skjema.rolle}
                    onChange={(e) => setSkjema((s) => ({ ...s, rolle: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Avdeling</label>
                  <input
                    className={styles.input}
                    value={skjema.avdeling}
                    onChange={(e) => setSkjema((s) => ({ ...s, avdeling: e.target.value }))}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Selskap</label>
                  <select
                    className={styles.select}
                    value={skjema.selskap}
                    onChange={(e) => setSkjema((s) => ({ ...s, selskap: e.target.value as AnsattSelskap | "" }))}
                  >
                    <option value="Asko">Asko</option>
                    <option value="Bring">Bring</option>
                    <option value="TF">TF</option>
                    <option value="GDF">GDF</option>
                    <option value="Kjørekontor">Kjørekontor</option>
                  </select>
                  <div className={styles.helper}>Kun Asko-ansatte vises som tilgjengelige i daglig planlegging.</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Stillingsprosent</label>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    value={skjema.stillingsprosent}
                    onChange={(e) => setSkjema((s) => ({ ...s, stillingsprosent: e.target.value }))}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Fast bil</label>
                  <SokbarVelger
                    value={skjema.fastBilId}
                    onChange={(id) => setSkjema((s) => ({ ...s, fastBilId: id }))}
                    options={bilVelgerValg}
                    tomLabel="Ingen"
                    ariaLabel="Fast bil"
                    tomTreffTekst="Ingen bil funnet"
                    kjoretoySøkMedAnsatte={kjoretoySøkBil}
                  />
                  <div className={styles.helper}>Registrer nye biler under menyen Biler.</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Fast henger</label>
                  <SokbarVelger
                    value={skjema.fastHengerId}
                    onChange={(id) => setSkjema((s) => ({ ...s, fastHengerId: id }))}
                    options={hengerVelgerValg}
                    tomLabel="Ingen"
                    ariaLabel="Fast henger"
                    tomTreffTekst="Ingen henger funnet"
                    kjoretoySøkMedAnsatte={kjoretoySøkHenger}
                  />
                  <div className={styles.helper}>Registrer nye hengere under menyen Henger.</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Kompetanse</label>
                  <input
                    className={styles.input}
                    value={skjema.kompetanse}
                    onChange={(e) => setSkjema((s) => ({ ...s, kompetanse: e.target.value }))}
                    placeholder="Skill A, Skill B"
                  />
                  <div className={styles.helper}>Skriv som kommaseparert liste.</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Førerkort</label>
                  <input
                    className={styles.input}
                    value={skjema.førerkort}
                    onChange={(e) => setSkjema((s) => ({ ...s, førerkort: e.target.value }))}
                    placeholder="B, C1"
                  />
                  <div className={styles.helper}>Skriv som kommaseparert liste.</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Aktiv</label>
                  <select
                    className={styles.select}
                    value={skjema.aktiv ? "ja" : "nei"}
                    onChange={(e) =>
                      setSkjema((s) => ({ ...s, aktiv: e.target.value === "ja" }))
                    }
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

                {redigererId ? (
                  <div className={styles.spanFullGrid}>
                    <FraværListeBlokk rader={fraværForDetaljAnsatt} />
                  </div>
                ) : null}
              </div>

              {/* Turnus-editor */}
              {redigererId && (() => {
                const ansatt = ansatte.find((a) => a.id === redigererId);
                if (!ansatt?.turnus) return null;
                return (
                  <div className={styles.turnusSection}>
                    <div className={styles.turnusHeader}>
                      <span className={styles.turnusTitle}>Turnus</span>
                      <div className={styles.turnusUkeTabs}>
                        {([1, 2] as const)
                          .filter((uke) => {
                            const ansatt = redigererId
                              ? ansatte.find((a) => a.id === redigererId)
                              : visAnsatt;
                            if (uke === 2 && !ansatt?.turnus?.uke2) return false;
                            return true;
                          })
                          .map((uke) => (
                            <button
                              key={uke}
                              type="button"
                              className={`${styles.turnusUkeTab} ${turnusUke === uke ? styles.turnusUkeTabActive : ""}`}
                              onClick={() => setTurnusUke(uke)}
                            >
                              U{uke}
                            </button>
                          ))}
                      </div>
                    </div>
                    <TurnusKort
                      turnus={ansatt.turnus}
                      visUke={turnusUke}
                      dagsDato={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                );
              })()}

              </div>
              <div className={styles.formActionsSticky}>
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
        </ModalPortal>
      ) : null}

      {visId && visAnsatt ? (
        <ModalPortal>
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`Ansatt: ${fullNavn(visAnsatt)}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) lukkVisning();
          }}
        >
          <div className={`${styles.modal} ${styles.modalWide}`}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>{fullNavn(visAnsatt)}</div>
                <div className={styles.helper} style={{ marginTop: "0.35rem" }}>
                  <span className={badgeClass(visAnsatt.aktiv)}>
                    {visAnsatt.aktiv ? "Aktiv" : "Inaktiv"}
                  </span>
                  <span style={{ marginLeft: "0.5rem" }}>
                    {visAnsatt.rolle} · {visAnsatt.avdeling}
                  </span>
                </div>
              </div>
              <button type="button" className={styles.closeBtn} onClick={lukkVisning} aria-label="Lukk">
                Lukk
              </button>
            </div>

            <div className={`${styles.modalBody} ${styles.modalBodyScroll}`}>
              <dl className={styles.detailGrid}>
                <DetailPair term="Telefon">{visAnsatt.telefon || "—"}</DetailPair>
                <DetailPair term="E-post">{visAnsatt.epost || "—"}</DetailPair>
                <DetailPair term="Selskap">{visAnsatt.selskap || "Asko"}</DetailPair>
                <DetailPair term="Stillingsprosent">{visAnsatt.stillingsprosent}%</DetailPair>
                <DetailPair term="Faste ruter (fra masterplan)">
                  {fasteRuterPerAnsatt.has(visAnsatt.id) ? (
                    <ul className={styles.ruteBulletList}>
                      {sorterRutekoder([...fasteRuterPerAnsatt.get(visAnsatt.id)!]).map((kode) => (
                        <li key={kode}>{kode}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className={styles.muted}>Ingen faste ruter i masterplan</span>
                  )}
                </DetailPair>
                <DetailPair term="Fast bil">
                  {visFastBil(visAnsatt.fastBilId, bilById.get(visAnsatt.fastBilId ?? ""))}
                </DetailPair>
                <DetailPair term="Fast henger">
                  {visFastHenger(visAnsatt.fastHengerId, hengerById.get(visAnsatt.fastHengerId ?? ""))}
                </DetailPair>
                <DetailPair term="Kompetanse">
                  {visAnsatt.kompetanse.length ? visAnsatt.kompetanse.join(", ") : "—"}
                </DetailPair>
                <DetailPair term="Førerkort">
                  {visAnsatt.førerkort.length ? visAnsatt.førerkort.join(", ") : "—"}
                </DetailPair>
                <DetailPair term="Kommentar">
                  {visAnsatt.kommentar?.trim() ? (
                    visAnsatt.kommentar.trim()
                  ) : (
                    <span className={styles.muted}>Ingen</span>
                  )}
                </DetailPair>
              </dl>

              <FraværListeBlokk rader={fraværForDetaljAnsatt} />

              {/* Turnus (read-only visning) */}
              {visAnsatt.turnus && (
                <div className={styles.turnusSection}>
                  <div className={styles.turnusHeader}>
                    <span className={styles.turnusTitle}>Turnus</span>
                    <div className={styles.turnusUkeTabs}>
                      {([1, 2] as const)
                        .filter((uke) => {
                          const ansatt = redigererId
                            ? ansatte.find((a) => a.id === redigererId)
                            : visAnsatt;
                          if (uke === 2 && !ansatt?.turnus?.uke2) return false;
                          return true;
                        })
                        .map((uke) => (
                          <button
                            key={uke}
                            type="button"
                            className={`${styles.turnusUkeTab} ${turnusUke === uke ? styles.turnusUkeTabActive : ""}`}
                            onClick={() => setTurnusUke(uke)}
                          >
                            U{uke}
                          </button>
                        ))}
                    </div>
                  </div>
                  <TurnusKort
                    turnus={visAnsatt.turnus}
                    visUke={turnusUke}
                    dagsDato={new Date().toISOString().slice(0, 10)}
                  />
                  {canEdit && (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => setTurnusEditorÅpen(visAnsatt.id)}
                    >
                      Rediger turnus
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className={styles.modalFooterBar}>
              <button
                type="button"
                className={`${styles.secondaryBtn} ${styles.dangerBtn}`}
                disabled={!canEdit}
                title={canEdit ? undefined : "Kun lesetilgang"}
                onClick={async () => {
                  if (!canEdit) return;
                  const ok = await requestBekreft(
                    `Er du sikker på at du vil slette oppføringen for ${fullNavn(visAnsatt)}? Fravær og tildelinger knyttet til denne personen fjernes også.`,
                    { bekreftTekst: "Slett" },
                  );
                  if (!ok) return;
                  const id = visAnsatt.id;
                  setAnsatte((prev) => prev.filter((a) => a.id !== id));
                  slettFraværForAnsatt(id);
                  fjernTildelingRef("ansattId", id);
                  lukkVisning();
                }}
              >
                Slett
              </button>
              <div style={{ flex: 1 }} />
              <button type="button" className={styles.secondaryBtn} onClick={lukkVisning}>
                Lukk
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={!canEdit}
                title={canEdit ? undefined : "Kun lesetilgang"}
                onClick={() => {
                  if (!canEdit) return;
                  redigerFraVisning();
                }}
              >
                Rediger
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      ) : null}
      {turnusEditorÅpen && (() => {
        const ansatt = ansatte.find((a) => a.id === turnusEditorÅpen);
        if (!ansatt) return null;
        return (
          <TurnusEditor
            ansattNavn={fullNavn(ansatt)}
            turnus={ansatt.turnus}
            onLukk={() => setTurnusEditorÅpen(null)}
            onLagre={(nyTurnus) => {
              setAnsatte((prev) =>
                prev.map((a) =>
                  a.id === turnusEditorÅpen ? { ...a, turnus: nyTurnus } : a,
                ),
              );
              setTurnusEditorÅpen(null);
            }}
          />
        );
      })()}
      {bekreftDialog}
    </div>
  );
}

