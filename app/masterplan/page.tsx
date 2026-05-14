"use client";

import { useMemo, useState } from "react";
import { useMasterplanStore } from "@/lib/state/masterplanStore";
import { useAnsattStore } from "@/lib/state/ansattStore";
import { useBilStore } from "@/lib/state/bilStore";
import { useHengerStore } from "@/lib/state/hengerStore";
import type { MasterRuteSlot, Skift } from "@/lib/domain";
import styles from "./page.module.css";

const DAGNAVN = ["", "Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function nySlotId(): string {
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MasterplanPage() {
  const { masterplan, lagreSlot, slettSlot, koblRuter, fjernKobling } = useMasterplanStore();
  const { ansatte } = useAnsattStore();
  const { biler } = useBilStore();
  const { hengere } = useHengerStore();

  const [filterUke, setFilterUke] = useState<1 | 2 | 3 | 4>(1);
  const [filterDag, setFilterDag] = useState<number>(0); // 0 = alle
  const [filterSkift, setFilterSkift] = useState<Skift | "">("Dag");
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

  const aktiveAnsatte = useMemo(() => ansatte.filter((a) => a.aktiv), [ansatte]);
  const aktiveBiler = useMemo(() => biler.filter((b) => b.aktiv), [biler]);
  const aktiveHengere = useMemo(() => hengere.filter((h) => h.aktiv), [hengere]);

  const filtrertSlots = useMemo(() => {
    return masterplan.slots
      .filter((s) => s.uke === filterUke)
      .filter((s) => filterDag === 0 || s.dag === filterDag)
      .filter((s) => !filterSkift || s.skift === filterSkift)
      .sort((a, b) => {
        if (a.dag !== b.dag) return a.dag - b.dag;
        if (a.skift !== b.skift) return a.skift === "Dag" ? -1 : 1;
        return a.rutekode.localeCompare(b.rutekode, "nb");
      });
  }, [masterplan.slots, filterUke, filterDag, filterSkift]);

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
      if (ukobled.length >= 2) result.push([koder[0], koder.sort()]);
    }
    return result;
  }, [masterplan.slots, grupper]);

  function oppdaterSlot(slot: MasterRuteSlot, felt: Partial<MasterRuteSlot>) {
    lagreSlot({ ...slot, ...felt });
  }

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
              <button type="button" className={styles.fjernBtn} onClick={() => fjernKobling(gruppe)}>
                Fjern
              </button>
            </div>
          ))}
          {ukobledeGrupper.length > 0 && (
            <div className={styles.autoSection}>
              <button type="button" className={styles.submitBtn} onClick={autoKoblAlle}>
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
              disabled={!dagKoblingBama.trim() || !dagKoblingBase.trim()}
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
              disabled={nyKoblingInput.split(",").map((s) => s.trim()).filter(Boolean).length < 2}
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
        <span className={styles.slotCount}>{filtrertSlots.length} ruter</span>
      </div>

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
      <div className={styles.tableWrap}>
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
            {filtrertSlots.map((slot) => (
              <tr key={slot.id} className={slot.varighet && slot.varighet > 1 ? styles.rowMultiday : undefined}>
                <td>
                  <select
                    className={styles.cellSelectSmall}
                    value={slot.dag}
                    onChange={(e) => oppdaterSlot(slot, { dag: Number(e.target.value) as 1|2|3|4|5|6|7 })}
                  >
                    {[1,2,3,4,5,6,7].map((d) => (
                      <option key={d} value={d}>{DAGNAVN[d]}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className={styles.cellSelectSmall}
                    value={slot.skift}
                    onChange={(e) => oppdaterSlot(slot, { skift: e.target.value as Skift })}
                  >
                    <option value="Dag">Dag</option>
                    <option value="Kveld">Kveld</option>
                  </select>
                </td>
                <td>
                  <input
                    className={styles.cellInputCode}
                    type="text"
                    value={slot.rutekode}
                    onChange={(e) => oppdaterSlot(slot, { rutekode: e.target.value.trim() })}
                  />
                  {slot.koblingsgruppe && <span className={styles.linkBadge}>⟷</span>}
                </td>
                <td>
                  <input
                    className={styles.cellInput}
                    type="text"
                    value={slot.rutenavn ?? ""}
                    placeholder="—"
                    onChange={(e) => oppdaterSlot(slot, { rutenavn: e.target.value || undefined })}
                  />
                </td>
                <td>
                  <input
                    className={styles.cellInputTime}
                    type="time"
                    value={slot.startTid ?? ""}
                    onChange={(e) => oppdaterSlot(slot, { startTid: e.target.value || undefined })}
                  />
                </td>
                <td>
                  <input
                    className={styles.cellInputTime}
                    type="time"
                    value={slot.sluttTid ?? ""}
                    onChange={(e) => oppdaterSlot(slot, { sluttTid: e.target.value || undefined })}
                  />
                </td>
                <td>
                  <select
                    className={styles.cellSelectSmall}
                    value={slot.varighet ?? 1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      oppdaterSlot(slot, { varighet: v > 1 ? v : undefined });
                    }}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </td>
                <td>
                  <select
                    className={styles.cellSelect}
                    value={slot.standardSjåførAnsattId ?? ""}
                    onChange={(e) => oppdaterSlot(slot, { standardSjåførAnsattId: e.target.value || undefined })}
                  >
                    <option value="">—</option>
                    {aktiveAnsatte.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.fornavn} {a.etternavn}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className={styles.cellSelect}
                    value={slot.standardBilId ?? ""}
                    onChange={(e) => oppdaterSlot(slot, { standardBilId: e.target.value || undefined })}
                  >
                    <option value="">—</option>
                    {aktiveBiler.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.kjennemerke}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className={styles.cellSelect}
                    value={slot.standardHengerId ?? ""}
                    onChange={(e) => oppdaterSlot(slot, { standardHengerId: e.target.value || undefined })}
                  >
                    <option value="">—</option>
                    {aktiveHengere.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.kjennemerke}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.deleteRowBtn}
                    onClick={() => bekreftSlett(slot)}
                    title="Slett rute"
                    aria-label={`Slett ${slot.rutekode}`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
