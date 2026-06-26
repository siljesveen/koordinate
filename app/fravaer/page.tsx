"use client";

import { useMemo, useRef, useState } from "react";
import SokbarVelger from "@/components/SokbarVelger";
import { fullNavn, FRAVÆR_TYPER, type Ansatt, type Fravær, type FraværType } from "@/lib/domain";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useBemanningsplanStore } from "@/lib/state/bemanningsplanStore";
import { useFraværStore } from "@/lib/state/fravaerStore";
import { useModulSøkFraUrl } from "@/lib/hooks/useModulSøkFraUrl";
import { useBekreftDialog } from "@/components/useBekreftDialog";
import { useAuth } from "@/lib/state/authStore";
import {
  analyserPlanKoblinger,
  kobledeAnsattIdsFraPlan,
  settPlanBinding,
  synkPlanBindinger,
} from "@/lib/utils/bemanningsplanKobling";
import { erGyldigPlan } from "@/lib/utils/bemanningsplanKoder";
import { importerBemanningsFravær } from "@/lib/utils/importerBemanningsFravær";
import { parseBemanningsplanExcel, type BemanningPlanData } from "@/lib/utils/parseBemanningsplanExcel";
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
  const { requestBekreft, dialog: bekreftDialog } = useBekreftDialog();
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
  const [importFeil, setImportFeil] = useState<string | null>(null);
  const [fokusDato, setFokusDato] = useState<string | null>(null);

  const kobling = useMemo(() => {
    if (!plan) return null;
    return analyserPlanKoblinger(plan, ansatte);
  }, [ansatte, plan]);

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

  async function slettFravær() {
    if (!redigererId) return;
    const a = ansattById.get(skjema.ansattId);
    const navn = a ? fullNavn(a) : "fraværet";
    const ok = await requestBekreft(`Slette fravær for ${navn}?`, { bekreftTekst: "Slett" });
    if (!ok) return;
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
    setImportFeil(null);
    setLasterPlan(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseBemanningsplanExcel(buffer, file.name);
      settPlan(parsed);
      const { ansatte: oppdaterte } = synkPlanBindinger(parsed, ansatte);
      setAnsatte(oppdaterte);
      await utførPlanSynk(parsed, oppdaterte);
    } catch (err) {
      setImportFeil(err instanceof Error ? err.message : "Kunne ikke lese Excel-filen");
    } finally {
      setLasterPlan(false);
      if (filRef.current) filRef.current.value = "";
    }
  }

  function manuellKobling(planNavn: string, ansattId: string) {
    if (!canEdit) return;
    const ny = settPlanBinding(ansatte, ansattId, planNavn);
    setAnsatte(ny);
    setImportFeil(null);
    if (plan && erGyldigPlan(plan)) {
      void utførPlanSynk(plan, ny);
    }
  }

  async function utførPlanSynk(planData: BemanningPlanData, ansattListe: Ansatt[]): Promise<void> {
    const { fravær: importerte } = await importerBemanningsFravær({
      ansatte: ansattListe,
      plan: planData,
    });

    const kobledeIds = kobledeAnsattIdsFraPlan(planData, ansattListe);
    synkFraPlan(importerte, kobledeIds);
    if (importerte[0]) setFokusDato(importerte[0].fraDato);
  }

  async function importerFraBemanningsplan() {
    if (!canEdit || importerer || !plan || !harOpplastetPlan) return;
    setImportFeil(null);
    setImporterer(true);
    try {
      await utførPlanSynk(plan, ansatte);
    } catch (err) {
      setImportFeil(err instanceof Error ? err.message : "Import feilet");
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
              <button type="button" className={styles.primaryBtn} onClick={åpneNy} disabled={!aktiveAnsatte.length}>
                Nytt fravær
              </button>
            </>
          ) : null}
        </div>
      </header>

      {canEdit ? (
        <section className={styles.planBar} aria-label="Bemanningsplan">
          <label className={styles.fileLabel}>
            {lasterPlan ? "Leser fil…" : harOpplastetPlan ? "Bytt fil" : "Last opp plan"}
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
            <span className={styles.planFileName}>{plan.fileName}</span>
          ) : null}
          {harOpplastetPlan ? (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={importerFraBemanningsplan}
              disabled={importerer || lasterPlan}
            >
              {importerer || lasterPlan ? "Synkroniserer…" : "Synkroniser"}
            </button>
          ) : null}
          {importFeil ? (
            <span className={styles.planFeil} role="alert">
              {importFeil}
            </span>
          ) : null}
        </section>
      ) : null}

      {canEdit && kobling && kobling.utenTreff.length > 0 ? (
        <details className={styles.koblingDetails} open>
          <summary className={styles.koblingSummary}>
            {kobling.utenTreff.length} navn i planen må kobles til ansatt
          </summary>
          <div className={styles.koblingListeWrap}>
            {kobling.utenTreff.map((rad) => (
              <div key={rad.planNavn} className={styles.koblingRad}>
                <span className={styles.koblingPlanNavn}>{rad.planNavn}</span>
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
        </details>
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
      {bekreftDialog}
    </div>
  );
}
