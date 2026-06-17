"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { UkeNummer } from "@/lib/imported/applyUkeMasterplan";
import MasterplanSlotRow from "@/components/masterplan/MasterplanSlotRow";
import type { SokbarVelgerValg } from "@/components/SokbarVelger";
import { useModulSøkFraUrl } from "@/lib/hooks/useModulSøkFraUrl";
import { useMasterplanStore } from "@/lib/state/masterplanStore";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useBilStore } from "@/lib/state/bilStore";
import { useHengerStore } from "@/lib/state/hengerStore";
import { useAuth } from "@/lib/state/authStore";
import { fullNavn, type Ansatt, type MasterRuteSlot, type Skift } from "@/lib/domain";
import {
  sjåførErBlokkertMotpartsskift,
  sjåførerPerSkiftDagCache,
} from "@/lib/plan/sjåførTilgjengelighet";
import { compareMasterSlotKronologisk, compareNb, sorterRutekoder } from "@/lib/utils/sort";
import { useKjoretoySøkBil, useKjoretoySøkHenger } from "@/lib/hooks/useKjoretoySøkMedAnsatte";
import { slotMatcherModulSøk } from "@/lib/utils/søkMatch";
import { merkUkeImportApplied } from "@/lib/masterplan/ukeImportMeta";
import styles from "./page.module.css";

function sjåførFraMasterSlots(
  slots: MasterRuteSlot[],
  ansattById: Map<string, Ansatt>,
  kjoretoyFelt: "standardBilId" | "standardHengerId",
): Map<string, string> {
  const rå = new Map<string, string[]>();
  for (const slot of slots) {
    const kjId = slot[kjoretoyFelt];
    const sjId = slot.standardSjåførAnsattId;
    if (!kjId || !sjId) continue;
    const a = ansattById.get(sjId);
    if (!a || a.aktiv === false) continue;
    const navn = fullNavn(a);
    const liste = rå.get(kjId) ?? [];
    if (!liste.includes(navn)) liste.push(navn);
    rå.set(kjId, liste);
  }
  const vis = new Map<string, string>();
  for (const [id, navn] of rå) {
    navn.sort((x, y) => compareNb(x, y));
    vis.set(id, navn.join(", "));
  }
  return vis;
}

const DAGNAVN = ["", "Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const TABELL_RAD_HØYDE = 40;
const TABELL_OVERSCAN = 10;

function nySlotId(): string {
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MasterplanClient() {
  const {
    masterplan,
    lagreSlot,
    oppdaterSlotFelt,
    lagreSjåførForSlot,
    slettSlot,
    lagreHel,
    koblRuter,
    fjernKobling,
  } = useMasterplanStore();
  const { ansatte } = useAnsattStore();
  const { biler } = useBilStore();
  const { hengere } = useHengerStore();
  const { canEdit } = useAuth();

  const [filterUke, setFilterUke] = useState<1 | 2 | 3 | 4>(1);
  const [filterDag, setFilterDag] = useState<number>(0); // 0 = alle
  const [filterSkift, setFilterSkift] = useState<Skift | "">("Dag");
  const [modulSøk, setModulSøk] = useModulSøkFraUrl();
  const [nyKoblingInput, setNyKoblingInput] = useState("");
  const [nyKoblingDag, setNyKoblingDag] = useState<number>(0); // 0 = alle dager
  const [nyKoblingSkift, setNyKoblingSkift] = useState<Skift | "">("");
  const [dagKoblingBama, setDagKoblingBama] = useState("");
  const [dagKoblingBase, setDagKoblingBase] = useState("");
  const [visKoblinger, setVisKoblinger] = useState(false);
  const [visLeggTil, setVisLeggTil] = useState(false);
  const [nyRuteKode, setNyRuteKode] = useState("");
  const [nyRuteNavn, setNyRuteNavn] = useState("");
  const [nyRuteDag, setNyRuteDag] = useState<number>(0);
  const [nyRuteSkift, setNyRuteSkift] = useState<Skift | "">("Dag");
  const [ukeImportMsg, setUkeImportMsg] = useState<string | null>(null);
  const [ukeImporterer, setUkeImporterer] = useState<number | null>(null);

  const aktiveAnsatte = useMemo(() => ansatte.filter((a) => a.aktiv), [ansatte]);
  const ansattById = useMemo(
    () => new Map(ansatte.map((a) => [a.id, a] as const)),
    [ansatte],
  );

  const bilIdsIBruk = useMemo(() => {
    const ids = new Set<string>();
    for (const a of ansatte) {
      if (a.fastBilId) ids.add(a.fastBilId);
    }
    for (const slot of masterplan.slots) {
      if (slot.standardBilId) ids.add(slot.standardBilId);
    }
    return ids;
  }, [ansatte, masterplan.slots]);

  const hengerIdsIBruk = useMemo(() => {
    const ids = new Set<string>();
    for (const a of ansatte) {
      if (a.fastHengerId) ids.add(a.fastHengerId);
    }
    for (const slot of masterplan.slots) {
      if (slot.standardHengerId) ids.add(slot.standardHengerId);
    }
    return ids;
  }, [ansatte, masterplan.slots]);

  const sjåførVelgerValg = useMemo(
    () =>
      aktiveAnsatte.map((a) => ({
        value: a.id,
        label: fullNavn(a),
        søkTekst: fullNavn(a),
      })),
    [aktiveAnsatte],
  );

  const sjåførPerSkiftDag = useMemo(
    () => sjåførerPerSkiftDagCache(masterplan.slots),
    [masterplan.slots],
  );

  const sjåførPerBilFraMaster = useMemo(
    () => sjåførFraMasterSlots(masterplan.slots, ansattById, "standardBilId"),
    [masterplan.slots, ansattById],
  );

  const sjåførPerHengerFraMaster = useMemo(
    () => sjåførFraMasterSlots(masterplan.slots, ansattById, "standardHengerId"),
    [masterplan.slots, ansattById],
  );

  const kjoretoySøkBil = useKjoretoySøkBil(ansatte, biler, sjåførPerBilFraMaster);
  const kjoretoySøkHenger = useKjoretoySøkHenger(ansatte, hengere, sjåførPerHengerFraMaster);

  const bilVelgerValg = useMemo(
    () =>
      biler
        .filter((b) => b.aktiv || bilIdsIBruk.has(b.id))
        .map((b) => ({
          value: b.id,
          label: b.kjennemerke,
          søkTekst: [b.kjennemerke, b.merke, b.modell].filter(Boolean).join(" "),
          hint: b.aktiv ? undefined : "inaktiv",
        })),
    [biler, bilIdsIBruk],
  );

  const hengerVelgerValg = useMemo(
    () =>
      hengere
        .filter((h) => h.aktiv || hengerIdsIBruk.has(h.id))
        .map((h) => ({
          value: h.id,
          label: h.kjennemerke,
          søkTekst: [h.kjennemerke, h.type].filter(Boolean).join(" "),
          hint: h.aktiv ? undefined : "inaktiv",
        })),
    [hengere, hengerIdsIBruk],
  );

  const bilById = useMemo(() => new Map(biler.map((b) => [b.id, b] as const)), [biler]);
  const hengerById = useMemo(
    () => new Map(hengere.map((h) => [h.id, h] as const)),
    [hengere],
  );

  const filtrertSlots = useMemo(() => {
    const q = modulSøk.trim();
    const ctx = { ansattById, bilById, hengerById };
    return masterplan.slots
      .filter((s) => s.uke === filterUke)
      .filter((s) => filterDag === 0 || s.dag === filterDag)
      .filter((s) => !filterSkift || s.skift === filterSkift)
      .filter((s) => !q || slotMatcherModulSøk(s, q, ctx))
      .sort((a, b) => {
        if (a.dag !== b.dag) return a.dag - b.dag;
        if (a.skift !== b.skift) return a.skift === "Dag" ? -1 : 1;
        return compareMasterSlotKronologisk(a, b);
      });
  }, [masterplan.slots, filterUke, filterDag, filterSkift, modulSøk, ansattById, bilById, hengerById]);

  const sjåførValgPerSlotId = useMemo(() => {
    const map = new Map<string, SokbarVelgerValg[]>();
    for (const slot of filtrertSlots) {
      map.set(
        slot.id,
        sjåførVelgerValg.filter(
          (o) => !sjåførErBlokkertMotpartsskift(sjåførPerSkiftDag, slot, o.value),
        ),
      );
    }
    return map;
  }, [filtrertSlots, sjåførVelgerValg, sjåførPerSkiftDag]);

  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(480);

  useLayoutEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const mål = () => setViewportH(el.clientHeight);
    mål();
    const ro = new ResizeObserver(mål);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const virtualRange = useMemo(() => {
    const n = filtrertSlots.length;
    if (n === 0) return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0 };
    const synlige = Math.ceil(viewportH / TABELL_RAD_HØYDE) + TABELL_OVERSCAN * 2;
    const start = Math.max(0, Math.floor(scrollTop / TABELL_RAD_HØYDE) - TABELL_OVERSCAN);
    const end = Math.min(n, start + synlige);
    const totalH = n * TABELL_RAD_HØYDE;
    return {
      start,
      end,
      paddingTop: start * TABELL_RAD_HØYDE,
      paddingBottom: Math.max(0, totalH - end * TABELL_RAD_HØYDE),
    };
  }, [filtrertSlots.length, scrollTop, viewportH]);

  const synligeSlots = useMemo(
    () => filtrertSlots.slice(virtualRange.start, virtualRange.end),
    [filtrertSlots, virtualRange.start, virtualRange.end],
  );

  const oppdaterSlot = useCallback(
    (slot: MasterRuteSlot, felt: Partial<MasterRuteSlot>) => {
      lagreSlot({ ...slot, ...felt });
    },
    [lagreSlot],
  );

  const grupper = masterplan.koblingsgrupper ?? {};

  const ukobledeGrupper = useMemo(() => {
    const alleRutekoder = [...new Set(masterplan.slots.map((s) => s.rutekode))];
    const alleredeKoblet = new Set(
      Object.values(grupper).flatMap((g) => g.rutekoder),
    );
    const baseMap = new Map<string, string[]>();
    for (const kode of alleRutekoder) {
      const match = kode.match(/^(.+)-(\d+)$/);
      if (!match) continue;
      if (!baseMap.has(match[1])) baseMap.set(match[1], []);
      baseMap.get(match[1])!.push(kode);
    }
    const result: [string, string[]][] = [];
    for (const [, koder] of baseMap) {
      if (koder.length < 2) continue;
      const ukobled = koder.filter((k) => !alleredeKoblet.has(k));
      if (ukobled.length >= 2) result.push([koder[0], sorterRutekoder(koder)]);
    }
    return result;
  }, [masterplan.slots, grupper]);

  function åpneLeggTil() {
    setNyRuteKode("");
    setNyRuteNavn("");
    setNyRuteDag(filterDag > 0 ? filterDag : 1);
    setNyRuteSkift(filterSkift || "Dag");
    setVisLeggTil(true);
  }

  function leggTilRute() {
    const kode = nyRuteKode.trim();
    if (!kode) return;
    const dag = nyRuteDag > 0 ? nyRuteDag : 1;
    const skift: Skift = nyRuteSkift || "Dag";
    const nySlot: MasterRuteSlot = {
      id: nySlotId(),
      uke: filterUke,
      dag: dag as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      skift,
      rutekode: kode,
      rutenavn: nyRuteNavn.trim() || undefined,
    };
    lagreSlot(nySlot);
    setNyRuteKode("");
    setNyRuteNavn("");
    setVisLeggTil(false);
  }

  function bekreftSlett(slot: MasterRuteSlot) {
    if (window.confirm(`Slette rute ${slot.rutekode} (${DAGNAVN[slot.dag]}, ${slot.skift})?`)) {
      slettSlot(slot.id);
    }
  }

  function opprettKobling() {
    const koder = nyKoblingInput.split(",").map((s) => s.trim()).filter(Boolean);
    if (koder.length < 2) return;
    const skift = nyKoblingSkift || undefined;
    const dag = nyKoblingDag > 0 ? nyKoblingDag as 1|2|3|4|5|6|7 : undefined;
    const parts = [koder.join("+")];
    if (dag) parts.push(`d${dag}`);
    if (skift) parts.push(skift);
    const nøkkel = parts.join(":");
    koblRuter(nøkkel, koder, { skift: skift as Skift | undefined, dag });
    setNyKoblingInput("");
    setNyKoblingDag(0);
    setNyKoblingSkift("");
  }

  function opprettDagKoblinger() {
    const bamaRute = dagKoblingBama.trim();
    const baseKode = dagKoblingBase.trim();
    if (!bamaRute || !baseKode) return;
    for (let dag = 1; dag <= 6; dag++) {
      const dagRute = `${dag}${baseKode}`;
      const nøkkel = `${bamaRute}+${dagRute}:d${dag}`;
      koblRuter(nøkkel, [bamaRute, dagRute], { dag: dag as 1|2|3|4|5|6|7 });
    }
    setDagKoblingBama("");
    setDagKoblingBase("");
  }

  function autoKoblAlle() {
    for (const [, koder] of ukobledeGrupper) {
      koblRuter(koder.join("+"), koder);
    }
  }

  async function leggInnUkeFraPlan(uke: UkeNummer) {
    if (
      !window.confirm(
        `Legge inn uke ${uke} fra Ringnes-planen? Sjåfør og starttid oppdateres for alle uke ${uke}-ruter. Andre uker og koblingsgrupper påvirkes ikke.`,
      )
    ) {
      return;
    }
    setUkeImporterer(uke);
    setUkeImportMsg(null);
    try {
      const { mergeUkeMasterplanPatchForUke, UKE_MASTERPLAN_PATCHES } = await import(
        "@/lib/imported/applyUkeMasterplan"
      );
      const patch = UKE_MASTERPLAN_PATCHES[uke];
      const { plan, updated } = mergeUkeMasterplanPatchForUke(masterplan, uke, ansattById);
      lagreHel(plan);
      const patchVersjon = String(patch.meta?.generert ?? "1");
      merkUkeImportApplied(uke, patchVersjon);
      setUkeImportMsg(`Uke ${uke} oppdatert — ${updated} ruter lagt inn. Lagrer til sky…`);
    } finally {
      setUkeImporterer(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Masterplan</h1>
        <button
          type="button"
          className={`${styles.toggleBtn} ${visKoblinger ? styles.toggleBtnActive : ""}`}
          onClick={() => setVisKoblinger(!visKoblinger)}
        >
          Koblinger ({Object.keys(grupper).length})
        </button>
      </div>

      {visKoblinger && (
        <section className={styles.koblingsPanel}>
          <h2 className={styles.sectionTitle}>Koblede ruter</h2>
          {!canEdit && (
            <p className={styles.hint}>
              Kun lesetilgang — logg inn som planlegger/admin for å endre koblinger.
            </p>
          )}
          <p className={styles.hint}>
            Ruter i en koblingsgruppe deler alltid sjåfør, bil og henger. Endringer her gjelder permanent.
          </p>
          {Object.keys(grupper).length === 0 && (
            <p className={styles.emptyMsg}>Ingen koblingsgrupper definert ennå.</p>
          )}
          {Object.entries(grupper).map(([gruppe, kobling]) => (
            <div key={gruppe} className={styles.gruppeCard}>
              <span className={styles.gruppeRuter}>
                {kobling.rutekoder.join(" ⟷ ")}
                {kobling.dag && <span className={styles.dagBadge}>{DAGNAVN[kobling.dag]}</span>}
                {kobling.skift && <span className={styles.skiftBadge}>{kobling.skift}</span>}
              </span>
              <button type="button" className={styles.fjernBtn} onClick={() => fjernKobling(gruppe)} disabled={!canEdit}>
                Fjern
              </button>
            </div>
          ))}
          {ukobledeGrupper.length > 0 && (
            <div className={styles.autoSection}>
              <button type="button" className={styles.submitBtn} onClick={autoKoblAlle} disabled={!canEdit}>
                Auto-kobl {ukobledeGrupper.length} grupper (felles -1, -2…)
              </button>
              <p className={styles.hint}>
                {ukobledeGrupper.map(([, k]) => k.join(", ")).join(" · ")}
              </p>
            </div>
          )}

          <h3 className={styles.sectionTitle} style={{ marginTop: "0.6rem" }}>Daglig kobling (mønster)</h3>
          <p className={styles.hint}>
            For ruter som kjører hver dag men kobles til ulike ruter per dag (f.eks. 1520 + x112 der x=dagnr).
          </p>
          <div className={styles.form}>
            <input
              className={styles.input}
              type="text"
              placeholder="Fast rute (f.eks. 1520)"
              value={dagKoblingBama}
              onChange={(e) => setDagKoblingBama(e.target.value)}
            />
            <input
              className={styles.input}
              type="text"
              placeholder="Base uten dagnr (f.eks. 112)"
              value={dagKoblingBase}
              onChange={(e) => setDagKoblingBase(e.target.value)}
            />
            <button
              type="button"
              className={styles.submitBtn}
              onClick={opprettDagKoblinger}
              disabled={!canEdit || !dagKoblingBama.trim() || !dagKoblingBase.trim()}
            >
              Generer man–lør
            </button>
          </div>
          <p className={styles.hint}>
            Oppretter kobling per dag: man→1{dagKoblingBase || "xxx"}, tir→2{dagKoblingBase || "xxx"}, ons→3{dagKoblingBase || "xxx"} osv.
          </p>

          <h3 className={styles.sectionTitle} style={{ marginTop: "0.6rem" }}>Manuell kobling</h3>
          <div className={styles.form}>
            <input
              className={styles.input}
              type="text"
              placeholder="Rutekoder, kommaseparert"
              value={nyKoblingInput}
              onChange={(e) => setNyKoblingInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") opprettKobling(); }}
            />
            <select
              className={styles.filterSelect}
              value={nyKoblingDag}
              onChange={(e) => setNyKoblingDag(Number(e.target.value))}
            >
              <option value={0}>Alle dager</option>
              {[1,2,3,4,5,6,7].map((d) => <option key={d} value={d}>{DAGNAVN[d]}</option>)}
            </select>
            <select
              className={styles.filterSelect}
              value={nyKoblingSkift}
              onChange={(e) => setNyKoblingSkift(e.target.value as Skift | "")}
            >
              <option value="">Begge skift</option>
              <option value="Dag">Dag</option>
              <option value="Kveld">Kveld</option>
            </select>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={opprettKobling}
              disabled={
                !canEdit ||
                nyKoblingInput.split(",").map((s) => s.trim()).filter(Boolean).length < 2
              }
            >
              Kobl
            </button>
          </div>
        </section>
      )}

      {/* Filtrering */}
      <div className={styles.filters}>
        <label className={styles.filterLabel}>
          Uke
          <select
            className={styles.filterSelect}
            value={filterUke}
            onChange={(e) => setFilterUke(Number(e.target.value) as 1 | 2 | 3 | 4)}
          >
            <option value={1}>Uke 1</option>
            <option value={2}>Uke 2</option>
            <option value={3}>Uke 3</option>
            <option value={4}>Uke 4</option>
          </select>
        </label>
        <label className={styles.filterLabel}>
          Dag
          <select
            className={styles.filterSelect}
            value={filterDag}
            onChange={(e) => setFilterDag(Number(e.target.value))}
          >
            <option value={0}>Alle</option>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>{DAGNAVN[d]}</option>
            ))}
          </select>
        </label>
        <label className={styles.filterLabel}>
          Skift
          <select
            className={styles.filterSelect}
            value={filterSkift}
            onChange={(e) => setFilterSkift(e.target.value as Skift | "")}
          >
            <option value="">Alle</option>
            <option value="Dag">Dag</option>
            <option value="Kveld">Kveld</option>
          </select>
        </label>
        <input
          className={styles.input}
          type="search"
          value={modulSøk}
          onChange={(e) => setModulSøk(e.target.value)}
          placeholder="Søk rute, navn, bil, henger…"
          aria-label="Søk i ruter"
        />
        <span className={styles.slotCount}>{filtrertSlots.length} ruter</span>
        {canEdit && filterUke >= 1 && filterUke <= 4 && (
          <button
            type="button"
            className={styles.submitBtn}
            onClick={() => void leggInnUkeFraPlan(filterUke as UkeNummer)}
            disabled={ukeImporterer !== null}
          >
            {ukeImporterer === filterUke
              ? `Legger inn uke ${filterUke}…`
              : `Legg inn uke ${filterUke} fra plan`}
          </button>
        )}
      </div>
      {ukeImportMsg && <p className={styles.hint}>{ukeImportMsg}</p>}

      {/* Legg til-knapp */}
      <div className={styles.addRow}>
        <button type="button" className={styles.submitBtn} onClick={åpneLeggTil}>
          + Legg til rute
        </button>
      </div>

      {/* Legg til-popup */}
      {visLeggTil && (
        <div className={styles.modalOverlay} onClick={() => setVisLeggTil(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Legg til rute</h2>
            <label className={styles.modalLabel}>
              Rutekode
              <input
                className={styles.modalInput}
                type="text"
                placeholder="F.eks. 1520"
                value={nyRuteKode}
                onChange={(e) => setNyRuteKode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") leggTilRute(); }}
                autoFocus
              />
            </label>
            <label className={styles.modalLabel}>
              Rutenavn (valgfritt)
              <input
                className={styles.modalInput}
                type="text"
                placeholder="F.eks. Bama shh Hamar"
                value={nyRuteNavn}
                onChange={(e) => setNyRuteNavn(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") leggTilRute(); }}
              />
            </label>
            <div className={styles.modalRow}>
              <label className={styles.modalLabel}>
                Dag
                <select
                  className={styles.modalSelect}
                  value={nyRuteDag}
                  onChange={(e) => setNyRuteDag(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>{DAGNAVN[d]}</option>
                  ))}
                </select>
              </label>
              <label className={styles.modalLabel}>
                Skift
                <select
                  className={styles.modalSelect}
                  value={nyRuteSkift}
                  onChange={(e) => setNyRuteSkift(e.target.value as Skift)}
                >
                  <option value="Dag">Dag</option>
                  <option value="Kveld">Kveld</option>
                </select>
              </label>
              <label className={styles.modalLabel}>
                Uke
                <span className={styles.modalUkeBadge}>{filterUke}</span>
              </label>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setVisLeggTil(false)}
              >
                Avbryt
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={leggTilRute}
                disabled={!nyRuteKode.trim()}
              >
                Legg til
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabell */}
      <div
        ref={tableWrapRef}
        className={styles.tableWrap}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Dag</th>
              <th>Skift</th>
              <th>Rutekode</th>
              <th>Rutenavn</th>
              <th>Start</th>
              <th>Slutt</th>
              <th>Dager</th>
              <th>Fast sjåfør</th>
              <th>Fast bil</th>
              <th>Fast henger</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {virtualRange.paddingTop > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={11} style={{ height: virtualRange.paddingTop, padding: 0, border: "none" }} />
              </tr>
            ) : null}
            {synligeSlots.map((slot) => (
              <MasterplanSlotRow
                key={slot.id}
                slot={slot}
                sjåførOptions={sjåførValgPerSlotId.get(slot.id) ?? sjåførVelgerValg}
                bilOptions={bilVelgerValg}
                hengerOptions={hengerVelgerValg}
                kjoretoySøkBil={kjoretoySøkBil}
                kjoretoySøkHenger={kjoretoySøkHenger}
                onLagreSjåfør={lagreSjåførForSlot}
                onOppdaterFelt={oppdaterSlotFelt}
                onOppdater={oppdaterSlot}
                onSlett={bekreftSlett}
              />
            ))}
            {virtualRange.paddingBottom > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={11} style={{ height: virtualRange.paddingBottom, padding: 0, border: "none" }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
