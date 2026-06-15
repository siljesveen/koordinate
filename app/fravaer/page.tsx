"use client";

import { useMemo, useRef, useState } from "react";
import SokbarVelger from "@/components/SokbarVelger";
import { fullNavn, FRAVÆR_TYPER, type Ansatt, type Fravær, type FraværType } from "@/lib/domain";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useBemanningsplanStore } from "@/lib/state/bemanningsplanStore";
import { useFraværStore } from "@/lib/state/fravaerStore";
import { useModulSøkFraUrl } from "@/lib/hooks/useModulSøkFraUrl";
import { useAuth } from "@/lib/state/authStore";
import {
  analyserPlanKoblinger,
  kobledeAnsattIdsFraPlan,
  settPlanBinding,
  synkPlanBindinger,
} from "@/lib/utils/bemanningsplanKobling";
import { formatFraværKoder, formatFraværTypeOppsummering, sammenlignFraværKoder, tellFraværEtterType, tellFraværKoderForKoblede, tellFraværKoderIPlan, tellLagredeFraværDager, erGyldigPlan } from "@/lib/utils/bemanningsplanKoder";
import { importerBemanningsFravær } from "@/lib/utils/importerBemanningsFravær";
import { parseBemanningsplanExcel, type BemanningPlanData } from "@/lib/utils/parseBemanningsplanExcel";
import { validerFraværMotAnsatte } from "@/lib/utils/fraværAnsattMatching";
import { ansattMatcherModulSøk } from "@/lib/utils/søkMatch";
import FraværTidslinje from "./FraværTidslinje";
import styles from "./page.module.css";

type FraværSkjema = {
  id: string;
  ansattId: string;
  type: FraværType;
  fraDato: string;
  tilDato: string;
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
      kommentar: "",
    };
  }
  return {
    id: item.id,
    ansattId: item.ansattId,
    type: item.type,
    fraDato: item.fraDato,
    tilDato: item.tilDato,
    kommentar: item.kommentar ?? "",
  };
}

export default function FraværPage() {
  const { canEdit } = useAuth();
  const { ansatte, setAnsatte } = useAnsattStore();
  const { plan, settPlan, harOpplastetPlan } = useBemanningsplanStore();
  const aktiveAnsatte = useMemo(() => ansatte.filter((a) => a.aktiv !== false), [ansatte]);
  const ansattById = useMemo(() => new Map(ansatte.map((a) => [a.id, a] as const)), [ansatte]);
  const ansattVelgerValg = useMemo(
    () =>
      aktiveAnsatte.map((a) => ({
        value: a.id,
        label: a.planExcelNavn ? `${fullNavn(a)} (${a.planExcelNavn})` : fullNavn(a),
        søkTekst: [fullNavn(a), a.planExcelNavn ?? ""].filter(Boolean).join(" "),
      })),
    [aktiveAnsatte],
  );

  const { fravær, lagre, synkFraPlan, slett } = useFraværStore();
  const filRef = useRef<HTMLInputElement>(null);

  const [søk, setSøk] = useModulSøkFraUrl();
  const [typeFilter, setTypeFilter] = useState<"" | FraværType>("");

  const [modalÅpen, setModalÅpen] = useState(false);
  const [redigererId, setRedigererId] = useState<string | null>(null);
  const [skjema, setSkjema] = useState<FraværSkjema>(() => toSkjema(null, aktiveAnsatte));
  const [importerer, setImporterer] = useState(false);
  const [lasterPlan, setLasterPlan] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [fokusDato, setFokusDato] = useState<string | null>(null);

  const lagretOppsummering = useMemo(
    () => formatFraværTypeOppsummering(tellFraværEtterType(fravær)),
    [fravær],
  );

  const kobling = useMemo(() => {
    if (!plan) return null;
    return analyserPlanKoblinger(plan, ansatte);
  }, [ansatte, plan]);

  const planVsLagret = useMemo(() => {
    if (!plan || !harOpplastetPlan || !kobling) return null;
    const forventet = tellFraværKoderForKoblede(plan, ansatte);
    const planAnsattIds = new Set(kobling.koblet.map((k) => k.ansattId).filter(Boolean) as string[]);
    const lagret = tellLagredeFraværDager(fravær.filter((f) => planAnsattIds.has(f.ansattId)));
    return { forventet, lagret, tekst: sammenlignFraværKoder(forventet, lagret) };
  }, [ansatte, fravær, harOpplastetPlan, kobling, plan]);

  const redigerer = useMemo(
    () => (redigererId ? fravær.find((f) => f.id === redigererId) ?? null : null),
    [fravær, redigererId],
  );

  const fraværValidering = useMemo(() => validerFraværMotAnsatte(fravær, ansatte), [ansatte, fravær]);

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
          (f.excelKode?.toLowerCase().includes(q.toLowerCase()) ?? false) ||
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

  function slettFravær() {
    if (!redigererId) return;
    const a = ansattById.get(skjema.ansattId);
    const navn = a ? fullNavn(a) : "fraværet";
    if (typeof window !== "undefined" && !window.confirm(`Slette fravær for ${navn}?`)) return;
    slett(redigererId);
    lukk();
  }

  function lagreSkjema(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
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
      kommentar: skjema.kommentar.trim() ? skjema.kommentar.trim() : undefined,
    };

    lagre(item);
    lukk();
  }

  async function håndterPlanOpplasting(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !canEdit) return;
    setImportStatus(null);
    setLasterPlan(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseBemanningsplanExcel(buffer, file.name);
      settPlan(parsed);
      const { ansatte: oppdaterte, result } = synkPlanBindinger(parsed, ansatte);
      setAnsatte(oppdaterte);

      const { ok, melding } = await utførPlanSynk(
        parsed,
        oppdaterte,
        `Lastet opp «${file.name}».`,
      );
      const type = ok && result.utenTreff.length === 0 ? "ok" : "error";
      setImportStatus({ type, text: melding });
    } catch (err) {
      setImportStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Kunne ikke lese Excel-filen",
      });
    } finally {
      setLasterPlan(false);
      if (filRef.current) filRef.current.value = "";
    }
  }

  function manuellKobling(planNavn: string, ansattId: string) {
    if (!canEdit) return;
    const ny = settPlanBinding(ansatte, ansattId, planNavn);
    setAnsatte(ny);
    setImportStatus({
      type: "ok",
      text: `Koblet «${planNavn}» til valgt ansatt.`,
    });
    if (plan && erGyldigPlan(plan)) {
      void utførPlanSynk(plan, ny, `Koblet «${planNavn}» — fravær synkronisert på nytt.`);
    }
  }

  async function utførPlanSynk(
    planData: BemanningPlanData,
    ansattListe: Ansatt[],
    prefix?: string,
  ): Promise<{ ok: boolean; melding: string }> {
    const { fravær: importerte, unmatchedNavn, validering } = await importerBemanningsFravær({
      ansatte: ansattListe,
      plan: planData,
    });

    const kobledeIds = kobledeAnsattIdsFraPlan(planData, ansattListe);
    synkFraPlan(importerte, kobledeIds);

    const forventet = tellFraværKoderForKoblede(planData, ansattListe);
    const importertDager = tellLagredeFraværDager(importerte);
    const sammenligning = sammenlignFraværKoder(forventet, importertDager);

    const kildeTekst = planData.fileName ? `«${planData.fileName}»` : "planen";
    let melding = prefix ? `${prefix} ` : "";
    melding += `Synkronisert ${importerte.length} perioder fra ${kildeTekst} for ${kobledeIds.length} ansatte`;
    melding += `. Dager: ${sammenligning}`;
    if (unmatchedNavn.length > 0) {
      melding += `. ${unmatchedNavn.length} plan-navn uten ansatt (ikke importert): ${unmatchedNavn.join(", ")}`;
    }
    if (validering.duplikatNavn.length > 0) {
      melding += ` — advarsel: ${validering.duplikatNavn.length} navneduplikat i ansattliste`;
    }
    if (importerte[0]) setFokusDato(importerte[0].fraDato);

    const harAvvik = Object.keys(forventet).some((k) => (forventet[k] ?? 0) !== (importertDager[k] ?? 0));
    return { ok: unmatchedNavn.length === 0 && !harAvvik, melding };
  }

  async function importerFraBemanningsplan() {
    if (!canEdit || importerer || !plan || !harOpplastetPlan) return;
    setImportStatus(null);
    setImporterer(true);
    try {
      const { ok, melding } = await utførPlanSynk(plan, ansatte);
      setImportStatus({ type: ok ? "ok" : "error", text: melding });
    } catch (err) {
      setImportStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Import feilet",
      });
    } finally {
      setImporterer(false);
    }
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
            {FRAVÆR_TYPER.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {canEdit ? (
            <>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={importerFraBemanningsplan}
                disabled={importerer || lasterPlan || !harOpplastetPlan}
              >
                {importerer || lasterPlan ? "Synkroniserer…" : "Synkroniser fravær"}
              </button>
              <button type="button" className={styles.primaryBtn} onClick={åpneNy} disabled={!aktiveAnsatte.length}>
                Nytt fravær
              </button>
            </>
          ) : null}
        </div>
      </header>

      {canEdit ? (
        <section className={styles.planPanel} aria-label="Bemanningsplan">
          <div className={styles.planPanelTitle}>Bemanningsplan (Excel)</div>
          <p className={styles.planPanelMeta}>
            Last opp ny <strong>Bemanning 2026.xlsx</strong> når planen endres — fravær synkroniseres{" "}
            <strong>automatisk</strong> for alle koblede ansatte. Endringer (nye S/F/A/K/T, fjernede koder) erstatter
            forrige plan-fravær. Sjekk avstemmingen under: alle koder skal ha <strong>✓</strong>.
          </p>
          <div className={styles.planPanelActions}>
            <label className={styles.fileLabel}>
              {lasterPlan ? "Leser fil…" : "Last opp bemanningsplan"}
              <input
                ref={filRef}
                className={styles.fileInput}
                type="file"
                accept=".xlsx,.xls"
                onChange={håndterPlanOpplasting}
                disabled={lasterPlan}
              />
            </label>
            {harOpplastetPlan && plan ? (
              <span className={styles.planPanelMeta}>
                Aktiv: <strong>{plan.fileName}</strong> ({Object.keys(plan.drivers).length} rader,{" "}
                {formatFraværKoder(tellFraværKoderIPlan(plan))}, {plan.generated})
              </span>
            ) : plan?.drivers && Object.keys(plan.drivers).length > 0 ? (
              <span className={styles.planPanelMeta}>
                Lagret plan er utdatert — last opp <strong>Bemanning 2026.xlsx</strong> på nytt for å importere A, T og K.
              </span>
            ) : (
              <span className={styles.planPanelMeta}>
                Ingen gyldig plan — last opp <strong>Bemanning 2026.xlsx</strong> før import.
              </span>
            )}
          </div>

          {kobling ? (
            <div className={styles.koblingStats}>
              <span className={styles.koblingStatOk}>{kobling.koblet.length} koblet</span>
              {kobling.utenTreff.length > 0 ? (
                <span className={styles.koblingStatWarn}>{kobling.utenTreff.length} uten ansatt-treff</span>
              ) : null}
              {kobling.ansatteUtenPlanRad.length > 0 ? (
                <span className={styles.planPanelMeta}>
                  {kobling.ansatteUtenPlanRad.length} ansatte uten rad i plan (kun manuelt fravær)
                </span>
              ) : null}
            </div>
          ) : null}

          {kobling && kobling.utenTreff.length > 0 ? (
            <div>
              <p className={styles.helper}>Koble plan-navn manuelt til ansatt:</p>
              {kobling.utenTreff.map((rad) => (
                <div key={rad.planNavn} className={styles.koblingRad}>
                  <span className={styles.koblingPlanNavn}>
                    {rad.planNavn}
                    {rad.fraværDager > 0 ? ` (${rad.fraværDager} fraværsdager)` : ""}
                  </span>
                  <select
                    className={styles.koblingSelect}
                    defaultValue=""
                    aria-label={`Koble ${rad.planNavn} til ansatt`}
                    onChange={(e) => {
                      if (e.target.value) manuellKobling(rad.planNavn, e.target.value);
                    }}
                  >
                    <option value="">Velg ansatt…</option>
                    {aktiveAnsatte.map((a) => (
                      <option key={a.id} value={a.id}>
                        {fullNavn(a)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {importStatus ? (
        <p
          className={importStatus.type === "error" ? styles.importStatusError : styles.importStatusOk}
          role="status"
        >
          {importStatus.text}
        </p>
      ) : null}

      {fraværValidering.foreldreløse.length > 0 ? (
        <p className={styles.importStatusError} role="status">
          {fraværValidering.foreldreløse.length} fraværsperioder peker på ansatte som ikke finnes lenger
          (feil kobling etter ansattendring). Importer på nytt etter at ansattlisten er riktig, eller slett
          foreldreløse perioder manuelt.
        </p>
      ) : null}

      {fravær.length > 0 ? (
        <p className={styles.planPanelMeta} role="status">
          Lagret i kalenderen: <strong>{fravær.length}</strong> perioder
          {lagretOppsummering ? ` — ${lagretOppsummering}` : ""}
          {typeFilter ? ` (filter: ${typeFilter})` : ""}
        </p>
      ) : harOpplastetPlan ? (
        <p className={styles.importStatusError} role="status">
          Plan er lastet opp, men fravær er ikke synkronisert ennå. Last opp på nytt eller trykk{" "}
          <strong>Synkroniser fravær</strong>.
        </p>
      ) : null}

      {planVsLagret ? (
        <p
          className={planVsLagret.tekst.includes("≠") ? styles.importStatusError : styles.importStatusOk}
          role="status"
        >
          Avstemming dager (koblede ansatte): {planVsLagret.tekst}
        </p>
      ) : null}

      <FraværTidslinje
        fravær={synlige}
        ansattById={ansattById}
        onVelg={åpneRedigering}
        fokusDato={fokusDato}
      />

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
                    {FRAVÆR_TYPER.map((type) => (
                      <option key={type} value={type}>
                        {type}
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
                    onClick={slettFravær}
                  >
                    Slett fravær
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
